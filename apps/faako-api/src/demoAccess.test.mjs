import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoAccessHandler,
  resetDemoAccessStateForTests,
} from "./demoAccess.js";

const originalEnv = { ...process.env };

const createResponse = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    set(headers) {
      Object.assign(this.headers, headers);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

const runHandler = async (handler, body, headers = {}) => {
  const req = {
    body,
    headers,
    ip: "127.0.0.1",
  };
  const res = createResponse();

  await handler(req, res);
  return res;
};

test.beforeEach(() => {
  resetDemoAccessStateForTests();
  process.env = {
    ...originalEnv,
    APP_ENV: "test",
    NODE_ENV: "test",
    FAAKO_ERP_DEMO_ACCESS_SECRET: "test-demo-access-secret-with-at-least-32-chars",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "faako@example.com",
    RESEND_FROM_NAME: "Faako",
  };
});

test.after(() => {
  process.env = originalEnv;
});

test("demo access request sends code without returning it to the browser", async () => {
  let deliveredCode = "";
  const handler = createDemoAccessHandler({
    sendEmail: async ({ email, code }) => {
      assert.equal(email, "client@example.com");
      deliveredCode = code;
    },
  });

  const res = await runHandler(handler, {
    action: "request",
    email: "CLIENT@example.com",
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.match(res.body.challengeToken, /^[0-9a-f-]{36}$/i);
  assert.equal(res.body.previewCode, undefined);
  assert.match(deliveredCode, /^\d{6}$/);
});

test("demo access verifies an emailed code and creates a browser session", async () => {
  let deliveredCode = "";
  const handler = createDemoAccessHandler({
    sendEmail: async ({ code }) => {
      deliveredCode = code;
    },
  });

  const requestRes = await runHandler(handler, {
    action: "request",
    email: "client@example.com",
  });
  const verifyRes = await runHandler(handler, {
    action: "verify",
    email: "client@example.com",
    code: deliveredCode,
    challengeToken: requestRes.body.challengeToken,
  });

  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.body.ok, true);
  assert.equal(verifyRes.body.session.email, "client@example.com");
  assert.equal(verifyRes.body.session.accessToken, undefined);
  assert.ok(Date.parse(verifyRes.body.session.expiresAt) > Date.now());
});

test("demo access fails closed in production when the signing secret is missing", async () => {
  process.env.APP_ENV = "production";
  process.env.NODE_ENV = "production";
  process.env.FAAKO_ERP_DEMO_ACCESS_SECRET = "";

  const handler = createDemoAccessHandler({
    sendEmail: async () => {
      throw new Error("email should not send without signing secret");
    },
  });

  const res = await runHandler(handler, {
    action: "request",
    email: "client@example.com",
  });

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
});
