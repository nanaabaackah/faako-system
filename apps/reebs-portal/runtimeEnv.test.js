/* eslint-disable no-undef */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const runtimeModuleUrl = new URL("./runtimeEnv.js", import.meta.url).href;
const safeEnvironment = (overrides = {}) => ({
  APP_ENV: "development",
  NODE_ENV: "development",
  REEBS_SKIP_ENV_FILES: "true",
  ...overrides,
});

const readRuntimeSummary = (overrides) => JSON.parse(execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `const runtime = await import(${JSON.stringify(runtimeModuleUrl)}); console.log(JSON.stringify({ appEnvironment: runtime.APP_ENV, deployed: runtime.isDeployedRuntime, production: runtime.isProductionRuntime, hasDatabase: Boolean(runtime.DATABASE_URL) }));`,
  ],
  {
    encoding: "utf8",
    env: safeEnvironment(overrides),
  }
));

test("runtime keeps APP_ENV distinct from NODE_ENV in all supported environments", () => {
  assert.deepEqual(readRuntimeSummary({ APP_ENV: "development" }), {
    appEnvironment: "development",
    deployed: false,
    production: false,
    hasDatabase: false,
  });
  assert.deepEqual(readRuntimeSummary({
    APP_ENV: "staging",
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://placeholder:placeholder@staging.example.test:5432/reebs",
  }), {
    appEnvironment: "staging",
    deployed: true,
    production: false,
    hasDatabase: true,
  });
  assert.deepEqual(readRuntimeSummary({
    APP_ENV: "production",
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://placeholder:placeholder@production.example.test:5432/reebs",
  }), {
    appEnvironment: "production",
    deployed: true,
    production: true,
    hasDatabase: true,
  });
});

test("invalid APP_ENV and an ambiguous production-style runtime fail closed", () => {
  const invalid = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(runtimeModuleUrl)});`], {
    encoding: "utf8",
    env: safeEnvironment({ APP_ENV: "preview" }),
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Invalid APP_ENV/);

  const missing = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(runtimeModuleUrl)});`], {
    encoding: "utf8",
    env: {
      NODE_ENV: "production",
      REEBS_SKIP_ENV_FILES: "true",
    },
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /APP_ENV is required/);
});

test("staging never falls back to the production database alias", () => {
  const summary = readRuntimeSummary({
    APP_ENV: "staging",
    NODE_ENV: "production",
    DATABASE_URL_PRODUCTION: "postgresql://placeholder:placeholder@production.example.test:5432/reebs",
  });
  assert.equal(summary.hasDatabase, false);
});

test("deployed runtimes reject local database targets", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(runtimeModuleUrl)});`], {
    encoding: "utf8",
    env: safeEnvironment({
      APP_ENV: "staging",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/reebs",
    }),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local database host/);
});
