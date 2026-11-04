// Explicit application policy approved by the November 1 launch brief. The
// platform_admin identifier remains stable; it is displayed as Superadmin.
// This grants TWE application authority, never other tenants or infrastructure.
export const ROLE_PERMISSIONS = Object.freeze({
  platform_admin: Object.freeze(["system.read", "security.read", "staff.stage", "staff.revoke", "staff.roles.manage", "audit.business.read", "maintenance.revoke_sessions", "support.request", "content.read", "content.write", "content.publish", "media.read", "media.write", "enquiries.read", "enquiries.write", "staff.manage", "templates.manage"]),
  owner: Object.freeze(["content.read", "content.write", "content.publish", "media.read", "media.write", "enquiries.read", "enquiries.write", "staff.manage", "audit.business.read", "support.approve", "templates.manage"]),
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
