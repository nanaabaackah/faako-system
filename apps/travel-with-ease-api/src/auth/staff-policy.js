import { ContentError } from "../content/schema.js";

export const lockStaff = (client, organisationId) =>
  client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('twe-invitations:' || $1, 0))",
    [organisationId],
  );

export async function protectLastOwner(
  client,
  organisationId,
  target,
  nextRole,
  active,
) {
  if (
    target.role !== "owner" ||
    !target.active ||
    (nextRole === "owner" && active)
  )
    return;
  const { rowCount } = await client.query(
    "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND role='owner' AND active=true AND id<>$2",
    [organisationId, target.id],
  );
  if (!rowCount)
    throw new ContentError(
      409,
      "conflict",
      "Keep at least one active Owner. Assign another Owner before making this change.",
    );
}

export async function invalidateStaffAccess(
  client,
  organisationId,
  userId,
  { invitations = false } = {},
) {
  await client.query(
    "UPDATE twe.staff_sessions SET revoked_at=now() WHERE organisation_id=$1 AND user_id=$2 AND revoked_at IS NULL",
    [organisationId, userId],
  );
  await client.query(
    "UPDATE twe.support_grants SET revoked_at=now() WHERE organisation_id=$1 AND (user_id=$2 OR approved_by=$2) AND revoked_at IS NULL",
    [organisationId, userId],
  );
  if (invitations)
    await client.query(
      "UPDATE twe.staff_invitations SET revoked_at=now() WHERE organisation_id=$1 AND created_by=$2 AND accepted_at IS NULL AND revoked_at IS NULL",
      [organisationId, userId],
    );
}

export async function recordRoleChange(
  client,
  {
    organisationId,
    actorId,
    userId,
    previousRole,
    nextRole,
    approvalReference,
    requestId,
  },
) {
  const {
    rows: [row],
  } = await client.query(
    "INSERT INTO twe.staff_role_changes(id,organisation_id,actor_id,user_id,previous_role,next_role,approval_reference,request_id) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [
      organisationId,
      actorId,
      userId,
      previousRole,
      nextRole,
      approvalReference,
      requestId,
    ],
  );
  return row.id;
}
