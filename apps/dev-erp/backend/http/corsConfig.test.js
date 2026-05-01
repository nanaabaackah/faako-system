import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DEV_CORS_ORIGINS,
  createAllowedOriginPolicy,
  createCorsOriginValidator,
} from "./corsConfig.js";

test("createAllowedOriginPolicy fails closed in production when CORS_ORIGINS is unset", () => {
  const policy = createAllowedOriginPolicy({
    isProduction: true,
    corsOriginsEnv: "",
  });

  assert.equal(policy.allowAllOrigins, false);
  assert.equal(policy.allowedOriginSet.size, 0);

  let allowed = false;
  let error = null;
  createCorsOriginValidator(policy)("https://evil.example", (receivedError, isAllowed) => {
    error = receivedError;
    allowed = Boolean(isAllowed);
  });

  assert.equal(allowed, false);
  assert.equal(error?.message, "Not allowed by CORS");
});

test("createAllowedOriginPolicy uses safe localhost defaults in development", () => {
  const policy = createAllowedOriginPolicy({
    isProduction: false,
    corsOriginsEnv: "",
  });

  assert.equal(policy.allowAllOrigins, false);
  assert.deepEqual(
    Array.from(policy.allowedOriginSet.values()).sort(),
    [...DEFAULT_DEV_CORS_ORIGINS].sort()
  );
});
