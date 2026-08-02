import { sanitizeCheckResult } from "../monitoring.security.js";

export const classifyWorkerHeartbeat = ({ heartbeatAt, expectedIntervalSeconds = 300, now = Date.now() } = {}) => {
  const heartbeatMs = new Date(heartbeatAt).getTime();
  if (!Number.isFinite(heartbeatMs)) return "UNKNOWN";
  const ageSeconds = Math.max(0, (now - heartbeatMs) / 1000);
  if (ageSeconds <= expectedIntervalSeconds * 1.5) return "HEALTHY";
  if (ageSeconds <= expectedIntervalSeconds * 3) return "DEGRADED";
  return "DOWN";
};

export const runWorkerCheck = async ({ target } = {}) => {
  const startedAt = new Date().toISOString();
  if (!target?.heartbeatAt) return sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "Worker heartbeat is not configured." });
  const status = classifyWorkerHeartbeat(target);
  return sanitizeCheckResult({ status, startedAt, completedAt: new Date().toISOString(), details: { heartbeatAt: new Date(target.heartbeatAt).toISOString(), expectedIntervalSeconds: target.expectedIntervalSeconds } });
};
