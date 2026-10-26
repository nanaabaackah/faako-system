import test from "node:test";
import assert from "node:assert/strict";
import { readHostedPrerequisites, verifyHostedDatabase } from "../src/portal/readiness.js";
import { PublicationRepository } from "../src/content/publication.js";

const env = { APP_ENV: "staging", NODE_ENV: "production", ALLOWED_ORIGINS: "https://portal.example.test",
  TWE_AUTH_MODE: "cloudflare_access", TWE_ACCESS_TEAM_DOMAIN: "https://fixture.cloudflareaccess.com",
  TWE_ACCESS_AUDIENCE: "a".repeat(64), TWE_PORTAL_ORIGIN: "https://portal.example.test",
  TWE_ORGANISATION_ID: "10000000-0000-4000-8000-000000000001", TWE_RELEASE_SHA: "b".repeat(40) };

test("missing release SHA does not block startup but still blocks publishing before database writes", async () => {
  for (const environment of ["staging", "production"]) {
    assert.equal(readHostedPrerequisites({ ...env, APP_ENV: environment, TWE_RELEASE_SHA: "" }).environment, environment);
    const pool = { connect() { assert.fail("Publishing must reject before opening a transaction"); } };
    const repository = new PublicationRepository(pool, { organisationId: env.TWE_ORGANISATION_ID, environment });
    await assert.rejects(repository.enqueue("home", 1, false, { organisationId: env.TWE_ORGANISATION_ID }), /reviewed source revision/);
  }
});

test("hosted preflight requires explicit reviewed configuration and rejects local adapters", () => {
  assert.equal(readHostedPrerequisites(env).environment, "staging");
  assert.equal(readHostedPrerequisites({ ...env, TWE_RELEASE_SHA: "" }).environment, "staging");
  for (const patch of [{ NODE_ENV: "development" }, { APP_ENV: "development" }, { APP_ENV: undefined }, { TWE_ACCESS_AUDIENCE: "" }, { TWE_AGENT_API_TOKEN: "fixture" }, { TWE_LOCAL_DATA_FILE: "fixture" }, { ALLOWED_ORIGINS: "https://other.example.test" }]) {
    assert.throws(() => readHostedPrerequisites({ ...env, ...patch }));
  }
});

test("read-only preflight reports actual PostgreSQL major and denies unsafe identity/role/migrations", async () => {
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
  for (const [version, major] of [["160015", 16], ["170011", 17], ["180001", 18]]) {
    assert.equal((await verifyHostedDatabase(pool({ version }), identity, migrations)).databaseMajor, major);
  }
  for (const changes of [{ identity: { environment: "production" } }, { identity: { organisation_id: "other" } }, { version: "invalid" }, { version: "-1" }, { version: "0" }, { role: { rolsuper: true } }, { role: { rolbypassrls: true } }, { migrations: [] }, { migrations: [{ name: migrations[0].name, checksum: "changed" }] }, { org: [] }]) {
    await assert.rejects(verifyHostedDatabase(pool(changes), identity, migrations));
  }
});
