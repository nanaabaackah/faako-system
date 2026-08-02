import {
  buildApiSecurityHeaders,
  isAllowedOrigin,
  mergeAllowedOrigins,
  normalizeOrigin,
} from "@faako/security";
import {
  createCompatibleErrorResponse,
  errorCodeForStatus,
  resolveRequestId,
  safeMessageForErrorCode,
} from "@faako/api-contracts";

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

const DEFAULT_ALLOW_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Organization-Id",
  "X-CSRF-Token",
  "X-Request-Id",
];

const mergeAllowHeaders = (value) => {
  const headers = new Set(DEFAULT_ALLOW_HEADERS);
  String(value || "")
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean)
    .forEach((header) => headers.add(header));
  return Array.from(headers).join(", ");
};

export const isAllowedAppOrigin = (origin) => {
  return isAllowedOrigin(origin, getAllowedOrigins());
};

export const isCrossSiteBrowserRequest = (event) => {
  const fetchSite = getHeaderValue(event, "sec-fetch-site").toLowerCase();
  return fetchSite === "cross-site";
};

export const getEventRequestId = (event) => {
  if (event?.requestId) return event.requestId;
  const requestId = resolveRequestId(getHeaderValue(event, "x-request-id"));
  if (event && typeof event === "object") {
    event.requestId = requestId;
    event.headers = {
      ...(event.headers || {}),
      "x-request-id": requestId,
    };
  }
  return requestId;
};

export const buildResponseHeaders = (
  event,
  {
    methods = "GET,POST,OPTIONS",
    allowHeaders = DEFAULT_ALLOW_HEADERS.join(", "),
    cacheControl = "no-store, private",
    extraHeaders = {},
  } = {}
) => {
  const requestId = getEventRequestId(event);
  const normalizedAllowHeaders = mergeAllowHeaders(allowHeaders);
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
    allowHeaders: normalizedAllowHeaders,
    requestProtocol,
    cacheControl,
    extraHeaders,
  });

  headers["Access-Control-Allow-Headers"] = normalizedAllowHeaders;
  headers["Access-Control-Allow-Methods"] = methods;
  headers["Access-Control-Expose-Headers"] = "X-Request-Id, Retry-After";
  headers["X-Request-Id"] = requestId;

  return headers;
};

export const json = (event, statusCode, payload = {}, options = {}) => {
  const requestId = getEventRequestId(event);
  const normalizedPayload =
    statusCode >= 400
      ? createCompatibleErrorResponse(
          {
            code: payload?.apiError?.code || errorCodeForStatus(statusCode),
            message:
              statusCode >= 500 && options.exposeServerMessage !== true
                ? safeMessageForErrorCode(errorCodeForStatus(statusCode))
                : String(
                    payload?.apiError?.message ||
                      payload?.error ||
                      payload?.message ||
                      safeMessageForErrorCode(errorCodeForStatus(statusCode))
                  ),
            issues:
              payload?.apiError?.issues ||
              payload?.issues ||
              payload?.errors,
          },
          {
            requestId,
            retryAfterSeconds:
              payload?.retryAfterSeconds || options.retryAfterSeconds,
            legacy:
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? payload
                : {},
          }
        )
      : payload;

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...buildResponseHeaders(event, options),
    },
    body: statusCode === 204 ? "" : JSON.stringify(normalizedPayload),
  };
};
