export const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const CSRF_EXCLUDED_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/forgot-password",
  "/public/",
  "/webhooks/",
];

export const createCsrfMiddleware = ({
  getCookieValue,
  authCookieName,
  csrfCookieName,
  timingSafeEqual,
}) => (req, res, next) => {
  if (CSRF_SAFE_METHODS.has(req.method)) {
    return next();
  }
  if (CSRF_EXCLUDED_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const authCookieToken = getCookieValue(req, authCookieName);
  if (!authCookieToken) {
    return next();
  }

  const csrfCookieToken = getCookieValue(req, csrfCookieName);
  const csrfHeaderToken = String(req.header("x-csrf-token") || "").trim();
  if (
    !csrfCookieToken ||
    !csrfHeaderToken ||
    !timingSafeEqual(csrfCookieToken, csrfHeaderToken)
  ) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
};
