// Application policy, not a role hierarchy. Keep technical authority separate
// from business access; never accept organisation or grants from request input.
export const ROLE_PERMISSIONS = Object.freeze({
  platform_admin: Object.freeze(["system.read", "security.read", "staff.stage", "staff.revoke", "maintenance.revoke_sessions", "support.request"]),
  owner: Object.freeze(["content.read", "content.write", "content.publish", "media.read", "media.write", "enquiries.read", "enquiries.write", "staff.manage", "support.approve"]),
  editor: Object.freeze(["content.read", "content.write", "media.read", "media.write", "enquiries.read", "enquiries.write"]),
});

export function hasPermission(actor, permission, organisationId) {
  return Boolean(actor?.id && organisationId && actor.organisationId === organisationId &&
    Object.hasOwn(ROLE_PERMISSIONS, actor.role) && ROLE_PERMISSIONS[actor.role].includes(permission));
}

export function validSupportGrant(grant, actor, permission, organisationId, now = Date.now()) {
  // Initial support scope is read-only enquiries. No publishing, exports,
  // impersonation, role changes or arbitrary maintenance through elevation.
  const start = Date.parse(grant?.created_at), end = Date.parse(grant?.expires_at);
  return Boolean(actor?.role === "platform_admin" && actor.organisationId === organisationId &&
    permission === "enquiries.read" && grant?.permission === permission &&
    grant.organisation_id === organisationId && grant.user_id === actor.id &&
    grant.approved_by && grant.approved_by !== actor.id && grant.reason_reference &&
    !grant.revoked_at && Number.isFinite(now) && start <= now && end > now &&
    end - start > 0 && end - start <= 30 * 60_000);
}
