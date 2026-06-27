/* eslint-disable no-undef */
import crypto from "crypto";

const DEFAULT_APP_KEY = "reebs-portal";
const DEFAULT_RANGE = "7d";
const RAILWAY_WEBHOOK_PATH = "/api/webhooks/railway";
const APP_ACTIVITY_WEBHOOK_PATH = "/api/webhooks/app-activity";

const RANGE_HOURS = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: null,
};

const ensureAuditLogSchemaStatements = [
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "appKey" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "environment" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "source" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "category" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "severity" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "status" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "summary" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "actorLabel" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT`,
  `ALTER TABLE "auditLog" ADD COLUMN IF NOT EXISTS "externalRef" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "auditLog_externalRef_key" ON "auditLog"("externalRef")`,
  `CREATE INDEX IF NOT EXISTS "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "auditLog_source_createdAt_idx" ON "auditLog"("source", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "auditLog_category_createdAt_idx" ON "auditLog"("category", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "auditLog_severity_createdAt_idx" ON "auditLog"("severity", "createdAt")`,
];

const normalizeString = (value) => String(value || "").trim();

const normalizeOptionalString = (value, max = 255) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.slice(0, max);
};

const resolveAppActivityWebhookUrl = () => {
  const directUrl = normalizeString(
    process.env.DEV_ERP_ACTIVITY_WEBHOOK_URL || process.env.APP_ACTIVITY_WEBHOOK_URL
  );
  if (directUrl) return directUrl;

  const baseUrl = normalizeString(process.env.DEV_ERP_API_BASE_URL || process.env.DEV_API_BASE_URL);
  if (!baseUrl) return "";

  try {
    return new URL(APP_ACTIVITY_WEBHOOK_PATH, baseUrl).toString();
  } catch {
    return "";
  }
};

const getAppActivityWebhookSecret = () =>
  normalizeString(
    process.env.DEV_ERP_ACTIVITY_WEBHOOK_SECRET || process.env.APP_ACTIVITY_WEBHOOK_SECRET
  );

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

const inferSource = (action) => {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT")) return "auth";
  if (action.startsWith("RAILWAY_")) return "railway";
  if (action.includes("INVOICE")) return "integration";
  return "api";
};

const inferCategory = (action) => {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT")) return "access";
  if (action.startsWith("RAILWAY_")) return "incident";
  if (action.includes("ORDER")) return "order";
  if (action.includes("BOOKING")) return "booking";
  if (action.includes("DELIVERY")) return "delivery";
  if (action.includes("DOCUMENT") || action.includes("INVOICE")) return "document";
  if (action.includes("MARKETING")) return "marketing";
  if (action.includes("MAINTENANCE")) return "maintenance";
  if (action.includes("TIMESHEET")) return "timesheet";
  if (action.includes("INVENTORY") || action.includes("PRODUCT")) return "inventory";
  return "admin";
};

const inferSeverity = (action, status) => {
  const normalizedStatus = normalizeString(status).toLowerCase();
  if (normalizedStatus === "failed" || normalizedStatus === "error") return "error";
  if (action.includes("FAILED") || action.includes("ERROR")) return "error";
  if (action.includes("WARN")) return "warning";
  return "info";
};

const inferStatus = (action) =>
  action.includes("FAILED") || action.includes("ERROR") ? "failed" : "ok";

export const getAuditRangeKey = (value) =>
  Object.prototype.hasOwnProperty.call(RANGE_HOURS, value) ? value : DEFAULT_RANGE;

export const getAuditRangeStart = (value) => {
  const rangeKey = getAuditRangeKey(value);
  const hours = RANGE_HOURS[rangeKey];
  if (!hours) return null;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
};

export const parseAuditTake = (value, fallback = 100, max = 300) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export const getEventHeader = (event, key) => {
  const headers = event?.headers;
  if (!headers || typeof headers !== "object") return "";
  return normalizeString(headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]);
};

export const getEventIpAddress = (event) =>
  normalizeOptionalString(getEventHeader(event, "x-forwarded-for").split(",")[0], 120);

export const getRailwayWebhookSecret = () =>
  normalizeString(process.env.RAILWAY_WEBHOOK_SECRET);

export const extractRailwayWebhookSecret = (event = {}) => {
  const authorization = getEventHeader(event, "authorization");
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  return normalizeString(
    event.queryStringParameters?.secret
      || getEventHeader(event, "x-faako-webhook-secret")
      || getEventHeader(event, "x-railway-webhook-secret")
      || getEventHeader(event, "x-webhook-secret")
  );
};

export const getRailwayWebhookDiagnostics = ({
  currentWindowEvents = 0,
  latestEvent = null,
} = {}) => ({
  configured: Boolean(getRailwayWebhookSecret()),
  endpoint: RAILWAY_WEBHOOK_PATH,
  legacyEndpoint: "/api/railwayEvents",
  secretInputs: [
    "Authorization: Bearer <secret>",
    "x-faako-webhook-secret",
    "x-railway-webhook-secret",
    "x-webhook-secret",
    "?secret=<secret>",
  ],
  currentWindowEvents,
  latestEventAt: latestEvent?.createdAt
    ? new Date(latestEvent.createdAt).toISOString()
    : null,
});

export const ensureExtendedAuditLogSchema = async (client) => {
  for (const statement of ensureAuditLogSchemaStatements) {
    try {
      await client.query(statement);
    } catch (error) {
      console.warn("Audit log schema check failed:", error?.message || error);
    }
  }
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

  const actionLabel = normalizeString(action).replace(/_/g, " ").toLowerCase();
  if (!actionLabel) return "Audit event";
  const sentence = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1);
  if (targetType && targetId) return `${sentence} for ${targetType} ${targetId}`;
  if (targetType) return `${sentence} for ${targetType}`;
  if (actorLabel) return `${sentence} by ${actorLabel}`;
  return sentence;
};

export const buildAuditEventData = (data = {}, { environment = process.env.APP_ENV || process.env.NODE_ENV || "development" } = {}) => {
  const action = normalizeOptionalString(data.action, 120) || "UNKNOWN";
  const status = normalizeOptionalString(data.status, 80) || inferStatus(action);
  const severity = normalizeOptionalString(data.severity, 40) || inferSeverity(action, status);
  const source = normalizeOptionalString(data.source, 80) || inferSource(action);
  const category = normalizeOptionalString(data.category, 80) || inferCategory(action);
  const actorLabel = normalizeOptionalString(data.actorLabel, 160);
  const targetType = normalizeOptionalString(data.targetType ?? data.resourceType, 80);
  const targetId = normalizeOptionalString(data.targetId ?? data.resourceId, 120);

  return {
    organizationId: toNullableInt(data.organizationId),
    userId: toNullableInt(data.userId),
    action,
    targetType,
    targetId,
    appKey: normalizeOptionalString(data.appKey, 80) || DEFAULT_APP_KEY,
    environment: normalizeOptionalString(data.environment, 80) || normalizeOptionalString(environment, 80),
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
    metadata: normalizeMetadata(data.metadata),
    ipAddress: normalizeOptionalString(data.ipAddress, 120),
  };
};

const emitAppActivity = async (record) => {
  const webhookUrl = resolveAppActivityWebhookUrl();
  const webhookSecret = getAppActivityWebhookSecret();
  if (!webhookUrl || !webhookSecret || typeof fetch !== "function") return;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        appKey: DEFAULT_APP_KEY,
        eventId: record.externalRef || record.requestId || undefined,
        action: record.action,
        category: record.category,
        severity: record.severity,
        status: record.status,
        targetType: record.targetType,
        targetId: record.targetId,
        actorType: record.actorType,
        actorLabel: record.actorLabel,
        requestId: record.requestId,
        summary: record.summary,
        metadata: {
          localAuditRecorded: true,
          localEnvironment: record.environment,
        },
      }),
    });

    if (!response.ok) {
      console.warn("Dev ERP activity webhook rejected REEBS audit event:", response.status);
    }
  } catch (error) {
    console.warn("Dev ERP activity webhook failed for REEBS audit event:", error?.message || error);
  }
};

export const writeAuditLog = async (client, data = {}, options = {}) => {
  await ensureExtendedAuditLogSchema(client);
  const record = buildAuditEventData(data, options);
  await client.query(
    `INSERT INTO "auditLog" (
      "organizationId",
      "userId",
      "action",
      "targetType",
      "targetId",
      "appKey",
      "environment",
      "source",
      "category",
      "severity",
      "status",
      "summary",
      "actorType",
      "actorLabel",
      "requestId",
      "externalRef",
      "metadata",
      "ipAddress",
      "createdAt"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()
    )
    ON CONFLICT ("externalRef") DO NOTHING`,
    [
      record.organizationId,
      record.userId,
      record.action,
      record.targetType,
      record.targetId,
      record.appKey,
      record.environment,
      record.source,
      record.category,
      record.severity,
      record.status,
      record.summary,
      record.actorType,
      record.actorLabel,
      record.requestId,
      record.externalRef,
      record.metadata,
      record.ipAddress,
    ]
  );
  void emitAppActivity(record);
  return record;
};

export const serializeAuditRow = (row = {}) => ({
  id: row.id,
  organizationId: row.organizationId ?? null,
  userId: row.userId ?? null,
  action: row.action,
  targetType: row.targetType ?? null,
  targetId: row.targetId ?? null,
  appKey: row.appKey ?? DEFAULT_APP_KEY,
  environment: row.environment ?? null,
  source: row.source ?? inferSource(row.action || ""),
  category: row.category ?? inferCategory(row.action || ""),
  severity: row.severity ?? inferSeverity(row.action || "", row.status || ""),
  status: row.status ?? inferStatus(row.action || ""),
  summary: buildAuditSummary(row),
  actorType: row.actorType ?? (row.userId ? "user" : "system"),
  actorLabel: row.actorLabel ?? null,
  requestId: row.requestId ?? null,
  externalRef: row.externalRef ?? null,
  metadata: row.metadata ?? null,
  ipAddress: row.ipAddress ?? null,
  createdAt: row.createdAt,
});

const buildAuditWhereClause = ({
  organizationId = null,
  range = DEFAULT_RANGE,
  source = "",
  category = "",
  severity = "",
  q = "",
} = {}) => {
  const clauses = [];
  const values = [];
  let index = 1;

  if (organizationId) {
    clauses.push(`("organizationId" = $${index} OR "organizationId" IS NULL)`);
    values.push(organizationId);
    index += 1;
  }

  const since = getAuditRangeStart(range);
  if (since) {
    clauses.push(`"createdAt" >= $${index}`);
    values.push(since.toISOString());
    index += 1;
  }

  const normalizedSource = normalizeOptionalString(source, 80);
  if (normalizedSource) {
    clauses.push(`"source" = $${index}`);
    values.push(normalizedSource);
    index += 1;
  }

  const normalizedCategory = normalizeOptionalString(category, 80);
  if (normalizedCategory) {
    clauses.push(`"category" = $${index}`);
    values.push(normalizedCategory);
    index += 1;
  }

  const normalizedSeverity = normalizeOptionalString(severity, 40);
  if (normalizedSeverity) {
    clauses.push(`"severity" = $${index}`);
    values.push(normalizedSeverity);
    index += 1;
  }

  const searchTerm = normalizeOptionalString(q, 120);
  if (searchTerm) {
    clauses.push(
      `(
        "action" ILIKE $${index}
        OR COALESCE("summary", '') ILIKE $${index}
        OR COALESCE("targetType", '') ILIKE $${index}
        OR COALESCE("targetId", '') ILIKE $${index}
        OR COALESCE("actorLabel", '') ILIKE $${index}
      )`
    );
    values.push(`%${searchTerm}%`);
    index += 1;
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
};

export const listAuditLogs = async (client, options = {}) => {
  await ensureExtendedAuditLogSchema(client);
  const take = parseAuditTake(options.take, 100, 300);
  const { whereSql, values } = buildAuditWhereClause(options);
  const limitIndex = values.length + 1;
  const result = await client.query(
    `SELECT
       id,
       "organizationId",
       "userId",
       action,
       "targetType",
       "targetId",
       "appKey",
       environment,
       source,
       category,
       severity,
       status,
       summary,
       "actorType",
       "actorLabel",
       "requestId",
       "externalRef",
       metadata,
       "ipAddress",
       "createdAt"
     FROM "auditLog"
     ${whereSql}
     ORDER BY "createdAt" DESC
     LIMIT $${limitIndex}`,
    [...values, take]
  );

  return result.rows.map(serializeAuditRow);
};

export const unwrapRailwayWebhookPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  const nestedCandidates = [
    payload.payload,
    payload.data,
    payload.eventPayload,
    payload.webhook,
  ];
  const usefulNested = nestedCandidates.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      (
        candidate.deployment ||
        candidate.service ||
        candidate.project ||
        candidate.environment ||
        candidate.alert ||
        candidate.type ||
        candidate.eventType ||
        candidate.status
      )
  );

  return usefulNested || payload;
};

export const getRailwayWebhookMetadata = (rawPayload = {}, payload = rawPayload) => {
  if (payload === rawPayload) return rawPayload;
  return {
    event: payload,
    envelope: rawPayload,
  };
};

export const buildRailwayAuditEvent = (rawPayload = {}) => {
  const payload = unwrapRailwayWebhookPayload(rawPayload);
  const eventType = normalizeOptionalString(
    payload?.type
      || payload?.eventType
      || payload?.eventName
      || payload?.event
      || payload?.trigger
      || rawPayload?.type
      || "event",
    80
  ) || "event";
  const status = normalizeOptionalString(
    payload?.status
      || payload?.deployment?.status
      || payload?.deploymentStatus
      || payload?.alert?.state
      || rawPayload?.status
      || "received",
    80
  ) || "received";
  const serviceName = normalizeOptionalString(
    payload?.service?.name
      || payload?.deployment?.service?.name
      || payload?.serviceName
      || payload?.resource?.name
      || payload?.alert?.service?.name
      || payload?.project?.name,
    120
  );
  const projectName = normalizeOptionalString(
    payload?.project?.name
      || payload?.deployment?.project?.name
      || payload?.projectName,
    120
  );
  const environmentName = normalizeOptionalString(
    payload?.environment?.name
      || payload?.deployment?.environment?.name
      || payload?.environmentName,
    80
  );
  const eventId =
    normalizeOptionalString(
      payload?.id
        || payload?.eventId
        || payload?.deliveryId
        || payload?.deployment?.id
        || payload?.deploymentId
        || rawPayload?.id,
      160
    )
    || crypto.createHash("sha256").update(JSON.stringify(payload || {})).digest("hex");
  const combinedText = `${eventType} ${status}`.toLowerCase();
  const severity = ["failed", "crashed", "error", "alert", "degraded"].some((token) =>
    combinedText.includes(token)
  )
    ? "error"
    : ["warning", "queued", "retry"].some((token) => combinedText.includes(token))
      ? "warning"
      : "info";
  const summary = [
    projectName || "Railway project",
    serviceName ? `service ${serviceName}` : "",
    environmentName ? `environment ${environmentName}` : "",
    eventType,
    status ? `(${status})` : "",
  ].filter(Boolean).join(" ");

  return buildAuditEventData({
    action: `RAILWAY_${eventType.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
    targetType: "service",
    targetId: serviceName || projectName || eventId,
    source: "railway",
    category: "incident",
    severity,
    status,
    summary,
    actorType: "system",
    actorLabel: "Railway",
    externalRef: eventId,
    metadata: getRailwayWebhookMetadata(rawPayload, payload),
  });
};
