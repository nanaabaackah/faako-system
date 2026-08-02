import { DEFAULT_ALERT_RULES } from "./alert.constants.js";

const boolean = (value, fallback = false) => value === undefined || value === null || value === "" ? fallback : String(value).toLowerCase() === "true";
const integer = (value, fallback, min, max) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback; };

export const buildIncidentResponseOptions = (env = process.env) => ({
  enabled: boolean(env.MONITORING_ALERTS_ENABLED, false),
  cooldownMinutes: integer(env.MONITORING_ALERT_COOLDOWN_MINUTES, 15, 1, 10080),
  maxRetries: integer(env.MONITORING_NOTIFICATION_MAX_RETRIES, 3, 1, 10),
  retryDelayMs: integer(env.MONITORING_NOTIFICATION_RETRY_DELAY_MS, 30_000, 1000, 3_600_000),
  escalationIntervalMs: integer(env.MONITORING_ESCALATION_INTERVAL_SECONDS, 60, 15, 3600) * 1000,
  slaIntervalMs: integer(env.MONITORING_SLA_CHECK_INTERVAL_SECONDS, 60, 15, 3600) * 1000,
  recoveryThreshold: integer(env.MONITORING_INCIDENT_RECOVERY_THRESHOLD, 2, 1, 20),
  emailFrom: String(env.MONITORING_EMAIL_FROM || "").trim() || undefined,
  emailReplyTo: String(env.MONITORING_EMAIL_REPLY_TO || "").trim() || undefined,
  appBaseUrl: String(env.APP_BASE_URL || "").trim(),
  whatsappEnabled: false,
  webhookEnabled: false,
  defaultRules: DEFAULT_ALERT_RULES.map((rule) => ({ ...rule, cooldownMinutes: rule.cooldownMinutes || integer(env.MONITORING_ALERT_COOLDOWN_MINUTES, 15, 1, 10080) })),
});
