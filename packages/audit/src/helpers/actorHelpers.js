// Keys that must never appear in audit event metadata.
// Any key whose lowercased form contains one of these terms is blocked.
export const BLOCKED_AUDIT_METADATA_KEYS = Object.freeze([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "sessiontoken",
  "secret",
  "apikey",
  "privatekey",
  "creditcard",
  "cardnumber",
  "cvv",
  "pin",
  "ssn",
  "socialsecurity",
]);

/**
 * Returns true if the given metadata key is safe to include in an audit event.
 * Blocks keys whose lowercased form contains any blocked term.
 */
export const isSafeAuditMetadataKey = (key) => {
  if (typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return !BLOCKED_AUDIT_METADATA_KEYS.some((blocked) => lower.includes(blocked));
};

/**
 * Creates a safe actor reference from a user-like object.
 * Only picks id, role, an explicitly supplied non-sensitive label, and
 * sourceApp — never passwords, tokens, email addresses, or phone numbers.
 *
 * @param {object} [user]
 * @returns {{ id?: string, role?: string, label?: string, sourceApp?: string } | undefined}
 */
export const createActorRef = (user = {}) => {
  if (!user || typeof user !== "object") return undefined;
  const ref = {};
  if (user.id) ref.id = String(user.id);
  if (user.role) ref.role = String(user.role);
  if (user.label) {
    ref.label = String(user.label);
  }
  if (user.sourceApp) ref.sourceApp = String(user.sourceApp);
  return Object.keys(ref).length > 0 ? ref : undefined;
};

/**
 * Creates a safe organization reference from an org-like object.
 *
 * @param {object} [org]
 * @returns {{ id?: string, label?: string } | undefined}
 */
export const createOrgRef = (org = {}) => {
  if (!org || typeof org !== "object") return undefined;
  const ref = {};
  if (org.id) ref.id = String(org.id);
  if (org.name) ref.label = String(org.name);
  else if (org.label) ref.label = String(org.label);
  return Object.keys(ref).length > 0 ? ref : undefined;
};
