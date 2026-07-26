export type AuthMode = "none" | "cookie" | "bearer";
export type SecurityProfileId =
  | "public-static"
  | "public-interactive"
  | "authenticated-workspace"
  | "api-service";

export function normalizeAuthMode(
  value: unknown,
  fallback?: AuthMode | "",
): AuthMode | "";

export function normalizeSecurityProfileId(
  value: unknown,
  fallback?: SecurityProfileId | "",
): SecurityProfileId | "";
