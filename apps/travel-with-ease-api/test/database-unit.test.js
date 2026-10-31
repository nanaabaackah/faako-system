import test from "node:test";
import assert from "node:assert/strict";
import { databaseOptions, transaction, verifyDatabaseIdentity } from "../src/db/database.js";
import { readMigrations } from "../src/db/migrations.js";

test("database configuration requires verified TLS except explicit local test/development", () => {
  const env = { APP_ENV: "test", DATABASE_URL: "postgresql://localhost/twe_test_unit", TWE_DATABASE_TLS: "disable" };
  assert.equal(databaseOptions(env).ssl, false);
  assert.equal(databaseOptions({ ...env, TWE_DATABASE_TLS: "require" }).ssl.rejectUnauthorized, true);
  for (const override of [
    { APP_ENV: "staging" }, { APP_ENV: "production" },
    { DATABASE_URL: "postgresql://remote.example/twe" },
    { DATABASE_URL: "postgresql://localhost/twe?sslmode=no-verify" },
    { DATABASE_URL: "https://localhost/twe" }, { DATABASE_URL: "invalid-secret-value" },
  ]) assert.throws(() => databaseOptions({ ...env, ...override }));
});

test("transactions pin a client, rollback on failure and always release", async () => {
  for (const fail of [false, true]) {
    const queries = [];
    let released = false;
    const client = { async query(sql) { queries.push(sql); }, release() { released = true; } };
    const pool = { async connect() { return client; } };
    const operation = transaction(pool, async (connection) => {
      assert.equal(connection, client);
      await connection.query("WORK");
      if (fail) throw new Error("synthetic failure");
      return "saved";
    });
    if (fail) await assert.rejects(operation, /synthetic failure/);
    else assert.equal(await operation, "saved");
    assert.deepEqual(queries, ["BEGIN", "WORK", fail ? "ROLLBACK" : "COMMIT"]);
    assert.equal(released, true);
  }
});

test("rollback connection failure destroys client and preserves original error", async () => {
  let releaseError;
  const client = { async query(sql) { if (sql === "ROLLBACK") throw new Error("connection gone"); }, release(error) { releaseError = error; } };
  await assert.rejects(transaction({ async connect() { return client; } }, () => { throw new Error("original failure"); }), /original failure/);
  assert.match(releaseError.message, /connection gone/);
});

test("database identity refuses environment and organisation mismatch", async () => {
  const client = { async query() { return { rows: [{ environment: "production", organisation_id: "org-a" }] }; } };
  await assert.rejects(verifyDatabaseIdentity(client, { environment: "staging", organisationId: "org-a" }));
  await assert.rejects(verifyDatabaseIdentity(client, { environment: "production", organisationId: "org-b" }));
  await verifyDatabaseIdentity(client, { environment: "production", organisationId: "org-a" });
});

test("migration inventory is deterministic and excludes historical CRM SQL", async () => {
  const files = await readMigrations();
  assert.deepEqual(files.map((file) => file.name), ["001_foundation.sql", "002_auth_flows.sql", "003_notification_delivery.sql", "004_publication_lifecycle.sql", "005_login_preference.sql", "006_access_roles.sql", "007_tutorial_progress.sql", "008_staff_invitations.sql", "009_drive_media_source.sql"]);
  assert.match(files[0].checksum, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readMigrations(), files);
});
