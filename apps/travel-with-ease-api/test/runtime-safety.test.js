import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp, createLimiter } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { estimateSchema } from "../src/validation.js";

test("configuration rejects ambiguous modes, production bypass, invalid ports and broad origins", () => {
  assert.equal(readConfig({}).environment, "development");
  for (const env of [
    { APP_ENV: "preview" }, { APP_ENV: "development", NODE_ENV: "production" },
    { APP_ENV: "test", NODE_ENV: "production" }, { PORT: "0" }, { PORT: "3.5" },
    { ALLOWED_ORIGINS: "*" }, { ALLOWED_ORIGINS: "https://example.com/path" },
    { APP_ENV: "staging" }, { APP_ENV: "staging", ALLOWED_ORIGINS: "http://example.com" },
  ]) assert.throws(() => readConfig(env));
  assert.equal(readConfig({ APP_ENV: "staging", ALLOWED_ORIGINS: "https://stage.example.com" }).deployed, true);
});

test("factory cannot bypass deployed adapter guard using a bearer credential", () => {
  for (const environment of ["staging", "production", "preview"]) {
    assert.throws(() => createApp({ environment, agentToken: "test-only-credential" }));
  }
});

test("calendar dates reject impossible days and retain leap years", () => {
  const dateSchema = estimateSchema.shape.travelDate;
  for (const value of ["2027-99-99", "2027-02-29", "2028-02-30", "2027-04-31"]) assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(dateSchema.parse("2028-02-29"), "2028-02-29");
});

test("limiter bounds distinct clients, enforces quotas and recovers after expiry", () => {
  let now = 0;
  const limiter = createLimiter({ limit: 1, windowMs: 1000, maxClients: 2, clock: () => now });
  const request = (ip) => {
    let status = 200;
    const res = { setHeader() {}, status(code) { status = code; return this; }, json() {} };
    limiter({ ip, requestId: "test" }, res, () => {});
    return status;
  };
  assert.equal(request("a"), 200);
  assert.equal(request("a"), 429);
  assert.equal(request("b"), 200);
  assert.equal(request("c"), 429);
  now = 1001;
  assert.equal(request("c"), 200);
});

test("safe JSON envelopes cover malformed, oversized, missing and failed requests", async (context) => {
  const logs = [];
  const app = createApp({
    repository: { async listLeads() { throw new Error("private-database-details"); } },
    agentToken: "test-only-credential", logger: { error(fields) { logs.push(fields); } },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, options, expected] of [
    ["/api/public/inquiries", { method: "POST", body: "{" }, 400],
    ["/api/public/inquiries", { method: "POST", body: JSON.stringify({ notes: "x".repeat(40_000) }) }, 413],
    ["/missing", {}, 404],
    ["/api/agent/leads", { headers: { authorization: "Bearer test-only-credential" } }, 500],
  ]) {
    const response = await fetch(base + path, { ...options, headers: { "content-type": "application/json", "x-request-id": "twe-regression-123", ...options.headers } });
    assert.equal(response.status, expected);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(response.headers.get("x-request-id"), "twe-regression-123");
    assert.match(response.headers.get("cache-control"), /\bno-store\b/);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.meta.requestId, "twe-regression-123");
    assert.doesNotMatch(JSON.stringify(payload), /private-database-details|stack|SyntaxError/);
  }
  assert.doesNotMatch(JSON.stringify(logs), /private-database-details|test-only-credential/);
  const invalidId = await fetch(base + "/healthz", { headers: { "x-request-id": "<invalid>" } });
  assert.notEqual(invalidId.headers.get("x-request-id"), "<invalid>");
});
