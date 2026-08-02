import net from "node:net";
import { performance } from "node:perf_hooks";
import { sanitizeCheckResult } from "../monitoring.security.js";

export const runTcpCheck = ({ target, timeoutMs = 5000, connectImpl = net.createConnection } = {}) => {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  if (!target?.hostname || !Number.isInteger(target.port)) return Promise.resolve(sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "TCP check is not configured." }));
  return new Promise((resolve) => {
    let settled = false;
    let socket;
    let timeoutId;
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timeoutId); socket?.destroy(); resolve(sanitizeCheckResult(result)); };
    socket = connectImpl({ host: target.hostname, port: target.port }, () => finish({ status: "HEALTHY", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString() }));
    socket.once("error", () => finish({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: "CONNECTION_FAILED", errorSummary: "The TCP service could not be reached." }));
    timeoutId = setTimeout(() => finish({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: "TIMEOUT", errorSummary: "The TCP check timed out." }), timeoutMs);
  });
};
