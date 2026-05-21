import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiRateLimitMiddleware,
  createCorsOriginValidator,
  createSecurityHeadersMiddleware,
  createUnsafeApiDefaultDenyMiddleware,
  resolveAllowedOrigins,
  resolveTrustProxySetting,
} from "./security.js";

const createMockResponse = () => {
  const response = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
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
  return response;
};

test("resolveAllowedOrigins fails closed in production when CORS_ORIGINS is unset", () => {
  const allowedOrigins = resolveAllowedOrigins({
    NODE_ENV: "production",
    CORS_ORIGINS: "",
  });
  assert.equal(allowedOrigins.size, 0);

  const validator = createCorsOriginValidator({ allowedOrigins });
  let allowed = false;
  let error = null;
  validator("https://evil.example", (receivedError, isAllowed) => {
    error = receivedError;
    allowed = Boolean(isAllowed);
  });

  assert.equal(allowed, false);
  assert.equal(error?.statusCode, 403);
});

test("resolveAllowedOrigins includes the Stroane Vite dev port outside production", () => {
  const allowedOrigins = resolveAllowedOrigins({
    NODE_ENV: "development",
    CORS_ORIGINS: "",
  });

  assert.equal(allowedOrigins.has("http://localhost:5175"), true);
});

test("resolveTrustProxySetting only enables explicit positive proxy hop counts", () => {
  assert.equal(resolveTrustProxySetting({ TRUST_PROXY_HOPS: "" }), false);
  assert.equal(resolveTrustProxySetting({ TRUST_PROXY_HOPS: "true" }), false);
  assert.equal(resolveTrustProxySetting({ TRUST_PROXY_HOPS: "1" }), 1);
});

test("unsafe api default deny middleware blocks non-read methods", () => {
  const middleware = createUnsafeApiDefaultDenyMiddleware();
  const response = createMockResponse();
  let nextCalled = false;

  middleware({ method: "POST" }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, {
    error: "Write routes are disabled until authenticated middleware is configured.",
  });
});

test("api rate limit middleware throttles repeated requests from the same client", () => {
  let currentTime = 1_000;
  const middleware = createApiRateLimitMiddleware({
    limit: 2,
    windowMs: 60_000,
    now: () => currentTime,
  });
  const request = {
    method: "GET",
    ip: "203.0.113.5",
    headers: {},
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = createMockResponse();
    let nextCalled = false;
    middleware(request, response, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
  }

  currentTime += 10;
  const limitedResponse = createMockResponse();
  let nextCalled = false;
  middleware(request, limitedResponse, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(limitedResponse.statusCode, 429);
  assert.deepEqual(limitedResponse.body, {
    error: "Too many requests. Try again later.",
  });
  assert.ok(Number(limitedResponse.headers["Retry-After"]) >= 1);
});

test("security headers middleware uses shared API header baseline", () => {
  const middleware = createSecurityHeadersMiddleware();
  const response = createMockResponse();
  let nextCalled = false;

  middleware({ headers: {}, secure: false }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(response.headers["X-Frame-Options"], "DENY");
  assert.match(response.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.match(response.headers["Content-Security-Policy"], /frame-ancestors 'none'/);
});
