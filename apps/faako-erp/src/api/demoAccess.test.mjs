import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ERROR_CODES,
  createCompatibleErrorResponse,
  createCompatibleSuccessResponse,
} from "@faako/api-contracts";
import { ApiClientError } from "@faako/api-client";
import { createDemoAccessApi } from "./demoAccess.js";

const jsonResponse = (payload, init = {}) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

test("demo-access pilot preserves endpoint, JSON body, credentials, and canonical data", async () => {
  let capturedUrl = "";
  let capturedInit;
  const api = createDemoAccessApi({
    endpoint: "https://api.example.com/api/demo-access",
    fetch: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(
        createCompatibleSuccessResponse({
          challengeToken: "challenge-1",
          deliveryMode: "email",
          message: "Code sent.",
        }),
      );
    },
  });

  const result = await api.submit({
    action: "request",
    email: "person@example.com",
  });

  assert.equal(result.challengeToken, "challenge-1");
  assert.equal(capturedUrl, "https://api.example.com/api/demo-access");
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.credentials, "same-origin");
  assert.equal(
    new Headers(capturedInit.headers).get("content-type"),
    "application/json",
  );
  assert.deepEqual(JSON.parse(capturedInit.body), {
    action: "request",
    email: "person@example.com",
  });
});

test("demo-access pilot remains compatible with the legacy success shape", async () => {
  const api = createDemoAccessApi({
    fetch: async () =>
      jsonResponse({
        ok: true,
        challengeToken: "legacy-challenge",
        deliveryMode: "email",
      }),
  });

  const result = await api.submit({ action: "request" });
  assert.equal(result.challengeToken, "legacy-challenge");
});

test("demo-access pilot exposes structured errors and request metadata", async () => {
  const api = createDemoAccessApi({
    fetch: async () =>
      jsonResponse(
        createCompatibleErrorResponse({
          code: API_ERROR_CODES.RATE_LIMITED,
          message: "Please wait and try again.",
        }),
        {
          status: 429,
          headers: {
            "Retry-After": "30",
            "X-Request-Id": "request-2",
          },
        },
      ),
  });

  await assert.rejects(
    () => api.submit({ action: "request" }),
    (error) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.message, "Please wait and try again.");
      assert.equal(error.code, API_ERROR_CODES.RATE_LIMITED);
      assert.equal(error.requestId, "request-2");
      assert.equal(error.retryAfterSeconds, 30);
      return true;
    },
  );
});

test("local demo mode remains rejected before any network request", async () => {
  let calls = 0;
  const api = createDemoAccessApi({
    mode: "local",
    fetch: async () => {
      calls += 1;
      return jsonResponse({ ok: true });
    },
  });

  await assert.rejects(
    () => api.submit({ action: "request" }),
    /Demo access must be verified by the Faako API/,
  );
  assert.equal(calls, 0);
});
