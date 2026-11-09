import { randomUUID } from "node:crypto";
import { transaction, verifyDatabaseIdentity } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import {
  lockStaff,
  protectLastOwner,
  invalidateStaffAccess,
  recordRoleChange,
} from "./staff-policy.js";

const approvalPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/;
const denied = (status, code, message) => {
  throw new ContentError(status, code, message);
};

function requireStaging(environment) {
  if (!["staging", "test"].includes(environment))
    denied(404, "not_found", "Route not found.");
}

function identityMatches(identity, settings, session) {
  return Boolean(
    identity &&
      session &&
      identity.issuer === settings.issuer &&
      identity.audience === settings.audience &&
      identity.issuer === session.issuer &&
      identity.subject === session.subject &&
      identity.audience === session.access_audience &&
      identity.assertionHash === session.access_assertion_hash,
  );
}

async function authenticatedSession(db, organisationId, userId, sessionHash) {
  if (!/^[a-f0-9]{64}$/.test(sessionHash || "")) return null;
  const { rows } = await db.query(
    `SELECT u.id,u.issuer,u.subject,u.access_audience,u.role,u.active,
            s.token_hash,s.access_assertion_hash,s.expires_at
       FROM twe.staff_sessions s
       JOIN twe.staff_users u ON u.organisation_id=s.organisation_id AND u.id=s.user_id
      WHERE s.organisation_id=$1 AND s.user_id=$2 AND s.token_hash=$3
        AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active=true
      FOR UPDATE OF s,u`,
    [organisationId, userId, sessionHash],
  );
  return rows[0] || null;
}

export async function requestDeveloperHandover(
  pool,
  {
    environment,
    organisationId,
    settings,
    developer,
    developerSessionHash,
    developerIdentity,
    clientId,
    approvalReference,
    requestId,
  },
) {
  requireStaging(environment);
  if (
    developer?.organisationId !== organisationId ||
    developer?.id === clientId ||
    developerIdentity?.email?.toLowerCase() !== "dev.nanaabaackah@gmail.com" ||
    !approvalPattern.test(approvalReference || "")
  )
    denied(403, "permission_error", "The staging handover request is not permitted.");

  return transaction(pool, async (db) => {
    await verifyDatabaseIdentity(db, { environment, organisationId });
    await lockStaff(db, organisationId);
    const currentDeveloper = await authenticatedSession(
      db,
      organisationId,
      developer.id,
      developerSessionHash,
    );
    if (
      currentDeveloper?.role !== "owner" ||
      !identityMatches(developerIdentity, settings, currentDeveloper)
    )
      denied(401, "authentication_error", "Reauthenticate before requesting the staging handover.");
    const { rows: clients } = await db.query(
      "SELECT id,role,active FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 FOR UPDATE",
      [organisationId, clientId],
    );
    if (!clients[0]?.active || clients[0].role !== "editor")
      denied(409, "conflict", "Choose the active client Editor account before requesting handover.");
    if (
      (
        await db.query(
          "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND role='platform_admin'",
          [organisationId],
        )
      ).rowCount
    )
      denied(409, "conflict", "A Superadmin already exists; this staging handover is unavailable.");

    await db.query(
      `UPDATE twe.staff_handover_requests SET cancelled_at=now()
        WHERE organisation_id=$1 AND approved_at IS NULL AND cancelled_at IS NULL AND expires_at<=now()`,
      [organisationId],
    );
    const existing = await db.query(
      `SELECT id FROM twe.staff_handover_requests
        WHERE organisation_id=$1 AND approved_at IS NULL AND cancelled_at IS NULL AND expires_at>now()
        FOR UPDATE`,
      [organisationId],
    );
    if (existing.rowCount)
      denied(409, "conflict", "A staging handover request is already awaiting approval.");

    const id = randomUUID();
    const { rows } = await db.query(
      `INSERT INTO twe.staff_handover_requests
        (id,organisation_id,developer_id,client_id,developer_session_hash,approval_reference,request_id,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')
       RETURNING id,client_id,approval_reference,created_at,expires_at`,
      [
        id,
        organisationId,
        developer.id,
        clientId,
        developerSessionHash,
        approvalReference,
        requestId,
      ],
    );
    await appendAudit(db, {
      organisationId,
      actorId: developer.id,
      action: "staff.bootstrap.handover_requested",
      recordId: id,
      requestId,
    });
    return { ...rows[0], status: "pending", canApprove: false };
  });
}

export async function developerHandoverStatus(
  pool,
  { environment, organisationId, actor },
) {
  requireStaging(environment);
  if (actor?.organisationId !== organisationId)
    denied(403, "permission_error", "The staging handover is not available.");
  const { rows } = await pool.query(
    `SELECT h.id,h.developer_id,h.client_id,h.approval_reference,h.created_at,h.expires_at,
            (h.client_id=$2) AS can_approve
       FROM twe.staff_handover_requests h
       JOIN twe.staff_users u ON u.organisation_id=h.organisation_id AND u.id=$2 AND u.active=true
      WHERE h.organisation_id=$1 AND (h.developer_id=$2 OR h.client_id=$2)
        AND h.approved_at IS NULL AND h.cancelled_at IS NULL AND h.expires_at>now()
      ORDER BY h.created_at DESC LIMIT 1`,
    [organisationId, actor.id],
  );
  return rows[0] ? { ...rows[0], status: "pending" } : null;
}

export async function handoverDeveloper(
  pool,
  {
    environment,
    organisationId,
    settings,
    client,
    clientSessionHash,
    clientIdentity,
    handoverId,
    requestId,
  },
) {
  requireStaging(environment);
  if (client?.organisationId !== organisationId || !clientIdentity)
    denied(403, "permission_error", "The staging handover approval is not permitted.");
  return transaction(pool, async (db) => {
    await verifyDatabaseIdentity(db, { environment, organisationId });
    await lockStaff(db, organisationId);
    const { rows: requests } = await db.query(
      `SELECT *,expires_at>now() AS unexpired FROM twe.staff_handover_requests
        WHERE organisation_id=$1 AND id=$2 FOR UPDATE`,
      [organisationId, handoverId],
    );
    const approval = requests[0];
    if (
      !approval ||
      approval.client_id !== client.id ||
      approval.developer_id === client.id
    )
      denied(403, "permission_error", "Only the named client may approve this staging handover.");
    if (approval.approved_at || approval.cancelled_at)
      denied(409, "conflict", "This staging handover request has already been used.");
    if (!approval.unexpired)
      denied(409, "conflict", "This staging handover approval has expired. Request a new one.");

    const approver = await authenticatedSession(
      db,
      organisationId,
      client.id,
      clientSessionHash,
    );
    const dev = await authenticatedSession(
      db,
      organisationId,
      approval.developer_id,
      approval.developer_session_hash,
    );
    if (
      !identityMatches(clientIdentity, settings, approver) ||
      approver?.role !== "editor" ||
      dev?.role !== "owner" ||
      dev.id === approver.id
    )
      denied(409, "conflict", "Both independently authenticated staging sessions must remain active with the expected roles.");
    if (
      (
        await db.query(
          "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND role='platform_admin'",
          [organisationId],
        )
      ).rowCount
    )
      denied(409, "conflict", "A Superadmin already exists; this staging handover cannot run.");

    for (const [user, role] of [
      [approver, "owner"],
      [dev, "platform_admin"],
    ]) {
      if (user.role === role) continue;
      await protectLastOwner(db, organisationId, user, role, user.active);
      await db.query(
        "UPDATE twe.staff_users SET role=$3 WHERE organisation_id=$1 AND id=$2",
        [organisationId, user.id, role],
      );
      const id = await recordRoleChange(db, {
        organisationId,
        actorId: approver.id,
        userId: user.id,
        previousRole: user.role,
        nextRole: role,
        approvalReference: approval.approval_reference,
        requestId,
      });
      await appendAudit(db, {
        organisationId,
        actorId: approver.id,
        action: "staff.role_changed",
        recordId: id,
        requestId,
      });
    }
    await db.query(
      `UPDATE twe.staff_handover_requests
          SET approved_at=now(),approved_by=$3
        WHERE organisation_id=$1 AND id=$2 AND approved_at IS NULL AND cancelled_at IS NULL`,
      [organisationId, handoverId, approver.id],
    );
    for (const user of [approver, dev])
      await invalidateStaffAccess(db, organisationId, user.id, {
        invitations: true,
      });
    await appendAudit(db, {
      organisationId,
      actorId: approver.id,
      action: "staff.bootstrap.handover_approved",
      recordId: handoverId,
      requestId,
    });
    await appendAudit(db, {
      organisationId,
      actorId: approver.id,
      action: "staff.bootstrap.handover",
      recordId: dev.id,
      requestId,
    });
    return { completed: true, sessionsInvalidated: true };
  });
}
