import { DEFAULT_MONITORING_OPTIONS } from "./monitoring.constants.js";
import { findDependencyCycles } from "./monitoring.dependencies.js";
import { validateRegistry } from "./monitoring.validation.js";

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const normalizeEnvironment = (value) => String(value || "development").toLowerCase() === "production"
  ? "production"
  : "development";

const safeHostname = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.hostname : null;
  } catch {
    return null;
  }
};

const safeHttpTarget = (value, path = "") => {
  try {
    const parsed = new URL(path || "", value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
};

const baseDefinition = (options, definition) => ({
  enabled: true,
  intervalSeconds: definition.critical ? 60 : definition.category === "INFRASTRUCTURE" ? 600 : 300,
  timeoutMs: options.defaultTimeoutMs,
  retryCount: definition.critical ? 1 : 0,
  critical: false,
  provider: null,
  dependencies: [],
  safeTargetLabel: null,
  metadata: {},
  runtimeTarget: null,
  ...definition,
});

const httpDefinition = (options, definition, target, path = "") => {
  const runtimeTarget = safeHttpTarget(target, path);
  return baseDefinition(options, {
    checkType: "HTTP",
    expectedStatusCodes: [200],
    ...definition,
    safeTargetLabel: runtimeTarget ? safeHostname(runtimeTarget) : null,
    runtimeTarget,
  });
};

export const readMonitoringOptions = (env = process.env) => ({
  enabled: parseBoolean(env.MONITORING_ENABLED, DEFAULT_MONITORING_OPTIONS.enabled),
  maxConcurrency: parseInteger(env.MONITORING_MAX_CONCURRENCY, DEFAULT_MONITORING_OPTIONS.maxConcurrency, 1, 20),
  defaultTimeoutMs: parseInteger(env.MONITORING_DEFAULT_TIMEOUT_MS, DEFAULT_MONITORING_OPTIONS.defaultTimeoutMs, 250, 30000),
  incidentFailureThreshold: parseInteger(env.MONITORING_INCIDENT_FAILURE_THRESHOLD, DEFAULT_MONITORING_OPTIONS.incidentFailureThreshold, 2, 10),
  incidentRecoveryThreshold: parseInteger(env.MONITORING_INCIDENT_RECOVERY_THRESHOLD, DEFAULT_MONITORING_OPTIONS.incidentRecoveryThreshold, 1, 10),
  retentionDays: parseInteger(env.MONITORING_RETENTION_DAYS, DEFAULT_MONITORING_OPTIONS.retentionDays, 30, 365),
  schedulerTickMs: parseInteger(env.MONITORING_SCHEDULER_TICK_MS, DEFAULT_MONITORING_OPTIONS.schedulerTickMs, 5000, 60000),
  degradedLatencyMs: parseInteger(env.MONITORING_DEGRADED_LATENCY_MS, DEFAULT_MONITORING_OPTIONS.degradedLatencyMs, 100, 10000),
});

export const buildMonitoringRegistry = (env = process.env) => {
  const options = readMonitoringOptions(env);
  const environment = normalizeEnvironment(env.APP_ENV || env.NODE_ENV);
  const devApi = env.MONITOR_DEV_ERP_API_URL || env.DEV_ERP_API_BASE_URL || env.DEV_API_BASE_URL;
  const faakoApi = env.MONITOR_FAAKO_API_URL || env.FAAKO_API_BASE_URL;
  const stroaneApi = env.MONITOR_STROANE_API_URL || env.STROANE_API_BASE_URL;
  const reebsApi = env.MONITOR_REEBS_API_URL || env.REEBS_API_BASE_URL;
  const frontendUrl = env.MONITOR_DEV_ERP_FRONTEND_URL || env.FRONTEND_URL;

  const services = [
    httpDefinition(options, { key: "client-portal", name: "Client Portal", category: "BUSINESS", environment, provider: "Cloudflare", dependencies: ["dev-erp-api", "cloudflare", "dns", "ssl"], critical: true }, frontendUrl, "/"),
    httpDefinition(options, { key: "bookings", name: "Bookings", category: "BUSINESS", environment, provider: "Dev ERP", dependencies: ["dev-erp-api", "dev-erp-postgresql"], critical: true }, devApi, "/healthz"),
    httpDefinition(options, { key: "payments", name: "Payments", category: "BUSINESS", environment, provider: "Paystack", dependencies: ["paystack", "dev-erp-api"], critical: true }, env.MONITOR_PAYSTACK_STATUS_URL),
    httpDefinition(options, { key: "inventory", name: "Inventory", category: "BUSINESS", environment, provider: "REEBS", dependencies: ["reebs-api", "reebs-postgresql"] }, reebsApi, "/health"),
    httpDefinition(options, { key: "email-notifications", name: "Email Notifications", category: "BUSINESS", environment, provider: "Resend", dependencies: ["resend", "email-queue"] }, env.MONITOR_RESEND_STATUS_URL),
    httpDefinition(options, { key: "authentication", name: "Authentication", category: "BUSINESS", environment, provider: "Dev ERP", dependencies: ["dev-erp-api", "dev-erp-postgresql"], critical: true }, devApi, "/healthz"),

    httpDefinition(options, { key: "dev-erp-api", name: "Dev ERP API", category: "API", environment, provider: "Railway", dependencies: ["dev-erp-postgresql", "railway", "cloudflare"], critical: true }, devApi, "/healthz"),
    httpDefinition(options, { key: "faako-api", name: "Faako API", category: "API", environment, provider: "Railway" }, faakoApi, "/health"),
    httpDefinition(options, { key: "stroane-api", name: "Stroane API", category: "API", environment, provider: "Railway", dependencies: ["stroane-postgresql"] }, stroaneApi, "/health"),
    httpDefinition(options, { key: "reebs-api", name: "REEBS API", category: "API", environment, provider: "Railway", dependencies: ["reebs-postgresql"] }, reebsApi, "/health"),

    baseDefinition(options, { key: "dev-erp-postgresql", name: "Dev ERP PostgreSQL", category: "DATABASE", environment, provider: "PostgreSQL", checkType: "DATABASE", critical: true, safeTargetLabel: env.DATABASE_URL || env.DATABASE_URL_DEVELOPMENT || env.DATABASE_URL_PRODUCTION ? "Dev ERP database" : null, runtimeTarget: env.DATABASE_URL || env.DATABASE_URL_DEVELOPMENT || env.DATABASE_URL_PRODUCTION ? { queryKey: "dev-erp" } : null }),
    httpDefinition(options, { key: "stroane-postgresql", name: "Stroane PostgreSQL", category: "DATABASE", environment, provider: "PostgreSQL" }, stroaneApi, "/health"),
    httpDefinition(options, { key: "reebs-postgresql", name: "REEBS PostgreSQL", category: "DATABASE", environment, provider: "PostgreSQL" }, reebsApi, "/health"),

    httpDefinition(options, { key: "cloudflare", name: "Cloudflare", category: "INFRASTRUCTURE", environment, provider: "Cloudflare" }, env.MONITOR_CLOUDFLARE_STATUS_URL),
    httpDefinition(options, { key: "railway", name: "Railway", category: "INFRASTRUCTURE", environment, provider: "Railway" }, env.MONITOR_RAILWAY_STATUS_URL),
    baseDefinition(options, { key: "redis", name: "Redis", category: "INFRASTRUCTURE", environment, provider: "Redis", checkType: "TCP" }),
    httpDefinition(options, { key: "storage", name: "Storage", category: "INFRASTRUCTURE", environment, provider: "Storage" }, env.MONITOR_STORAGE_STATUS_URL),
    baseDefinition(options, { key: "ssl", name: "SSL", category: "INFRASTRUCTURE", environment, provider: "TLS", checkType: "SSL", intervalSeconds: 3600, safeTargetLabel: safeHostname(frontendUrl), runtimeTarget: safeHostname(frontendUrl) ? { hostname: safeHostname(frontendUrl), port: 443 } : null }),
    baseDefinition(options, { key: "dns", name: "DNS", category: "INFRASTRUCTURE", environment, provider: "DNS", checkType: "DNS", safeTargetLabel: safeHostname(frontendUrl), runtimeTarget: safeHostname(frontendUrl) ? { hostname: safeHostname(frontendUrl) } : null }),

    httpDefinition(options, { key: "paystack", name: "Paystack", category: "EXTERNAL", environment, provider: "Paystack" }, env.MONITOR_PAYSTACK_STATUS_URL),
    httpDefinition(options, { key: "mtn-momo", name: "MTN MoMo", category: "EXTERNAL", environment, provider: "MTN" }, env.MONITOR_MTN_MOMO_STATUS_URL),
    httpDefinition(options, { key: "whatsapp", name: "WhatsApp", category: "EXTERNAL", environment, provider: "Meta" }, env.MONITOR_WHATSAPP_STATUS_URL),
    httpDefinition(options, { key: "resend", name: "Resend", category: "EXTERNAL", environment, provider: "Resend" }, env.MONITOR_RESEND_STATUS_URL),
    httpDefinition(options, { key: "google-maps", name: "Google Maps", category: "EXTERNAL", environment, provider: "Google" }, env.MONITOR_GOOGLE_MAPS_STATUS_URL),
    httpDefinition(options, { key: "openai", name: "OpenAI", category: "EXTERNAL", environment, provider: "OpenAI" }, env.MONITOR_OPENAI_STATUS_URL),
    httpDefinition(options, { key: "anthropic", name: "Anthropic", category: "EXTERNAL", environment, provider: "Anthropic" }, env.MONITOR_ANTHROPIC_STATUS_URL),

    baseDefinition(options, { key: "scheduler", name: "Scheduler", category: "WORKER", environment, provider: "Dev ERP", checkType: "WORKER", runtimeTarget: env.MONITOR_SCHEDULER_HEARTBEAT_AT ? { heartbeatAt: env.MONITOR_SCHEDULER_HEARTBEAT_AT, expectedIntervalSeconds: 300 } : null }),
    baseDefinition(options, { key: "queue-worker", name: "Queue Worker", category: "WORKER", environment, provider: "Dev ERP", checkType: "WORKER", runtimeTarget: env.MONITOR_QUEUE_WORKER_HEARTBEAT_AT ? { heartbeatAt: env.MONITOR_QUEUE_WORKER_HEARTBEAT_AT, expectedIntervalSeconds: 300 } : null }),
    baseDefinition(options, { key: "email-queue", name: "Email Queue", category: "WORKER", environment, provider: "Dev ERP", checkType: "WORKER", runtimeTarget: env.MONITOR_EMAIL_QUEUE_HEARTBEAT_AT ? { heartbeatAt: env.MONITOR_EMAIL_QUEUE_HEARTBEAT_AT, expectedIntervalSeconds: 300 } : null }),
    baseDefinition(options, { key: "backup-worker", name: "Backup Worker", category: "WORKER", environment, provider: "Dev ERP", checkType: "WORKER", intervalSeconds: 600, runtimeTarget: env.MONITOR_BACKUP_WORKER_HEARTBEAT_AT ? { heartbeatAt: env.MONITOR_BACKUP_WORKER_HEARTBEAT_AT, expectedIntervalSeconds: 86400 } : null }),
    baseDefinition(options, { key: "audit-logger", name: "Audit Logger", category: "WORKER", environment, provider: "Dev ERP", checkType: "WORKER", runtimeTarget: env.MONITOR_AUDIT_LOGGER_HEARTBEAT_AT ? { heartbeatAt: env.MONITOR_AUDIT_LOGGER_HEARTBEAT_AT, expectedIntervalSeconds: 300 } : null }),
  ];

  const disabled = new Set(String(env.MONITORING_DISABLED_SERVICES || "").split(",").map((key) => key.trim()).filter(Boolean));
  const resolved = services.map((service) => ({ ...service, enabled: service.enabled && !disabled.has(service.key) }));
  const errors = validateRegistry(resolved);
  if (errors.length) throw new Error(`Invalid monitoring registry: ${errors.map((entry) => `${entry.key} (${entry.errors.join(", ")})`).join("; ")}`);
  const cycles = findDependencyCycles(resolved);
  if (cycles.length) throw new Error(`Circular monitoring dependencies: ${cycles.map((cycle) => cycle.join(" -> ")).join("; ")}`);
  return { services: resolved, options };
};

export const toPersistedRegistryService = (service) => ({
  key: service.key,
  name: service.name,
  category: service.category,
  environment: service.environment,
  provider: service.provider,
  checkType: service.checkType,
  enabled: service.enabled,
  intervalSeconds: service.intervalSeconds,
  timeoutMs: service.timeoutMs,
  retryCount: service.retryCount,
  critical: service.critical,
  safeTargetLabel: service.safeTargetLabel,
  metadata: service.metadata,
});
