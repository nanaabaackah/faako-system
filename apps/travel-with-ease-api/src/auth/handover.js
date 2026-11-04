import { transaction, verifyDatabaseIdentity } from "../db/database.js";
import { appendAudit } from "../audit.js";
import {
  lockStaff,
  invalidateStaffAccess,
  recordRoleChange,
} from "./staff-policy.js";

export async function handoverDeveloper(
  pool,
  {
    environment,
    organisationId,
    settings,
    developer,
    client,
    approvalReference,
    requestId,
  },
) {
  const matches = (i) =>
    i?.issuer === settings.issuer &&
    i?.audience === settings.audience &&
    typeof i.subject === "string" &&
    i.subject.length > 0;
  if (
    !matches(developer) ||
    !matches(client) ||
    developer.subject === client.subject ||
    developer.email !== "dev.nanaabaackah@gmail.com" ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approvalReference)
  )
    throw new Error("Verified handover identities or approval are invalid.");
  return transaction(pool, async (db) => {
    await verifyDatabaseIdentity(db, { environment, organisationId });
    await lockStaff(db, organisationId);
    const { rows } = await db.query(
      "SELECT id,subject,role,active FROM twe.staff_users WHERE organisation_id=$1 AND issuer=$2 AND access_audience=$3 AND subject=ANY($4::text[]) ORDER BY id FOR UPDATE",
      [
        organisationId,
        settings.issuer,
        settings.audience,
        [developer.subject, client.subject],
      ],
    );
    const dev = rows.find((r) => r.subject === developer.subject),
      owner = rows.find((r) => r.subject === client.subject);
    if (
      !dev?.active ||
      dev.role !== "owner" ||
      !owner?.active ||
      !["owner", "editor"].includes(owner.role)
    )
      throw new Error(
        "Both existing accounts must be active business accounts; developer must currently be Owner.",
      );
    if (
      (
        await db.query(
          "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND role='platform_admin'",
          [organisationId],
        )
      ).rowCount
    )
      throw new Error(
        "A Superadmin already exists; use separately reviewed recovery.",
      );
    for (const [user, role] of [
      [owner, "owner"],
      [dev, "platform_admin"],
    ]) {
      await invalidateStaffAccess(db, organisationId, user.id, {
        invitations: true,
      });
      if (user.role === role) continue;
      await db.query(
        "UPDATE twe.staff_users SET role=$3 WHERE organisation_id=$1 AND id=$2",
        [organisationId, user.id, role],
      );
      const id = await recordRoleChange(db, {
        organisationId,
        actorId: dev.id,
        userId: user.id,
        previousRole: user.role,
        nextRole: role,
        approvalReference,
        requestId,
      });
      await appendAudit(db, {
        organisationId,
        actorId: dev.id,
        action: "staff.role_changed",
        recordId: id,
        requestId,
      });
    }
    await appendAudit(db, {
      organisationId,
      actorId: dev.id,
      action: "staff.bootstrap.handover",
      recordId: dev.id,
      requestId,
    });
    return { completed: true };
  });
}
