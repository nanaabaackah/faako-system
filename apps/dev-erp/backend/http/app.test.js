import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import cors from "cors";
import express from "express";
import { createSecurityHeadersMiddleware } from "../security/securityHeaders.js";
import { configureBaseHttpMiddleware, registerErrorHandler } from "./app.js";

const allowedOrigin = "https://dev.nanaabaackah.com";

const classifyApiError = (error) => {
  if (error?.message === "Not allowed by CORS") {
    return { status: 403, message: "Not allowed by CORS", code: "CORS_DENIED" };
  }
  if (error?.type === "entity.parse.failed") {
    return { status: 400, message: "Malformed JSON body.", code: "BAD_JSON" };
  }
  if (error?.type === "entity.too.large") {
    return { status: 413, message: "Request body is too large.", code: "BODY_TOO_LARGE" };
  }
  return { status: 500, message: "Unexpected server error.", code: "INTERNAL_ERROR" };
};

const createTestApp = () => {
  const app = express();
  const middlewareCalls = [];
  const track = (name) => (_req, _res, next) => {
    middlewareCalls.push(name);
    next();
  };

  configureBaseHttpMiddleware(app, {
    cors,
    express,
    corsOptions: {
      credentials: true,
      origin(origin, callback) {
        if (!origin || origin === allowedOrigin) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
    },
    securityHeaders: createSecurityHeadersMiddleware(),
    apiRequestLogger: track("request-logger"),
    apiRateLimit: track("api-rate-limit"),
    authRateLimit: track("auth-rate-limit"),
    publicBookingRateLimit: track("booking-rate-limit"),
    aiRateLimit: track("ai-rate-limit"),
    csrfMiddleware: track("csrf"),
    capabilityAccessMiddleware: track("capability"),
  });

  app.post("/api/echo", (req, res) => res.json({ received: req.body }));
  registerErrorHandler(app, {
    classifyApiError,
    isProduction: true,
    logger: { error() {} },
  });
  return { app, middlewareCalls };
};

const withServer = async (app, callback) => {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (!error || error.code === "ERR_SERVER_NOT_RUNNING") resolve();
        else reject(error);
      });
    });
  }
};

const assertSecurityHeaders = (response) => {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
};

test("normal API responses retain security headers and middleware order", async () => {
  const { app, middlewareCalls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: allowedOrigin },
      body: JSON.stringify({ ok: true }),
    });
    assert.equal(response.status, 200);
    assertSecurityHeaders(response);
    assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.deepEqual(await response.json(), { received: { ok: true } });
    assert.deepEqual(middlewareCalls, [
      "request-logger",
      "api-rate-limit",
      "csrf",
      "capability",
    ]);
  });
});

test("malformed JSON responses receive security headers without internal details", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: allowedOrigin },
      body: '{"broken":',
    });
    assert.equal(response.status, 400);
    assertSecurityHeaders(response);
    assert.deepEqual(await response.json(), { error: "Malformed JSON body." });
  });
});

test("oversized JSON responses receive security headers and preserve the 1 MB limit", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: allowedOrigin },
      body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
    });
    assert.equal(response.status, 413);
    assertSecurityHeaders(response);
    assert.deepEqual(await response.json(), { error: "Request body is too large." });
  });
});

test("CORS continues to reject unrelated browser origins", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ ok: true }),
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await response.json(), { error: "Not allowed by CORS" });
  });
});
