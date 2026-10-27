import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readDeployConfig } from "../src/db/deploy-config.js";
import { DatabaseConfigurationError } from "../src/db/configuration-error.js";

const env = { APP_ENV: "staging", NODE_ENV: "production", TWE_MIGRATION_APPROVED_ENV: "staging",
  DATABASE_URL: "postgresql://twe_runtime@postgres.example/twe",
  TWE_MIGRATION_DATABASE_URL: "postgresql://twe_migrator@postgres.example/twe",
  TWE_ORGANISATION_ID: "10000000-0000-4000-8000-000000000001" };

test("configuration failures produce actionable, secret-free deployment logs", () => {
  const sentinel = "DO_NOT_LOG_PRIVATE_VALUE";
  const cases = [
    [{ APP_ENV: "invalid" }, "hosted_environment_invalid", "APP_ENV"],
    [{ NODE_ENV: sentinel }, "hosted_environment_invalid", "NODE_ENV"],
    [{ TWE_MIGRATION_APPROVED_ENV: sentinel }, "migration_approval_mismatch", "TWE_MIGRATION_APPROVED_ENV"],
    [{ TWE_DB_INITIALISE: sentinel }, "initialise_invalid", "TWE_DB_INITIALISE"],
    [{ TWE_ORGANISATION_ID: sentinel }, "organisation_id_invalid", "TWE_ORGANISATION_ID"],
    [{ DATABASE_URL: sentinel }, "runtime_url_invalid", "DATABASE_URL"],
    [{ TWE_MIGRATION_DATABASE_URL: sentinel }, "migration_url_invalid", "TWE_MIGRATION_DATABASE_URL"],
    [{ DATABASE_URL: env.DATABASE_URL + "?sslmode=" + sentinel }, "runtime_url_options_forbidden", "DATABASE_URL"],
    [{ TWE_MIGRATION_DATABASE_URL: env.TWE_MIGRATION_DATABASE_URL + "#" + sentinel }, "migration_url_options_forbidden", "TWE_MIGRATION_DATABASE_URL"],
    [{ TWE_DATABASE_TLS: "disable" }, "database_tls_disabled", "TWE_DATABASE_TLS"],
    [{ DATABASE_URL: "postgresql://twe_runtime:secret@" + sentinel + "/twe" }, "database_endpoint_mismatch", "host, port and database"],
    [{ DATABASE_URL: env.TWE_MIGRATION_DATABASE_URL }, "database_roles_not_separate", "distinct database usernames"],
    [{ DATABASE_URL: "postgresql://%ZZ:secret@postgres.example/twe" }, "database_username_invalid", "percent encoding"],
    [{ TWE_DB_INITIALISE: "true" }, "organisation_name_invalid", "TWE_ORGANISATION_NAME"],
    [{ DATABASE_URL: "postgresql://" + sentinel + ":secret@postgres.example/twe" }, "runtime_role_invalid", "DATABASE_URL"],
  ];
  for (const [patch, code, guidance] of cases) {
    const configuration = { ...env, ...patch };
    assert.throws(() => readDeployConfig(configuration), (error) =>
      error instanceof DatabaseConfigurationError && error.code === code && error.message.includes(guidance));
    // Isolated environment: never inherit real database settings or credentials.
    const result = spawnSync(process.execPath, ["scripts/deploy-database.mjs"], {
      cwd: new URL("../", import.meta.url), encoding: "utf8",
      env: { ...configuration, PATH: process.env.PATH, LOG_LEVEL: "info" },
      timeout: 10000,
    });
    assert.equal(result.status, 1, result.error?.message);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes(code), output);
    assert.ok(output.includes(guidance), output);
    assert.ok(!output.includes(sentinel), output);
    assert.ok(!output.includes("postgresql://"), output);
    assert.ok(!output.includes("database_unavailable"), output);
  }
  assert.equal(readDeployConfig({ ...env, TWE_DATABASE_TLS: "require" }).environment, "staging");
});

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
