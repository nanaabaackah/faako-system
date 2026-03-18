const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.reebspartythemes.com",
  "https://reebspartythemes.com",
  "https://portal.reebspartythemes.com",
  "http://localhost:8888",
  "http://localhost:5173",
];

const getHeaderValue = (event, key) => {
  const headers = event?.headers;
  if (!headers || typeof headers !== "object") return "";
  return String(
    headers[key]
    || headers[key.toLowerCase()]
    || headers[key.toUpperCase()]
    || ""
  ).trim();
};

const normalizeOrigin = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigins = () => {
  const configured = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
  ];
  return new Set(
    [...DEFAULT_ALLOWED_ORIGINS, ...configured]
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean)
  );
};

export const isAllowedAppOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return getAllowedOrigins().has(normalized);
};

export const isCrossSiteBrowserRequest = (event) => {
  const fetchSite = getHeaderValue(event, "sec-fetch-site").toLowerCase();
  return fetchSite === "cross-site";
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
};

export const buildResponseHeaders = (
  event,
  {
    methods = "GET,POST,OPTIONS",
    allowHeaders = "Content-Type, Authorization, X-Organization-Id",
    cacheControl = "no-store, private",
    extraHeaders = {},
  } = {}
) => {
  const headers = {
    ...SECURITY_HEADERS,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": methods,
    ...extraHeaders,
  };

  const requestOrigin = normalizeOrigin(getHeaderValue(event, "origin"));
  if (requestOrigin && isAllowedAppOrigin(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
    headers.Vary = "Origin";
  }

  if (cacheControl) {
    headers["Cache-Control"] = cacheControl;
  }

  return headers;
};

export const json = (event, statusCode, payload = {}, options = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, options),
  },
  body: statusCode === 204 ? "" : JSON.stringify(payload),
});
