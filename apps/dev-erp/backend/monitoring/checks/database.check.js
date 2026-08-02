import { performance } from "node:perf_hooks";
import { sanitizeCheckResult } from "../monitoring.security.js";

export const runDatabaseCheck = async ({ target, timeoutMs = 5000, queryFns = {} } = {}) => {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  const queryFn = target?.queryKey ? queryFns[target.queryKey] : null;
  if (typeof queryFn !== "function") {
    return sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "Database check is not configured." });
  }
  let timeoutId;
  try {
    await Promise.race([
      queryFn(),
      new Promise((_resolve, reject) => { timeoutId = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), timeoutMs); }),
    ]);
    return sanitizeCheckResult({ status: "HEALTHY", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString() });
  } catch (error) {
    return sanitizeCheckResult({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: error?.code === "TIMEOUT" ? "TIMEOUT" : "CONNECTION_FAILED", errorSummary: error?.code === "TIMEOUT" ? "The database check timed out." : "The database is unavailable." });
  } finally {
    clearTimeout(timeoutId);
  }
};
