import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  API_ERROR_STATUS,
  createRequestId,
  createCompatibleErrorResponse,
  createCompatibleSuccessResponse,
  errorCodeForStatus,
  isValidRequestId,
  normalizeApiResponse,
  readRequestId,
  readRetryAfterSeconds,
  resolveRequestId,
  safeMessageForErrorCode,
  statusForErrorCode,
} from "../src/index.js";

test("compatible success keeps legacy fields and exposes canonical data", () => {
  const response = createCompatibleSuccessResponse(
    { challengeToken: "challenge-1", deliveryMode: "email" },
    { requestId: "request-1" },
  );

  assert.equal(response.ok, true);
  assert.equal(response.challengeToken, "challenge-1");
  assert.equal(response.data.challengeToken, "challenge-1");
  assert.equal(response.meta.requestId, "request-1");
});

test("compatible errors keep the string error and expose structured details", () => {
  const response = createCompatibleErrorResponse(
    {
      code: API_ERROR_CODES.VALIDATION,
      message: "Enter a valid email.",
      issues: [{ field: "email", message: "Enter a valid email." }],
    },
    { requestId: "request-2" },
  );

  assert.equal(response.ok, false);
  assert.equal(response.error, "Enter a valid email.");
  assert.equal(response.apiError.code, API_ERROR_CODES.VALIDATION);
  assert.equal(response.apiError.issues[0].field, "email");
  assert.equal(response.meta.requestId, "request-2");
});

test("normalizer accepts legacy, compatible, and FastAPI error shapes", () => {
  const legacySuccess = normalizeApiResponse({ ok: true, session: { email: "a@example.com" } });
  assert.equal(legacySuccess.ok, true);
  assert.equal(legacySuccess.data.session.email, "a@example.com");

  const legacyError = normalizeApiResponse(
    { error: "Not found" },
    { status: 404, requestId: "request-3" },
  );
  assert.equal(legacyError.ok, false);
  assert.equal(legacyError.error.code, API_ERROR_CODES.NOT_FOUND);
  assert.equal(legacyError.meta.requestId, "request-3");

  const fastApiError = normalizeApiResponse(
    {
      detail: [
        {
          type: "missing",
          loc: ["body", "organizationId"],
          msg: "Field required",
        },
      ],
    },
    { status: 422 },
  );
  assert.equal(fastApiError.ok, false);
  assert.equal(fastApiError.error.code, API_ERROR_CODES.VALIDATION);
  assert.equal(fastApiError.error.issues[0].field, "organizationId");
});

test("pagination remains in response metadata", () => {
  const response = createCompatibleSuccessResponse(
    { items: [{ id: 1 }] },
    {
      pagination: {
        page: 1,
        pageSize: 20,
        total: 21,
        totalPages: 2,
        hasNext: true,
        hasPrevious: false,
      },
    },
  );

  assert.equal(response.meta.pagination.totalPages, 2);
  assert.equal(response.data.items.length, 1);
});

test("HTTP statuses map to the shared error categories", () => {
  assert.equal(errorCodeForStatus(400), API_ERROR_CODES.VALIDATION);
  assert.equal(errorCodeForStatus(401), API_ERROR_CODES.AUTHENTICATION);
  assert.equal(errorCodeForStatus(403), API_ERROR_CODES.PERMISSION);
  assert.equal(errorCodeForStatus(404), API_ERROR_CODES.NOT_FOUND);
  assert.equal(errorCodeForStatus(409), API_ERROR_CODES.CONFLICT);
  assert.equal(errorCodeForStatus(429), API_ERROR_CODES.RATE_LIMITED);
  assert.equal(errorCodeForStatus(500), API_ERROR_CODES.SERVER);
  assert.equal(errorCodeForStatus(502), API_ERROR_CODES.UPSTREAM);
  assert.equal(errorCodeForStatus(503), API_ERROR_CODES.SERVICE_UNAVAILABLE);
});

test("request and retry metadata are read case-insensitively", () => {
  assert.equal(
    readRequestId({ "X-Request-ID": "request-4" }),
    "request-4",
  );
  assert.equal(
    readRetryAfterSeconds(new Headers({ "Retry-After": "45" })),
    45,
  );
});

test("error codes expose standard statuses and user-safe fallback messages", () => {
  assert.equal(API_ERROR_STATUS[API_ERROR_CODES.PERMISSION], 403);
  assert.equal(statusForErrorCode(API_ERROR_CODES.RATE_LIMITED), 429);
  assert.equal(
    safeMessageForErrorCode(API_ERROR_CODES.SERVER),
    API_ERROR_MESSAGES[API_ERROR_CODES.SERVER],
  );
});

test("request IDs accept a constrained incoming value and replace invalid input", () => {
  assert.equal(isValidRequestId("edge-request_123"), true);
  assert.equal(isValidRequestId("invalid request id"), false);
  assert.equal(resolveRequestId("edge-request_123"), "edge-request_123");
  assert.equal(resolveRequestId("invalid request id", () => "generated-id"), "generated-id");
  assert.equal(isValidRequestId(createRequestId()), true);
});
