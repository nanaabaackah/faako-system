import test from "node:test";
import assert from "node:assert/strict";
import { inspectMigrationState } from "../src/db/migration-preflight.js";

const organisationId = "11111111-1111-4111-8111-111111111111";
const options = { environment: "production", organisationId, runtimeRole: "twe_runtime" };
const migrations = [{ name: "001_initial.sql", checksum: "a", sql: "MUST NEVER RUN" }, { name: "002_next.sql", checksum: "b", sql: "MUST NEVER RUN" }];

function fixture({ schema = true, history = [{ name: "001_initial.sql", checksum: "a" }], privileged = false, environment = "production" } = {}) {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("to_regnamespace")) return { rows: [{ schema: schema ? "twe" : null }] };
      if (sql.includes("environment_identity")) return { rows: [{ environment, organisation_id: organisationId }] };
      if (sql.includes("schema_migrations")) return { rows: history };
      if (sql.includes("FROM pg_roles")) return { rows: [{ oid: 101, rolsuper: privileged }] };
      if (sql.includes("has_schema_privilege")) return { rows: [{ allowed: false }] };
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  };
  return { pool: { connect: async () => client }, statements, released: () => released };
}

test("migration preflight reports pending files using a read-only snapshot", async () => {
  const f = fixture();
  assert.deepEqual(await inspectMigrationState(f.pool, options, migrations), { schemaExists: true, applied: 1, pending: ["002_next.sql"] });
  assert.equal(f.statements[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(f.statements.at(-1), "COMMIT");
  assert.ok(f.statements.every(sql => /^(BEGIN|SELECT|COMMIT)/.test(sql)));
  assert.equal(f.released(), true);
});

test("migration preflight blocks identity, ledger, and privileged runtime role mismatches", async () => {
  for (const [config, pattern] of [
    [{ environment: "staging" }, /environment or organisation/],
    [{ history: [{ name: "001_initial.sql", checksum: "changed" }] }, /Migration history differs/],
    [{ history: [{ name: "002_next.sql", checksum: "b" }] }, /Out-of-order/],
    [{ privileged: true }, /missing or privileged/],
    [{ schema: false }, /Fresh database/],
  ]) {
    const f = fixture(config);
    await assert.rejects(inspectMigrationState(f.pool, options, migrations), pattern);
    assert.equal(f.statements.at(-1), "ROLLBACK");
    assert.equal(f.released(), true);
    assert.ok(f.statements.every(sql => /^(BEGIN|SELECT|ROLLBACK)/.test(sql)));
  }
});

test("explicitly approved fresh schema is reported, not created", async () => {
  const f = fixture({ schema: false });
  const result = await inspectMigrationState(f.pool, { ...options, initialise: true }, migrations);
  assert.deepEqual(result, { schemaExists: false, applied: 0, pending: migrations.map(file => file.name) });
  assert.ok(f.statements.every(sql => /^(BEGIN|SELECT|COMMIT)/.test(sql)));
});
