import assert from "node:assert/strict";
import test from "node:test";
import { sendApiError } from "./src/apiResponse.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("Stroane API errors keep legacy consumers and expose canonical metadata", () => {
  const response = createResponse();
  sendApiError(
    { requestId: "request-403" },
    response,
    { status: 403, message: "Access denied" },
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Access denied");
  assert.equal(response.body.apiError.code, "permission_error");
  assert.equal(response.body.meta.requestId, "request-403");
});

test("Stroane API 5xx helpers do not expose exception details", () => {
  const response = createResponse();
  sendApiError(
    { requestId: "request-500" },
    response,
    {
      status: 500,
      message: "password reset query failed with secret value",
      details: undefined,
    },
  );

  assert.equal(response.body.error, "The service could not complete the request.");
  assert.doesNotMatch(JSON.stringify(response.body), /secret value/);
});
