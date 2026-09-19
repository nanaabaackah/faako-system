import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_ENVIRONMENTS,
  isDeployedEnvironment,
  resolveAppEnvironment,
} from "./appEnvironment.js";

test("the application environment contract recognizes exactly three values", () => {
  assert.deepEqual(APP_ENVIRONMENTS, ["development", "staging", "production"]);
  assert.equal(resolveAppEnvironment({ APP_ENV: "development" }), "development");
  assert.equal(resolveAppEnvironment({ APP_ENV: "staging", NODE_ENV: "production" }), "staging");
  assert.equal(resolveAppEnvironment({ APP_ENV: "production", NODE_ENV: "production" }), "production");
});

test("APP_ENV remains authoritative over NODE_ENV", () => {
  assert.equal(
    resolveAppEnvironment({ APP_ENV: "staging", NODE_ENV: "production" }),
    "staging"
  );
});

test("invalid and ambiguous deployed environments fail safely", () => {
  assert.throws(() => resolveAppEnvironment({ APP_ENV: "preview" }), /Invalid APP_ENV/);
  assert.throws(
    () => resolveAppEnvironment({ NODE_ENV: "production" }),
    /APP_ENV is required/
  );
});

test("deployed environment classification includes staging and production only", () => {
  assert.equal(isDeployedEnvironment("development"), false);
  assert.equal(isDeployedEnvironment("staging"), true);
  assert.equal(isDeployedEnvironment("production"), true);
});
