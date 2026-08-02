import assert from "node:assert/strict";
import test from "node:test";
import {
  REDACTED_LOG_VALUE,
  buildLogContext,
  createRequestContextMiddleware,
  isSensitiveLogKey,
  redactSensitiveString,
  redactLogValue,
} from "../src/index.js";

test("central redaction removes credentials and sensitive personal fields recursively", () => {
  const redacted = redactLogValue({
    userId: "user-1",
    organisationId: "org-1",
    authorization: "Bearer secret",
    nested: {
      password: "secret",
      email: "person@example.com",
      cardNumber: "4111111111111111",
    },
  });

  assert.equal(redacted.userId, "user-1");
  assert.equal(redacted.organisationId, "org-1");
  assert.equal(redacted.authorization, REDACTED_LOG_VALUE);
  assert.equal(redacted.nested.password, REDACTED_LOG_VALUE);
  assert.equal(redacted.nested.email, REDACTED_LOG_VALUE);
  assert.equal(redacted.nested.cardNumber, REDACTED_LOG_VALUE);
});

test("sensitive-key matching covers common token, cookie, payment, and PII variants", () => {
  assert.equal(isSensitiveLogKey("refresh_token"), true);
  assert.equal(isSensitiveLogKey("sessionCookie"), true);
  assert.equal(isSensitiveLogKey("mobileMoneyPin"), true);
  assert.equal(isSensitiveLogKey("requestId"), false);
});

test("free-text redaction removes embedded credentials and personal information", () => {
  const redacted = redactSensitiveString(
    "Bearer abc.def.ghi password=hunter2 email person@example.com " +
      "postgresql://admin:secret@database.example.com/app " +
      "card 4111 1111 1111 1111 phone +233 24 123 4567",
  );

  assert.equal(redacted.includes("hunter2"), false);
  assert.equal(redacted.includes("person@example.com"), false);
  assert.equal(redacted.includes("admin:secret"), false);
  assert.equal(redacted.includes("4111 1111 1111 1111"), false);
  assert.equal(redacted.includes("+233 24 123 4567"), false);
  assert.equal(redacted.includes(REDACTED_LOG_VALUE), true);
});

test("error serialization redacts secrets embedded in messages and stacks", () => {
  const error = new Error(
    "request failed for person@example.com with token=abc123",
  );
  const redacted = redactLogValue(error, { includeErrorStack: true });

  assert.equal(redacted.message.includes("person@example.com"), false);
  assert.equal(redacted.message.includes("abc123"), false);
  assert.equal(redacted.stack.includes("person@example.com"), false);
});

test("standard log context uses stable observability fields", () => {
  assert.deepEqual(
    buildLogContext({
      application: "dev-erp",
      component: "api",
      environment: "test",
      eventName: "request.completed",
      requestId: "request-1",
      organizationId: 7,
      userId: 12,
    }),
    {
      application: "dev-erp",
      component: "api",
      environment: "test",
      eventName: "request.completed",
      requestId: "request-1",
      organisationId: "7",
      userId: "12",
    },
  );
});

test("request context middleware preserves valid IDs and replaces unsafe values", () => {
  const run = (incoming) => {
    const headers = {};
    const req = { headers: { "x-request-id": incoming } };
    const res = { setHeader: (name, value) => (headers[name] = value) };
    let nextCalled = false;
    createRequestContextMiddleware({
      application: "test-app",
      requestIdFactory: () => "generated-request",
    })(req, res, () => {
      nextCalled = true;
    });
    return { req, headers, nextCalled };
  };

  const preserved = run("edge-request_123");
  assert.equal(preserved.req.requestId, "edge-request_123");
  assert.equal(preserved.headers["X-Request-Id"], "edge-request_123");
  assert.equal(preserved.nextCalled, true);

  const replaced = run("invalid request id");
  assert.equal(replaced.req.requestId, "generated-request");
});
