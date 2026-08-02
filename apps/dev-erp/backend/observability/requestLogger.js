const formatDurationMs = (startTime) => {
  const elapsedNs = globalThis.process.hrtime.bigint() - startTime;
  return Number(elapsedNs) / 1_000_000;
};

const normalizeRequestPath = (req) =>
  typeof req?.originalUrl === "string" && req.originalUrl
    ? req.originalUrl.split("?")[0]
    : req?.path || req?.url || "";

const DEFAULT_IGNORED_AUDIT_PATHS = new Set([
  "/api/auth/session",
  "/api/auth/refresh",
  "/api/currency/display-rate",
  "/api/dashboard/verse-of-day",
  "/api/dashboard/weather",
]);

const shouldPersistDefault = ({ req, res, requestPath }) => {
  if (!requestPath || DEFAULT_IGNORED_AUDIT_PATHS.has(requestPath)) return false;
  if (requestPath.startsWith("/api/audit-logs")) return false;
  if (requestPath.startsWith("/api/public/")) return false;
  if (requestPath.startsWith("/api/webhooks/")) return false;
  if (res.statusCode >= 500) return true;
  return !["GET", "HEAD", "OPTIONS"].includes(String(req.method || "").toUpperCase());
};

const buildAction = (method, requestPath, statusCode) => {
  const normalizedPath =
    String(requestPath || "/api")
      .replace(/^\/api\/?/, "")
      .replace(/\/+/g, "_")
      .replace(/[^a-z0-9_:-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72) || "root";
  const statusLabel = statusCode >= 500 ? "FAILED" : "REQUEST";
  return `API_${String(method || "GET").toUpperCase()}_${normalizedPath}_${statusLabel}`.slice(0, 120);
};

export const createRequestLogger = ({
  logger = console,
  auditWriter = null,
  appKey = "dev-erp",
  environment = "development",
  shouldPersist = shouldPersistDefault,
  persistDiagnosticsAsAudit = false,
} = {}) => {
  const log =
    typeof logger?.info === "function"
      ? logger.info.bind(logger)
      : (fields, message) => console.log(message, fields);

  return (req, res, next) => {
    const startedAt = globalThis.process.hrtime.bigint();
    const requestPath = normalizeRequestPath(req);

    res.on("finish", () => {
      const duration = formatDurationMs(startedAt);
      const durationMs = duration.toFixed(1);
      const contentLength = res.getHeader("content-length");
      const method = String(req.method || "GET").toUpperCase();
      const statusCode = Number(res.statusCode || 0);

      log(
        {
          application: appKey,
          environment,
          eventName: "api.request.completed",
          requestId: req.requestId || req.headers?.["x-request-id"],
          organisationId: req.user?.organizationId,
          userId: req.user?.userId,
          method,
          path: requestPath,
          statusCode,
          durationMs: Number(durationMs),
          contentLength:
            contentLength === undefined || contentLength === null
              ? undefined
              : String(contentLength),
        },
        "API request completed"
      );

      if (!persistDiagnosticsAsAudit || typeof auditWriter !== "function") return;
      if (!shouldPersist({ req, res, requestPath, durationMs: duration })) return;

      const severity = statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "info";
      const status = statusCode >= 500 ? "failed" : statusCode >= 400 ? "rejected" : "ok";
      const actorLabel = req.user?.fullName || req.user?.email || null;

      auditWriter({
        userId: req.user?.userId,
        organizationId: req.user?.organizationId,
        action: buildAction(method, requestPath, statusCode),
        targetType: "api_route",
        targetId: requestPath,
        appKey,
        environment,
        source: "api",
        category: "request",
        severity,
        status,
        summary: `${method} ${requestPath} completed with ${statusCode}.`,
        actorType: actorLabel ? "user" : "system",
        actorLabel,
        requestId: String(req.requestId || req.headers?.["x-request-id"] || ""),
        ipAddress: String(req.headers?.["x-forwarded-for"] || req.ip || "").split(",")[0].trim(),
        metadata: {
          method,
          path: requestPath,
          statusCode,
          durationMs: Number(duration.toFixed(1)),
          contentLength:
            contentLength === undefined || contentLength === null ? null : String(contentLength),
        },
      });
    });

    next();
  };
};
