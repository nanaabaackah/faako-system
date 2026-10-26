import test from "node:test";
import assert from "node:assert/strict";
import { prepareHostedStartup, prepareStagingStartup, assertApiStartup } from "../src/staging-startup.js";
import { readMigrations } from "../src/db/migrations.js";
import { PostgresLeadRepository } from "../src/db/repository.js";
import { PostgresAuthStore } from "../src/auth/store.js";
import { createStaffAuth } from "../src/auth/routes.js";
import { readAccessConfig } from "../src/auth/access-config.js";
import { createApp } from "../src/app.js";

const env = { APP_ENV: "staging", NODE_ENV: "production", ALLOWED_ORIGINS: "https://portal.example.test",
  TWE_AUTH_MODE: "cloudflare_access", TWE_ACCESS_TEAM_DOMAIN: "https://fixture.cloudflareaccess.com",
  TWE_ACCESS_AUDIENCE: "a".repeat(64), TWE_PORTAL_ORIGIN: "https://portal.example.test",
  TWE_ORGANISATION_ID: "10000000-0000-4000-8000-000000000001", TWE_RELEASE_SHA: "b".repeat(40) };

for (const environment of ["staging", "production"]) test(`${environment} requires a successful database receipt bound to the actual persistent auth adapters`, async () => {
  const settingsEnv = { ...env, APP_ENV: environment, TWE_RELEASE_SHA: "" };
  const migrations = await readMigrations();
  const pool = { async query(sql) {
    if (sql.includes("environment_identity")) return { rows: [{ environment, organisation_id: env.TWE_ORGANISATION_ID }] };
    if (sql.startsWith("SHOW")) return { rows: [{ server_version_num: "170011" }] };
    if (sql.includes("pg_roles")) return { rows: [{ rolsuper: false, rolbypassrls: false }] };
    if (sql.includes("schema_migrations")) return { rows: migrations };
    return { rows: [{ id: env.TWE_ORGANISATION_ID }] };
  } };
  const auth = (settings = readAccessConfig(env), store = new PostgresAuthStore(pool, env.TWE_ORGANISATION_ID)) => createStaffAuth({ settings, store,
    provider: { async verify() { throw new Error("Synthetic test never authenticates users"); } },
    limiter: (_req, _res, next) => next(), logger: {} });
  const options = { environment, allowedOrigins: [env.TWE_PORTAL_ORIGIN],
    repository: new PostgresLeadRepository(pool, { environment, organisationId: env.TWE_ORGANISATION_ID }), staffAuth: auth() };
  assert.throws(() => createApp(options));
  assert.throws(() => createApp({ ...options, startupReceipt: { verified: true } }));
  const startupReceipt = await prepareHostedStartup(settingsEnv, pool);
  assert.doesNotThrow(() => createApp({ ...options, startupReceipt }));
  for (const patch of [{ environment: environment === "staging" ? "production" : "staging" }, { agentToken: "fixture" }, { repository: {} }, { staffAuth: {} },
    { allowedOrigins: ["https://other.example.test"] },
    { staffAuth: auth({ ...readAccessConfig(env), audience: "c".repeat(64) }) },
    { staffAuth: auth(readAccessConfig(env), new PostgresAuthStore({}, env.TWE_ORGANISATION_ID)) },
    { staffAuth: auth(readAccessConfig(env), new PostgresAuthStore(pool, "other-tenant")) }]) {
    assert.throws(() => assertApiStartup({ ...options, startupReceipt, ...patch }));
  }
  await assert.rejects(prepareStagingStartup({ ...env, APP_ENV: "production" }, pool));
  await assert.rejects(prepareStagingStartup(env, { query: async () => { throw new Error("DB unavailable"); } }));
});
