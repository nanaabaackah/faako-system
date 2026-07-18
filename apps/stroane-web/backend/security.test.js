import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiRateLimitMiddleware,
  createCorsOptions,
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

const validateOrigin = (validator, origin) => {
  let allowed = false;
  let error = null;
  validator(origin, (receivedError, isAllowed) => {
    error = receivedError;
    allowed = Boolean(isAllowed);
  });
  return { allowed, error };
};

test("resolveAllowedOrigins allows an explicitly configured production origin", () => {
  const allowedOrigins = resolveAllowedOrigins({
    APP_ENV: "production",
    CORS_ORIGINS: "https://stroanesolutions.com",
  });
  assert.equal(allowedOrigins.has("https://stroanesolutions.com"), true);
  const { allowed, error } = validateOrigin(
    createCorsOriginValidator({ allowedOrigins }),
    "https://stroanesolutions.com"
  );
  assert.equal(allowed, true);
  assert.equal(error, null);
});

test("resolveAllowedOrigins allows an explicitly configured staging origin", () => {
  const allowedOrigins = resolveAllowedOrigins({
    APP_ENV: "staging",
    CORS_ORIGINS: "https://stage.stroanesolutions.com",
  });
  const result = validateOrigin(
    createCorsOriginValidator({ allowedOrigins }),
    "https://stage.stroanesolutions.com"
  );
  assert.equal(result.allowed, true);
  assert.equal(result.error, null);
  assert.equal(allowedOrigins.has("http://localhost:5175"), false);
});

test("resolveAllowedOrigins allows localhost defaults only in development", () => {
  const allowedOrigins = resolveAllowedOrigins({ APP_ENV: "development", CORS_ORIGINS: "" });
  const result = validateOrigin(
    createCorsOriginValidator({ allowedOrigins }),
    "http://localhost:5175"
  );
  assert.equal(result.allowed, true);
  assert.equal(result.error, null);
});

test("an exact configured Pages preview origin is allowed", () => {
  const allowedOrigins = resolveAllowedOrigins({
    APP_ENV: "development",
    CORS_ORIGINS: "https://owned-preview.pages.dev",
  });
  const result = validateOrigin(
    createCorsOriginValidator({ allowedOrigins }),
    "https://owned-preview.pages.dev"
  );
  assert.equal(result.allowed, true);
  assert.equal(result.error, null);
});

test("an unrelated attacker Pages origin is rejected", () => {
  const allowedOrigins = resolveAllowedOrigins({
    APP_ENV: "development",
    CORS_ORIGINS: "https://owned-preview.pages.dev",
  });
  const result = validateOrigin(
    createCorsOriginValidator({ allowedOrigins }),
    "https://attacker.pages.dev"
  );
  assert.equal(result.allowed, false);
  assert.equal(result.error?.statusCode, 403);
});

test("an unrelated HTTPS origin is rejected", () => {
  const allowedOrigins = resolveAllowedOrigins({
    APP_ENV: "production",
    CORS_ORIGINS: "https://stroanesolutions.com",
  });
  const result = validateOrigin(createCorsOriginValidator({ allowedOrigins }), "https://evil.example");
  assert.equal(result.allowed, false);
  assert.equal(result.error?.statusCode, 403);
});

test("requests without an Origin header remain allowed", () => {
  const allowedOrigins = resolveAllowedOrigins({ APP_ENV: "production", CORS_ORIGINS: "" });
  const result = validateOrigin(createCorsOriginValidator({ allowedOrigins }), undefined);
  assert.equal(result.allowed, true);
  assert.equal(result.error, null);
});

test("credentialed CORS uses exact origins and never broad Pages matching", () => {
  const options = createCorsOptions({
    APP_ENV: "production",
    CORS_ORIGINS: "https://stroanesolutions.com",
  });
  assert.equal(options.credentials, true);
  assert.equal(validateOrigin(options.origin, "https://stroanesolutions.com").allowed, true);
  assert.equal(validateOrigin(options.origin, "https://attacker.pages.dev").allowed, false);
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

test("api rate limit middleware can scope limits to specific methods", () => {
  const middleware = createApiRateLimitMiddleware({
    limit: 1,
    windowMs: 60_000,
    methods: ["POST"],
  });
  const response = createMockResponse();
  let nextCalled = false;

  middleware(
    {
      method: "GET",
      ip: "203.0.113.10",
      headers: {},
    },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const postResponse = createMockResponse();
    let postNextCalled = false;
    middleware(
      {
        method: "POST",
        ip: "203.0.113.10",
        headers: {},
      },
      postResponse,
      () => {
        postNextCalled = true;
      }
    );

    assert.equal(postNextCalled, attempt === 0);
    assert.equal(postResponse.statusCode, attempt === 0 ? 200 : 429);
  }
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
