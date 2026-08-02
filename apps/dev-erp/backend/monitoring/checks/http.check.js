import { performance } from "node:perf_hooks";
import { sanitizeCheckResult } from "../monitoring.security.js";

const errorResult = ({ startedAt, startedMs, code, summary, httpStatus = null }) => sanitizeCheckResult({
  status: "DOWN",
  latencyMs: Math.round(performance.now() - startedMs),
  httpStatus,
  startedAt,
  completedAt: new Date().toISOString(),
  errorCode: code,
  errorSummary: summary,
});

export const runHttpCheck = async ({
  target,
  timeoutMs = 8000,
  method = "GET",
  expectedStatusCodes = [200],
  degradedLatencyMs = 500,
  validateResponse = null,
  fetchImpl = fetch,
  maxRedirects = 3,
} = {}) => {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  if (!target) {
    return sanitizeCheckResult({ status: "UNKNOWN", startedAt, completedAt: new Date().toISOString(), errorCode: "NOT_CONFIGURED", errorSummary: "Check target is not configured." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const trustedTarget = new URL(target);
    if (!["http:", "https:"].includes(trustedTarget.protocol)) {
      return errorResult({ startedAt, startedMs, code: "INVALID_TARGET", summary: "The configured service target is invalid." });
    }
    let currentTarget = target;
    let response;
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      response = await fetchImpl(currentTarget, {
        method: method === "HEAD" ? "HEAD" : "GET",
        headers: { "User-Agent": "Faako-Monitor/1.0", Accept: "application/json,text/plain;q=0.8,*/*;q=0.5" },
        redirect: "manual",
        signal: controller.signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirectCount === maxRedirects) return errorResult({ startedAt, startedMs, code: "TOO_MANY_REDIRECTS", summary: "The service exceeded the redirect limit.", httpStatus: response.status });
      const location = response.headers.get("location");
      if (!location) return errorResult({ startedAt, startedMs, code: "INVALID_REDIRECT", summary: "The service returned an invalid redirect.", httpStatus: response.status });
      const nextTarget = new URL(location, currentTarget);
      const changesHost = nextTarget.hostname !== trustedTarget.hostname;
      const downgradesTls = trustedTarget.protocol === "https:" && nextTarget.protocol !== "https:";
      if (!["http:", "https:"].includes(nextTarget.protocol) || changesHost || downgradesTls) {
        return errorResult({ startedAt, startedMs, code: "UNSAFE_REDIRECT", summary: "The service returned an unsafe redirect.", httpStatus: response.status });
      }
      currentTarget = nextTarget.toString();
    }

    const latencyMs = Math.round(performance.now() - startedMs);
    if (!expectedStatusCodes.includes(response.status)) {
      return errorResult({ startedAt, startedMs, code: "UNEXPECTED_STATUS", summary: "The service returned an unexpected status.", httpStatus: response.status });
    }
    if (typeof validateResponse === "function") {
      const isValid = await validateResponse(response.clone());
      if (!isValid) return errorResult({ startedAt, startedMs, code: "INVALID_RESPONSE", summary: "The service response did not match the expected contract.", httpStatus: response.status });
    }
    return sanitizeCheckResult({
      status: latencyMs > degradedLatencyMs ? "DEGRADED" : "HEALTHY",
      latencyMs,
      httpStatus: response.status,
      startedAt,
      completedAt: new Date().toISOString(),
      details: { method: method === "HEAD" ? "HEAD" : "GET", redirected: currentTarget !== target },
    });
  } catch (error) {
    if (error?.name === "AbortError") return errorResult({ startedAt, startedMs, code: "TIMEOUT", summary: "The service check timed out." });
    return errorResult({ startedAt, startedMs, code: "CONNECTION_FAILED", summary: "The service could not be reached." });
  } finally {
    clearTimeout(timeoutId);
  }
};
