export const ALERT_TRIGGER_TYPES = new Set(["SERVICE_DOWN", "SERVICE_DEGRADED", "CONSECUTIVE_FAILURES", "LATENCY_THRESHOLD", "UPTIME_BELOW", "INCIDENT_UNACKNOWLEDGED", "INCIDENT_UNRESOLVED", "SSL_EXPIRY", "WORKER_STALE", "CRITICAL_DEPENDENCY_FAILURE"]);
export const ALERT_SEVERITIES = new Set(["INFO", "WARNING", "CRITICAL"]);
export const CHANNEL_TYPES = new Set(["IN_APP", "EMAIL", "WHATSAPP", "WEBHOOK"]);

export const DEFAULT_ALERT_RULES = Object.freeze([
  { name: "Consecutive service failures", triggerType: "CONSECUTIVE_FAILURES", severity: "WARNING", consecutiveFailures: 2, cooldownMinutes: 15, recoveryNotifications: true },
  { name: "Degraded service", triggerType: "SERVICE_DEGRADED", severity: "WARNING", cooldownMinutes: 30, recoveryNotifications: true },
  { name: "Critical service latency", triggerType: "LATENCY_THRESHOLD", severity: "WARNING", thresholdValue: 1000, cooldownMinutes: 30, recoveryNotifications: true },
  { name: "SSL certificate expiry", triggerType: "SSL_EXPIRY", category: "INFRASTRUCTURE", severity: "CRITICAL", thresholdValue: 7, cooldownMinutes: 1440, recoveryNotifications: true },
  { name: "Stale worker heartbeat", triggerType: "WORKER_STALE", category: "WORKER", severity: "WARNING", cooldownMinutes: 15, recoveryNotifications: true },
]);
