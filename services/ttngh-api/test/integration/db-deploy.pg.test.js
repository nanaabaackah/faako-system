import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { deployMigrations } from "../../src/db/migrations.js";

test("the real PostgreSQL pre-deploy creates enquiries once, then becomes a no-op", async (t) => {
  const connectionString = process.env.TTNGH_TEST_DATABASE_URL || "";
  if (!connectionString) return t.skip("Isolated PostgreSQL is not configured");
  const url = new URL(connectionString);
  // These tests must never be pointed at production, even accidentally.
  assert.equal(process.env.CI, "true");
  assert.equal(url.pathname, "/ttngh_migrations_ci");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));

  const pool = new pg.Pool({ connectionString, max: 2 });
  t.after(async () => { await pool.end(); });

  const before = await pool.query("SELECT to_regnamespace('ttngh_contact') AS schema");
  assert.equal(before.rows[0].schema, null, "CI database must start without a TTNGH schema");

  const script = new URL("../../scripts/deploy-database.mjs", import.meta.url).pathname;
  const run = () => spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: connectionString },
    encoding: "utf8", timeout: 20000
  });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /newly applied migrations: 1/);

  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'ttngh_contact' ORDER BY table_name"
  );
  assert.deepEqual(tables.rows.map((x) => x.table_name), [
    "enquiries", "notification_outbox", "schema_migrations"
  ]);
  const history = await pool.query(
    "SELECT name, checksum FROM ttngh_contact.schema_migrations"
  );
  assert.equal(history.rowCount, 1);
  assert.equal(history.rows[0].name, "002-enquiries.sql");
  assert.match(history.rows[0].checksum.trim(), /^[a-f0-9]{64}$/);

  // A repeated Railway deployment must never recreate or reset any tables.
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /newly applied migrations: 0/);
  assert.deepEqual(await deployMigrations(pool), []);
  const payment = await pool.query("SELECT to_regnamespace('ttngh_payments') AS schema");
  assert.equal(payment.rows[0].schema, null, "donation schema must remain unactivated");
});
