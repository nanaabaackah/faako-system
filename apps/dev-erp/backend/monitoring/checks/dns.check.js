import dns from "node:dns/promises";
import { performance } from "node:perf_hooks";
import { sanitizeCheckResult } from "../monitoring.security.js";

export const runDnsCheck = async ({ target, timeoutMs = 5000, resolveImpl = dns.resolveAny } = {}) => {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  if (!target?.hostname) return sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "DNS check is not configured." });
  let timeoutId;
  try {
    const records = await Promise.race([
      resolveImpl(target.hostname),
      new Promise((_resolve, reject) => { timeoutId = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), timeoutMs); }),
    ]);
    return sanitizeCheckResult({ status: Array.isArray(records) && records.length ? "HEALTHY" : "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), details: { recordCount: Array.isArray(records) ? records.length : 0 } });
  } catch (error) {
    return sanitizeCheckResult({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: error?.code === "TIMEOUT" ? "TIMEOUT" : "DNS_RESOLUTION_FAILED", errorSummary: "DNS resolution failed." });
  } finally { clearTimeout(timeoutId); }
};
