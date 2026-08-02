import assert from "node:assert/strict";
import test from "node:test";
import { json } from "./http.js";

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
