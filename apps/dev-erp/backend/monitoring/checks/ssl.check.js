import tls from "node:tls";
import { performance } from "node:perf_hooks";
import { sanitizeCheckResult } from "../monitoring.security.js";

export const classifyCertificateDays = (daysRemaining) => daysRemaining < 7 ? "DOWN" : daysRemaining <= 30 ? "DEGRADED" : "HEALTHY";

export const runSslCheck = ({ target, timeoutMs = 8000, connectImpl = tls.connect } = {}) => {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  if (!target?.hostname) return Promise.resolve(sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "SSL check is not configured." }));
  return new Promise((resolve) => {
    let settled = false;
    let socket;
    let timeoutId;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket?.destroy();
      resolve(sanitizeCheckResult(result));
    };
    socket = connectImpl({ host: target.hostname, port: target.port || 443, servername: target.hostname, rejectUnauthorized: true }, () => {
      const certificate = socket.getPeerCertificate();
      const expiryMs = new Date(certificate?.valid_to).getTime();
      const daysRemaining = Number.isFinite(expiryMs) ? Math.floor((expiryMs - Date.now()) / 86400000) : -1;
      finish({ status: classifyCertificateDays(daysRemaining), latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), details: { daysRemaining, valid: socket.authorized } });
    });
    socket.once("error", () => finish({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: "SSL_INVALID", errorSummary: "The TLS certificate could not be validated." }));
    timeoutId = setTimeout(() => finish({ status: "DOWN", latencyMs: Math.round(performance.now() - startedMs), startedAt, completedAt: new Date().toISOString(), errorCode: "TIMEOUT", errorSummary: "The SSL check timed out." }), timeoutMs);
  });
};
