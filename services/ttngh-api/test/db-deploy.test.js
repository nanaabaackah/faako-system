import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  approvedMigrationFiles, MigrationError, unwrapMigrationSql,
  readApprovedMigrations, deployMigrations
} from "../src/db/migrations.js";

function mockDatabase({ enquiries = false, outbox = false, history = [], failMigration = false } = {}) {
  let state = { enquiries, outbox, history: history.map((x) => ({ ...x })) };
  let before = null;
  let fail = failMigration;
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push(sql);
      if (sql === "BEGIN") {
        before = structuredClone(state);
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        state = before;
        before = null;
        return { rows: [] };
      }
      if (sql === "COMMIT") {
        before = null;
        return { rows: [] };
      }
      if (sql.includes("SELECT name, checksum FROM ttngh_contact.schema_migrations")) {
        return { rows: state.history.map((x) => ({ ...x })) };
      }
      if (sql.startsWith("SELECT to_regclass(")) {
        return { rows: [{
          enquiries: state.enquiries ? "ttngh_contact.enquiries" : null,
          notification_outbox: state.outbox ? "ttngh_contact.notification_outbox" : null
        }] };
      }
      if (sql.includes("CREATE TABLE ttngh_contact.enquiries")) {
        if (fail) {
          fail = false;
          throw Object.assign(new Error("synthetic migration failure"), { code: "42601" });
        }
        state.enquiries = true;
        state.outbox = true;
      }
      if (sql.startsWith("INSERT INTO ttngh_contact.schema_migrations")) {
        state.history.push({ name: params[0], checksum: params[1] });
      }
      if (sql.startsWith("SELECT id FROM ttngh_contact.enquiries") && !state.enquiries ||
          sql.startsWith("SELECT id FROM ttngh_contact.notification_outbox") && !state.outbox) {
        throw Object.assign(new Error("missing table"), { code: "42P01" });
      }
      return { rows: [] };
    },
    release() { statements.push("RELEASE"); }
  };
  return { pool: { async connect() { return client; } }, statements, get state() { return state; } };
}

test("automatic migration inventory includes enquiries but never donations", async () => {
  assert.deepEqual(approvedMigrationFiles, ["002-enquiries.sql"]);
  const [migration] = await readApprovedMigrations();
  assert.equal(migration.name, "002-enquiries.sql");
  assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  assert.match(migration.sql, /CREATE TABLE ttngh_contact.enquiries/);
  assert.match(migration.sql, /CREATE TABLE ttngh_contact.notification_outbox/);
  assert.doesNotMatch(migration.sql, /^\s*BEGIN;|\sCOMMIT;\s*$/);
  assert.throws(() => unwrapMigrationSql("CREATE TABLE x (id int);"), MigrationError);
});

test("first pre-deploy applies enquiry migration, records checksum and verifies tables", async () => {
  const db = mockDatabase();
  assert.deepEqual(await deployMigrations(db.pool), ["002-enquiries.sql"]);
  assert.equal(db.state.enquiries, true);
  assert.equal(db.state.outbox, true);
  assert.equal(db.state.history.length, 1);
  assert.equal(db.state.history[0].name, "002-enquiries.sql");
  assert.match(db.state.history[0].checksum, /^[a-f0-9]{64}$/);
  assert.ok(db.statements.includes("SELECT pg_advisory_xact_lock(821026002)"));
  assert.ok(db.statements.includes("COMMIT"));
  assert.ok(!db.statements.includes("ROLLBACK"));
});

test("second and later pre-deploys skip the existing migration", async () => {
  const db = mockDatabase();
  await deployMigrations(db.pool);
  assert.deepEqual(await deployMigrations(db.pool), []);
  assert.equal(db.state.history.length, 1);
  assert.equal(db.statements.filter((sql) => sql.includes("CREATE TABLE ttngh_contact.enquiries")).length, 1);
});

test("untracked existing schema stops without adopting or altering it", async () => {
  const db = mockDatabase({ enquiries: true, outbox: false });
  await assert.rejects(deployMigrations(db.pool), { code: "migration_untracked_schema" });
  assert.equal(db.state.history.length, 0);
  assert.equal(db.state.enquiries, true);
  assert.equal(db.state.outbox, false);
  assert.ok(db.statements.includes("ROLLBACK"));
});

test("checksum drift and unknown migration history stop deployment", async () => {
  const mismatch = mockDatabase({
    enquiries: true, outbox: true,
    history: [{ name: "002-enquiries.sql", checksum: "0".repeat(64) }]
  });
  await assert.rejects(deployMigrations(mismatch.pool), { code: "migration_checksum_mismatch" });
  const unknown = mockDatabase({
    history: [{ name: "001-donations.sql", checksum: "0".repeat(64) }]
  });
  await assert.rejects(deployMigrations(unknown.pool), { code: "migration_history_unknown" });
});

test("a migration failure rolls back and is safely retried", async () => {
  const db = mockDatabase({ failMigration: true });
  await assert.rejects(deployMigrations(db.pool));
  assert.equal(db.state.enquiries, false);
  assert.equal(db.state.outbox, false);
  assert.equal(db.state.history.length, 0);
  assert.deepEqual(await deployMigrations(db.pool), ["002-enquiries.sql"]);
});

test("Railway runs migrations before API start, not on PostgreSQL service", () => {
  const railway = JSON.parse(readFileSync(new URL("../railway.json", import.meta.url)));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.deepEqual(railway.deploy.preDeployCommand, ["pnpm --filter @faako/ttngh-api db:deploy"]);
  assert.equal(railway.deploy.startCommand, "pnpm --filter @faako/ttngh-api start");
  assert.equal(pkg.scripts["db:deploy"], "node scripts/deploy-database.mjs");
});

test("pre-deploy refuses an absent or invalid DATABASE_URL without exposing it", () => {
  for (const value of [undefined, "not-a-database-url"]) {
    const env = { PATH: process.env.PATH };
    if (value) env.DATABASE_URL = value;
    const result = spawnSync(process.execPath, [new URL("../scripts/deploy-database.mjs", import.meta.url).pathname], {
      encoding: "utf8", env, timeout: 10000
    });
    assert.equal(result.status, 1, String(result.error));
    assert.match(result.stderr, /TTNGH database pre-deploy failed: migration_database_url_/);
    assert.doesNotMatch(result.stderr, /postgresql:\/\//);
  }
});
