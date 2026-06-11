import {
  buildApiSecurityHeaders,
  isAllowedOrigin,
  mergeAllowedOrigins,
  normalizeOrigin,
} from "@faako/security";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.reebspartythemes.com",
  "https://reebspartythemes.com",
  "https://portal.reebspartythemes.com",
  "http://localhost:8888",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:8888",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
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

const splitConfiguredOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const getAllowedOrigins = () => {
  const configured = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.CF_PAGES_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.APP_BASE_URL,
    process.env.REEBS_PORTAL_URL,
    process.env.REEBS_WEBSITE_URL,
    ...splitConfiguredOrigins(process.env.CORS_ORIGINS),
    ...splitConfiguredOrigins(process.env.ALLOWED_ORIGINS),
  ];
  return mergeAllowedOrigins(DEFAULT_ALLOWED_ORIGINS, configured);
};

export const isAllowedAppOrigin = (origin) => {
  return isAllowedOrigin(origin, getAllowedOrigins());
};

export const isCrossSiteBrowserRequest = (event) => {
  const fetchSite = getHeaderValue(event, "sec-fetch-site").toLowerCase();
  return fetchSite === "cross-site";
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
  const requestOrigin = normalizeOrigin(getHeaderValue(event, "origin"));
  const requestProtocol =
    String(getHeaderValue(event, "x-forwarded-proto") || getHeaderValue(event, "x-forwarded-protocol")).toLowerCase() === "https"
      ? "https"
      : "";
  const headers = buildApiSecurityHeaders({
    profileId: "authenticated-workspace",
    origin: requestOrigin,
    allowedOrigins: getAllowedOrigins(),
    methods,
    allowHeaders,
    requestProtocol,
    cacheControl,
    extraHeaders,
  });

  headers["Access-Control-Allow-Headers"] = allowHeaders;
  headers["Access-Control-Allow-Methods"] = methods;

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
