import assert from "node:assert/strict";
import test from "node:test";
import { createReebsPortalApi } from "./client.js";

test("REEBS compatibility client adds request metadata and preserves successful responses", async () => {
  let request;
  const api = createReebsPortalApi({
    fetch: async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify([{ id: 1, name: "Customer" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const response = await api.response("/api/customers");
  assert.equal(request.input, "/api/customers");
  assert.equal(request.init.credentials, "same-origin");
  assert.equal(new Headers(request.init.headers).has("x-request-id"), true);
  assert.deepEqual(await response.json(), [{ id: 1, name: "Customer" }]);
});

test("REEBS compatibility client preserves legacy error-response handling", async () => {
  const api = createReebsPortalApi({
    fetch: async () =>
      new Response(JSON.stringify({ error: "You do not have permission." }), {
        status: 403,
        headers: { "Content-Type": "application/json", "X-Request-Id": "req-403" },
      }),
  });

  const response = await api.response("/api/users");
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "req-403");
  assert.deepEqual(await response.json(), {
    error: "You do not have permission to complete this action.",
  });
});
