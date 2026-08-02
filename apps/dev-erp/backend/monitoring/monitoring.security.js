const SENSITIVE_KEY_PATTERN = /(authorization|cookie|secret|token|password|connection|string|databaseurl|apikey|private|credential)/i;

export const sanitizeText = (value, maxLength = 240) => {
  const normalized = String(value || "").replace(/[\r\n\t]+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

export const sanitizeMonitoringDetails = (details, depth = 0) => {
  if (!details || typeof details !== "object" || Array.isArray(details) || depth > 2) return null;
  const safeEntries = Object.entries(details)
    .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
    .slice(0, 20)
    .map(([key, value]) => {
      if (value === null || typeof value === "boolean" || typeof value === "number") return [key, value];
      if (typeof value === "string") return [key, sanitizeText(value, 180)];
      if (typeof value === "object" && !Array.isArray(value)) return [key, sanitizeMonitoringDetails(value, depth + 1)];
      return [key, null];
    });
  return Object.fromEntries(safeEntries);
};

export const sanitizeCheckResult = (result = {}) => ({
  status: ["HEALTHY", "DEGRADED", "DOWN", "UNKNOWN"].includes(result.status) ? result.status : "UNKNOWN",
  latencyMs: Number.isFinite(Number(result.latencyMs)) ? Math.max(0, Math.round(Number(result.latencyMs))) : null,
  httpStatus: Number.isInteger(Number(result.httpStatus)) ? Number(result.httpStatus) : null,
  startedAt: new Date(result.startedAt || Date.now()).toISOString(),
  completedAt: new Date(result.completedAt || Date.now()).toISOString(),
  errorCode: sanitizeText(result.errorCode, 60),
  errorSummary: sanitizeText(result.errorSummary, 180),
  details: sanitizeMonitoringDetails(result.details),
});

export const toSafeService = (service = {}) => ({
  id: service.id,
  key: service.key,
  name: service.name,
  category: service.category,
  environment: service.environment,
  provider: service.provider ?? null,
  checkType: service.checkType,
  enabled: Boolean(service.enabled),
  intervalSeconds: service.intervalSeconds,
  timeoutMs: service.timeoutMs,
  retryCount: service.retryCount,
  critical: Boolean(service.critical),
  safeTargetLabel: service.safeTargetLabel ?? null,
  metadata: sanitizeMonitoringDetails(service.metadata),
});

export const createManualCheckRateLimit = ({ windowMs = 60_000, maxRequests = 6 } = {}) => {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.user?.userId || req.ip || "unknown"}:${req.params?.id || "service"}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 1000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: "Too many manual health checks.", retryAfterSeconds });
    }
    return next();
  };
};

export const createMonitoringMutationRateLimit = ({ windowMs = 60_000, maxRequests = 30 } = {}) => {
  const limiter = createManualCheckRateLimit({ windowMs, maxRequests });
  return (req, res, next) => limiter(req, res, next);
};
