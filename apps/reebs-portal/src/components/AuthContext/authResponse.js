const FORBIDDEN_AUTH_FIELDS = new Set([
  "token",
  "password",
  "loginAttempts",
  "lockedUntil",
  "sessionToken",
  "sessionTokenId",
]);

export const sanitizeAuthUser = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !FORBIDDEN_AUTH_FIELDS.has(key))
  );
};
