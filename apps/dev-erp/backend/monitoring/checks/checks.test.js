import test from "node:test";
import assert from "node:assert/strict";
import { runDatabaseCheck } from "./database.check.js";
import { runHttpCheck } from "./http.check.js";
import { classifyCertificateDays } from "./ssl.check.js";
import { classifyWorkerHeartbeat, runWorkerCheck } from "./worker.check.js";

const response = (status = 200) => ({ status, headers: new Headers(), clone() { return this; } });

test("HTTP checker classifies healthy, degraded, bad status, and timeout", async () => {
  assert.equal((await runHttpCheck({ target: "https://example.test", fetchImpl: async () => response(200), degradedLatencyMs: Number.MAX_SAFE_INTEGER })).status, "HEALTHY");
  assert.equal((await runHttpCheck({ target: "https://example.test", fetchImpl: async () => response(503) })).errorCode, "UNEXPECTED_STATUS");
  assert.equal((await runHttpCheck({ target: null })).status, "UNKNOWN");
  const timeout = await runHttpCheck({ target: "https://example.test", timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  assert.equal(timeout.errorCode, "TIMEOUT");
  const degraded = await runHttpCheck({ target: "https://example.test", fetchImpl: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return response(200); }, degradedLatencyMs: 1 });
  assert.equal(degraded.status, "DEGRADED");
});

test("HTTP checker refuses redirects away from the trusted configured host", async () => {
  const redirected = response(302);
  redirected.headers.set("location", "https://internal.example.test/health");
  const result = await runHttpCheck({ target: "https://public.example.test/health", fetchImpl: async () => redirected });
  assert.equal(result.errorCode, "UNSAFE_REDIRECT");
});

test("database checker uses a lightweight configured query and sanitizes failures", async () => {
  const healthy = await runDatabaseCheck({ target: { queryKey: "dev" }, queryFns: { dev: async () => [{ one: 1 }] } });
  assert.equal(healthy.status, "HEALTHY");
  const unavailable = await runDatabaseCheck({ target: { queryKey: "dev" }, queryFns: { dev: async () => { throw new Error("postgres://secret"); } } });
  assert.equal(unavailable.status, "DOWN");
  assert.equal(unavailable.errorSummary.includes("secret"), false);
});

test("SSL and worker thresholds follow the monitoring contract", async () => {
  assert.equal(classifyCertificateDays(40), "HEALTHY");
  assert.equal(classifyCertificateDays(12), "DEGRADED");
  assert.equal(classifyCertificateDays(2), "DOWN");
  const now = Date.now();
  assert.equal(classifyWorkerHeartbeat({ heartbeatAt: new Date(now - 60_000), expectedIntervalSeconds: 60, now }), "HEALTHY");
  assert.equal(classifyWorkerHeartbeat({ heartbeatAt: new Date(now - 120_000), expectedIntervalSeconds: 60, now }), "DEGRADED");
  assert.equal(classifyWorkerHeartbeat({ heartbeatAt: new Date(now - 400_000), expectedIntervalSeconds: 60, now }), "DOWN");
  assert.equal((await runWorkerCheck({})).status, "UNKNOWN");
});
