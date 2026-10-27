import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDeployConfig } from "../src/db/deploy-config.js";

const env = { APP_ENV: "staging", NODE_ENV: "production", TWE_MIGRATION_APPROVED_ENV: "staging",
  DATABASE_URL: "postgresql://twe_runtime@postgres.example/twe",
  TWE_MIGRATION_DATABASE_URL: "postgresql://twe_migrator@postgres.example/twe",
  TWE_ORGANISATION_ID: "10000000-0000-4000-8000-000000000001" };

test("predeploy requires explicit environment approval and separate roles on one target", () => {
  assert.equal(readDeployConfig(env).initialise, false);
  assert.equal(readDeployConfig(env).runtimeRole, "twe_runtime");
  for (const patch of [{ APP_ENV: "production" }, { APP_ENV: undefined }, { NODE_ENV: "development" },
    { TWE_MIGRATION_APPROVED_ENV: "" }, { TWE_MIGRATION_DATABASE_URL: env.DATABASE_URL },
    { TWE_MIGRATION_DATABASE_URL: "postgresql://twe_migrator@other.example/twe" },
    { TWE_MIGRATION_DATABASE_URL: "postgresql://twe_migrator@postgres.example/other" },
    { TWE_DATABASE_TLS: "disable" }, { TWE_DB_INITIALISE: "yes" }, { TWE_DB_INITIALISE: "true" },
    { TWE_ORGANISATION_ID: "invalid" }]) assert.throws(() => readDeployConfig({ ...env, ...patch }));
  assert.equal(readDeployConfig({ ...env, TWE_DB_INITIALISE: "true", TWE_ORGANISATION_NAME: "Travel With Ease" }).organisationName, "Travel With Ease");
  assert.equal(readDeployConfig({ ...env, APP_ENV: "production", TWE_MIGRATION_APPROVED_ENV: "production" }).environment, "production");
});

test("Railway uses a predeploy step, not startup migrations or local env files", () => {
  const config = JSON.parse(readFileSync(new URL("../railway.json", import.meta.url)));
  assert.deepEqual(config.deploy.preDeployCommand, ["pnpm --filter @faako/travel-with-ease-api db:deploy"]);
  assert.equal(config.deploy.startCommand, "pnpm --filter @faako/travel-with-ease-api start");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(pkg.scripts["db:deploy"], "node scripts/deploy-database.mjs");
});
