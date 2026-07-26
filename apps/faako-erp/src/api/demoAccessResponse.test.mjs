import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ERROR_CODES,
  createCompatibleErrorResponse,
  createCompatibleSuccessResponse,
} from "@faako/api-contracts";
import { parseDemoAccessResponse } from "./demoAccessResponse.js";

const createResponse = (payload, status = 200, headers = {}) => ({
  headers: new Headers(headers),
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return JSON.stringify(payload);
  },
});

test("client reads canonical data from the compatible demo-access response", async () => {
  const payload = createCompatibleSuccessResponse(
    {
      challengeToken: "challenge-1",
      deliveryMode: "email",
      message: "Code sent.",
    },
    { requestId: "request-1" },
  );

  const data = await parseDemoAccessResponse(
    createResponse(payload, 200, { "X-Request-Id": "request-1" }),
  );

  assert.equal(data.challengeToken, "challenge-1");
  assert.equal(data.deliveryMode, "email");
});

test("client remains compatible with the legacy top-level success shape", async () => {
  const data = await parseDemoAccessResponse(
    createResponse({
      ok: true,
      challengeToken: "legacy-challenge",
      deliveryMode: "email",
    }),
  );

  assert.equal(data.challengeToken, "legacy-challenge");
});

test("client exposes structured error context while retaining the message", async () => {
  const payload = createCompatibleErrorResponse(
    {
      code: API_ERROR_CODES.RATE_LIMITED,
      message: "Please wait and try again.",
    },
    { requestId: "request-2", retryAfterSeconds: 30 },
  );

  await assert.rejects(
    () =>
      parseDemoAccessResponse(
        createResponse(payload, 429, {
          "Retry-After": "30",
          "X-Request-Id": "request-2",
        }),
      ),
    (error) => {
      assert.equal(error.message, "Please wait and try again.");
      assert.equal(error.code, API_ERROR_CODES.RATE_LIMITED);
      assert.equal(error.requestId, "request-2");
      assert.equal(error.retryAfterSeconds, 30);
      return true;
    },
  );
});
