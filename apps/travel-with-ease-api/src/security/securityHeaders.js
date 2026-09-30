import { createExpressSecurityHeadersMiddleware } from "@faako/security";

// The shared middleware is authoritative. Keep this baseline executable in
// tests so app registration cannot silently diverge from the runtime headers.
export const REQUIRED_SECURITY_HEADERS = Object.freeze([
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]);

export const createSecurityHeaders = ({ allowedOrigins = [] } = {}) =>
  createExpressSecurityHeadersMiddleware({ profileId: "api-service", allowedOrigins });
