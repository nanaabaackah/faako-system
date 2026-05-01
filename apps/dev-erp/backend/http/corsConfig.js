export const DEFAULT_DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5177",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:8888",
];

export const normalizeOrigin = (origin) => String(origin || "").replace(/\/$/, "");

export const createAllowedOriginPolicy = ({
  isProduction,
  corsOriginsEnv = "",
} = {}) => {
  const configuredOrigins = String(corsOriginsEnv)
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

  const defaultDevOrigins =
    !isProduction && configuredOrigins.length === 0 ? DEFAULT_DEV_CORS_ORIGINS : [];
  const allowedOriginSet = new Set([...configuredOrigins, ...defaultDevOrigins]);

  return {
    allowedOriginSet,
    allowAllOrigins: !isProduction && allowedOriginSet.size === 0,
  };
};

export const createCorsOriginValidator = ({
  allowedOriginSet,
  allowAllOrigins = false,
} = {}) => (origin, callback) => {
  if (!origin || allowAllOrigins) {
    callback(null, true);
    return;
  }
  if (allowedOriginSet?.has(normalizeOrigin(origin))) {
    callback(null, true);
    return;
  }
  callback(new Error("Not allowed by CORS"));
};
