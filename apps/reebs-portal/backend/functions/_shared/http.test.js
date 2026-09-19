import assert from "node:assert/strict";
import test from "node:test";

import { resolveAllowedOrigins } from "./http.js";

test("development CORS keeps local application origins", () => {
  const origins = resolveAllowedOrigins({ appEnvironment: "development", env: {} });
  assert.equal(origins.includes("http://localhost:5174"), true);
});

test("staging CORS is explicit and does not inherit production or local origins", () => {
  const origins = resolveAllowedOrigins({
    appEnvironment: "staging",
    env: { CORS_ORIGINS_STAGING: "https://portal.staging.example.test" },
  });
  assert.deepEqual(origins, ["https://portal.staging.example.test"]);
});

test("production CORS retains the published REEBS origins", () => {
  const origins = resolveAllowedOrigins({ appEnvironment: "production", env: {} });
  assert.equal(origins.includes("https://portal.reebspartythemes.com"), true);
  assert.equal(origins.some((origin) => origin.includes("localhost")), false);
});
