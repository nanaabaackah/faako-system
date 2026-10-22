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

export const createSecurityHeaders = ({ allowedOrigins = [] } = {}) => {
  const shared = createExpressSecurityHeadersMiddleware({ profileId: "api-service", allowedOrigins });
  return (req, res, next) => shared(req, res, () => {
    // The shared browser client sends this header on every request.
    res.setHeader("Access-Control-Allow-Headers", `${res.getHeader("Access-Control-Allow-Headers")}, X-Request-Id`);
    // Extend only TWE's upload protocol; preserve shared origin/credential policy.
    if (req.path?.startsWith("/api/agent/media/")) {
      res.setHeader("Access-Control-Allow-Headers", `${res.getHeader("Access-Control-Allow-Headers")}, X-Media-Alt, X-Media-Rights`);
    }
    next();
  });
};
