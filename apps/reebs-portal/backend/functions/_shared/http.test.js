import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedAppOrigin, isTrustedBrowserMutation, json } from "./http.js";

test("REEBS API errors preserve legacy messages and add contract/request metadata", () => {
  const response = json(
    {
      headers: { "x-request-id": "edge-request-1" },
    },
    403,
    { error: "Access denied" },
  );
  const payload = JSON.parse(response.body);

  assert.equal(response.headers["X-Request-Id"], "edge-request-1");
  assert.equal(payload.error, "Access denied");
  assert.equal(payload.apiError.code, "permission_error");
  assert.equal(payload.meta.requestId, "edge-request-1");
});

test("production CORS defaults exclude localhost", () => {
  const previousAppEnv = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  try {
    assert.equal(isAllowedAppOrigin("http://localhost:5173"), false);
    assert.equal(isAllowedAppOrigin("https://portal.reebspartythemes.com"), true);
  } finally {
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
  }
});

test("cookie mutation origin checks fail closed without trusted browser evidence", () => {
  assert.equal(isTrustedBrowserMutation({ httpMethod: "POST", headers: {} }), false);
  assert.equal(isTrustedBrowserMutation({
    httpMethod: "POST",
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
  }), false);
  assert.equal(isTrustedBrowserMutation({
    httpMethod: "POST",
    headers: { origin: "https://portal.reebspartythemes.com" },
  }), true);
  assert.equal(isTrustedBrowserMutation({ httpMethod: "GET", headers: {} }), true);
});

test("REEBS API errors replace invalid request IDs and hide 5xx implementation details", () => {
  const response = json(
    {
      headers: { "x-request-id": "invalid request id" },
    },
    500,
    { error: "relation user_permission does not exist" },
  );
  const payload = JSON.parse(response.body);

  assert.match(response.headers["X-Request-Id"], /^[A-Za-z0-9][A-Za-z0-9._:-]+$/);
  assert.equal(payload.error, "The service could not complete the request.");
  assert.equal(payload.apiError.code, "server_error");
  assert.doesNotMatch(JSON.stringify(payload), /user_permission/);
});
