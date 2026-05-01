const DEFAULT_AUDIT_APP_KEY = "dev-erp";
const DEFAULT_RANGE_KEY = "7d";

const RANGE_HOURS = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: null,
};

const normalizeString = (value) => String(value || "").trim();

const normalizeOptionalString = (value, max = 255) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.slice(0, max);
};

const toNullableInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value ?? null;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
};

const inferAuditSource = (action) => {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT") || action.startsWith("SESSION")) {
    return "auth";
  }
  if (action.startsWith("RAILWAY_")) {
    return "railway";
  }
  if (action.includes("REPORT")) {
    return "job";
  }
  if (action.includes("ERROR") || action.includes("EXCEPTION")) {
    return "system";
  }
  return "api";
};

const inferAuditCategory = (action) => {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT") || action.startsWith("SESSION")) {
    return "access";
  }
  if (action.startsWith("RAILWAY_")) {
    return "incident";
  }
  if (action.includes("REPORT")) {
    return "admin";
  }
  if (action.includes("INVOICE")) {
    return "financial";
  }
  return "admin";
};

const inferAuditSeverity = (action, status) => {
  const normalizedStatus = normalizeString(status).toLowerCase();
  if (normalizedStatus === "failed" || normalizedStatus === "error") return "error";
  if (action.includes("FAILED") || action.includes("ERROR") || action.includes("EXCEPTION")) {
    return "error";
  }
  if (action.includes("WARN") || action.includes("LOCKED")) return "warning";
  return "info";
};

const inferAuditStatus = (action) => {
  if (action.includes("FAILED") || action.includes("ERROR") || action.includes("EXCEPTION")) {
    return "failed";
  }
  return "ok";
};

export const buildAuditSummary = ({
  action,
  summary,
  targetType,
  targetId,
  actorLabel,
} = {}) => {
  const normalizedSummary = normalizeOptionalString(summary, 280);
  if (normalizedSummary) return normalizedSummary;

  const normalizedAction = normalizeString(action).replace(/_/g, " ").toLowerCase();
  if (!normalizedAction) return "Audit event";

  const actionLabel =
    normalizedAction.charAt(0).toUpperCase() + normalizedAction.slice(1);
  const targetLabel = normalizeOptionalString(targetType, 80);
  const targetIdentifier = normalizeOptionalString(targetId, 80);
  const actor = normalizeOptionalString(actorLabel, 120);

  if (targetLabel && targetIdentifier) {
    return `${actionLabel} for ${targetLabel} ${targetIdentifier}`;
  }
  if (targetLabel) {
    return `${actionLabel} for ${targetLabel}`;
  }
  if (actor) {
    return `${actionLabel} by ${actor}`;
  }
  return actionLabel;
};

export const getAuditRangeKey = (value) =>
  Object.prototype.hasOwnProperty.call(RANGE_HOURS, value) ? value : DEFAULT_RANGE_KEY;

export const getAuditRangeStart = (value) => {
  const rangeKey = getAuditRangeKey(value);
  const hours = RANGE_HOURS[rangeKey];
  if (!hours) return null;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
};

export const getRequestIp = (req) =>
  normalizeOptionalString(
    String(req?.headers?.["x-forwarded-for"] || req?.ip || "").split(",")[0],
    120
  );

export const buildAuditEventData = (data = {}, { environment = "development" } = {}) => {
  const action = normalizeOptionalString(data.action, 120) || "UNKNOWN";
  const status = normalizeOptionalString(data.status, 80) || inferAuditStatus(action);
  const severity =
    normalizeOptionalString(data.severity, 40) || inferAuditSeverity(action, status);
  const source = normalizeOptionalString(data.source, 80) || inferAuditSource(action);
  const category =
    normalizeOptionalString(data.category, 80) || inferAuditCategory(action);
  const actorLabel = normalizeOptionalString(data.actorLabel, 160);
  const targetType =
    normalizeOptionalString(data.targetType ?? data.resourceType, 80);
  const targetId =
    normalizeOptionalString(data.targetId ?? data.resourceId, 120);

  return {
    organizationId: toNullableInt(data.organizationId),
    userId: toNullableInt(data.userId),
    action,
    targetType,
    targetId,
    metadata: normalizeMetadata(data.metadata),
    ipAddress: normalizeOptionalString(data.ipAddress, 120),
    appKey: normalizeOptionalString(data.appKey, 80) || DEFAULT_AUDIT_APP_KEY,
    environment: normalizeOptionalString(data.environment, 80) || environment,
    source,
    category,
    severity,
    status,
    summary: buildAuditSummary({
      action,
      summary: data.summary,
      targetType,
      targetId,
      actorLabel,
    }),
    actorType: normalizeOptionalString(data.actorType, 40)
      || (toNullableInt(data.userId) ? "user" : "system"),
    actorLabel,
    requestId: normalizeOptionalString(data.requestId, 120),
    externalRef: normalizeOptionalString(data.externalRef, 160),
  };
};

export const writeAuditLog = (prisma, data = {}, options = {}) => {
  if (!prisma?.auditLog?.create) return Promise.resolve(null);
  return prisma.auditLog
    .create({
      data: buildAuditEventData(data, options),
    })
    .catch(() => null);
};

export const buildAuditLogWhere = ({
  organizationId = null,
  includeGlobalEvents = true,
  range = DEFAULT_RANGE_KEY,
  source = "",
  category = "",
  severity = "",
  q = "",
} = {}) => {
  const where = {};
  const since = getAuditRangeStart(range);
  const normalizedSource = normalizeOptionalString(source, 80);
  const normalizedCategory = normalizeOptionalString(category, 80);
  const normalizedSeverity = normalizeOptionalString(severity, 40);
  const searchTerm = normalizeOptionalString(q, 120);

  if (since) {
    where.createdAt = { gte: since };
  }

  if (normalizedSource) {
    where.source = normalizedSource;
  }
  if (normalizedCategory) {
    where.category = normalizedCategory;
  }
  if (normalizedSeverity) {
    where.severity = normalizedSeverity;
  }

  if (organizationId) {
    where.OR = includeGlobalEvents
      ? [{ organizationId }, { organizationId: null }]
      : [{ organizationId }];
  }

  if (searchTerm) {
    const searchClause = {
      OR: [
        { action: { contains: searchTerm, mode: "insensitive" } },
        { summary: { contains: searchTerm, mode: "insensitive" } },
        { targetType: { contains: searchTerm, mode: "insensitive" } },
        { targetId: { contains: searchTerm, mode: "insensitive" } },
        { actorLabel: { contains: searchTerm, mode: "insensitive" } },
      ],
    };

    if (where.OR) {
      where.AND = [{ OR: where.OR }, searchClause];
      delete where.OR;
    } else {
      Object.assign(where, searchClause);
    }
  }

  return where;
};

export const serializeAuditLog = (log = {}) => ({
  id: log.id,
  organizationId: log.organizationId ?? null,
  userId: log.userId ?? null,
  action: log.action,
  targetType: log.targetType ?? null,
  targetId: log.targetId ?? null,
  metadata: log.metadata ?? null,
  ipAddress: log.ipAddress ?? null,
  createdAt: log.createdAt,
  appKey: log.appKey ?? DEFAULT_AUDIT_APP_KEY,
  environment: log.environment ?? null,
  source: log.source ?? inferAuditSource(log.action || ""),
  category: log.category ?? inferAuditCategory(log.action || ""),
  severity: log.severity ?? inferAuditSeverity(log.action || "", log.status || ""),
  status: log.status ?? inferAuditStatus(log.action || ""),
  summary: buildAuditSummary(log),
  actorType: log.actorType ?? (log.userId ? "user" : "system"),
  actorLabel: log.actorLabel ?? null,
  requestId: log.requestId ?? null,
  externalRef: log.externalRef ?? null,
});

export const parseAuditTake = (value, fallback = 100, max = 300) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};
