import { createExpressSecurityHeadersMiddleware } from "@faako/security";

const normalizeOrigin = (origin) => String(origin || "").trim().replace(/\/$/, "");
const normalizePositiveInteger = (value) => {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(number) && number > 0 ? number : 0;
};
const DEFAULT_PRODUCTION_ORIGINS = [
  "https://stroanesolutions.com",
  "https://www.stroanesolutions.com",
  "https://portal.stroanesolutions.com",
];
const DEFAULT_DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5175",
  "http://localhost:3000",
];

const isProductionRuntime = (env = process.env) =>
  String(env.NODE_ENV || env.APP_ENV || "")
    .trim()
    .toLowerCase() === "production";

const isCloudflarePagesPreviewOrigin = (origin) => {
  try {
    const url = new URL(normalizeOrigin(origin));
    return url.protocol === "https:" && url.hostname.endsWith(".pages.dev");
  } catch {
    return false;
  }
};

export const resolveAllowedOrigins = (env = process.env) => {
  const allowedOrigins = new Set(
    String(env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean)
  );

  if (isProductionRuntime(env)) {
    DEFAULT_PRODUCTION_ORIGINS.forEach((origin) => allowedOrigins.add(origin));
  } else {
    DEFAULT_DEVELOPMENT_ORIGINS.forEach((origin) => allowedOrigins.add(origin));
  }

  return allowedOrigins;
};

export const resolveTrustProxySetting = (env = process.env) => {
  const hopCount = normalizePositiveInteger(env.TRUST_PROXY_HOPS);
  return hopCount || false;
};

export const createCorsOriginValidator =
  ({ allowedOrigins, allowCloudflarePagesPreviews = true }) =>
  (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);
    if (
      !origin ||
      allowedOrigins.has(normalizedOrigin) ||
      (allowCloudflarePagesPreviews && isCloudflarePagesPreviewOrigin(normalizedOrigin))
    ) {
      return callback(null, true);
    }

    const error = new Error("Not allowed by CORS");
    error.statusCode = 403;
    return callback(error);
  };

export const createSecurityHeadersMiddleware = () =>
  createExpressSecurityHeadersMiddleware({
    profileId: "api-serverless",
    extraHeaders: {
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
    },
  });

const getClientIp = (req) => {
  return req.ip || req.socket?.remoteAddress || "unknown";
};

export const createApiRateLimitMiddleware = ({
  limit = 120,
  windowMs = 60_000,
  keyPrefix = "api",
  now = () => Date.now(),
} = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const currentTime = Number(now());
    const bucketKey = `${keyPrefix}:${req.method}:${getClientIp(req)}`;
    const activeWindowStart = currentTime - windowMs;
    const existing = (buckets.get(bucketKey) || []).filter(
      (timestamp) => timestamp > activeWindowStart
    );

    if (existing.length >= limit) {
      const retryAfterMs = Math.max(1_000, existing[0] + windowMs - currentTime);
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    existing.push(currentTime);
    buckets.set(bucketKey, existing);
    return next();
  };
};

export const createUnsafeApiDefaultDenyMiddleware = ({
  allowedMethods = ["GET", "HEAD", "OPTIONS"],
} = {}) => {
  const allowedMethodSet = new Set(allowedMethods.map((method) => String(method).toUpperCase()));

  return (req, res, next) => {
    if (allowedMethodSet.has(String(req.method || "").toUpperCase())) {
      return next();
    }

    return res.status(405).json({
      error: "Write routes are disabled until authenticated middleware is configured.",
    });
  };
};
