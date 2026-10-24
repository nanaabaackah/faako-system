import test from "node:test";
import assert from "node:assert/strict";
import { readHostedPrerequisites, verifyHostedDatabase } from "../src/portal/readiness.js";

const env = { APP_ENV: "staging", NODE_ENV: "production", ALLOWED_ORIGINS: "https://portal.example.test",
  TWE_AUTH_MODE: "cloudflare_access", TWE_ACCESS_TEAM_DOMAIN: "https://fixture.cloudflareaccess.com",
  TWE_ACCESS_AUDIENCE: "a".repeat(64), TWE_PORTAL_ORIGIN: "https://portal.example.test",
  TWE_ORGANISATION_ID: "10000000-0000-4000-8000-000000000001", TWE_RELEASE_SHA: "b".repeat(40) };

test("hosted preflight requires explicit reviewed configuration and rejects local adapters", () => {
  assert.equal(readHostedPrerequisites(env).environment, "staging");
  for (const patch of [{ NODE_ENV: "development" }, { APP_ENV: "development" }, { TWE_RELEASE_SHA: "" }, { TWE_ACCESS_AUDIENCE: "" }, { TWE_AGENT_API_TOKEN: "fixture" }, { TWE_LOCAL_DATA_FILE: "fixture" }, { ALLOWED_ORIGINS: "https://other.example.test" }]) {
    assert.throws(() => readHostedPrerequisites({ ...env, ...patch }));
  }
});

test("read-only preflight denies wrong database tenant/version/role or migration history", async () => {
  const identity = readHostedPrerequisites(env);
  const migrations = [{ name: "006_access_roles.sql", checksum: "fixture" }];
  const pool = (changes = {}) => ({ async query(sql) {
    assert.match(sql, /^(SELECT|SHOW) /);
    if (sql.includes("environment_identity")) return { rows: [{ environment: "staging", organisation_id: identity.organisationId, ...changes.identity }] };
    if (sql.startsWith("SHOW")) return { rows: [{ server_version_num: changes.version || "170011" }] };
    if (sql.includes("pg_roles")) return { rows: [{ rolsuper: false, rolbypassrls: false, ...changes.role }] };
    if (sql.includes("schema_migrations")) return { rows: changes.migrations || migrations };
    return { rows: changes.org || [{ id: identity.organisationId }] };
  } });
  assert.deepEqual(await verifyHostedDatabase(pool(), identity, migrations), { databaseMajor: 17, migrations: 1, identityVerified: true });
  for (const changes of [{ identity: { environment: "production" } }, { identity: { organisation_id: "other" } }, { version: "160015" }, { role: { rolsuper: true } }, { role: { rolbypassrls: true } }, { migrations: [] }, { migrations: [{ name: migrations[0].name, checksum: "changed" }] }, { org: [] }]) {
    await assert.rejects(verifyHostedDatabase(pool(changes), identity, migrations));
  }
});
