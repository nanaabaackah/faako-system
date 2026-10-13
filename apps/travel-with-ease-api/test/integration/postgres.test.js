import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase, transaction, verifyDatabaseIdentity } from "../../src/db/database.js";
import { migrate, readMigrations } from "../../src/db/migrations.js";
import { PostgresLeadRepository } from "../../src/db/repository.js";
import { PostgresAuthStore } from "../../src/auth/store.js";
import { ContentRepository } from "../../src/content/repository.js";

test("isolated PostgreSQL migrations, constraints, scope and atomic enquiry/outbox writes", async (context) => {
  // Fail rather than silently skip: test:db is a required, explicit CI job.
  const url = new URL(process.env.TWE_TEST_DATABASE_URL || "invalid:");
  assert.equal(process.env.APP_ENV, "test", "Integration tests require APP_ENV=test");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Only disposable loopback databases are allowed");
  assert.match(url.pathname, /^\/twe_test_[a-z0-9_]+$/, "Test database must have an explicit twe_test_ name");
  const pool = createDatabase({ APP_ENV: "test", DATABASE_URL: url.href, TWE_DATABASE_TLS: "disable" });
  context.after(() => pool.end());
  const organisationId = "10000000-0000-4000-8000-000000000001";
  const otherOrg = "10000000-0000-4000-8000-000000000002";
  const options = { environment: "test", organisationId };
  const files = await readMigrations();
  await migrate(pool, { ...options, initialise: true });
  assert.deepEqual(await migrate(pool, options), []);
  await assert.rejects(migrate(pool, { ...options, environment: "staging" }), /environment or organisation/);
  await assert.rejects(migrate(pool, { ...options, migrations: [{ ...files[0], checksum: "changed" }] }), /history differs/);
  await pool.query("INSERT INTO twe.organisations (id, name) VALUES ($1, 'Synthetic TWE'), ($2, 'Synthetic other tenant') ON CONFLICT DO NOTHING", [organisationId, otherOrg]);
  await assert.rejects(migrate(pool, { ...options, migrations: [...files, { name: "002_failure.sql", checksum: "synthetic", sql: "CREATE TABLE twe.must_rollback (id INTEGER); SELECT definitely_missing_column;" }] }));
  assert.equal((await pool.query("SELECT to_regclass('twe.must_rollback') AS table_name")).rows[0].table_name, null);
  assert.deepEqual(await migrate(pool, options), []);
  await verifyDatabaseIdentity(pool, options);

  const repository = new PostgresLeadRepository(pool, options);
  await repository.ready();
  const id = randomUUID();
  const now = new Date().toISOString();
  const record = { id: randomUUID(), createdAt: now, contact: { name: "Synthetic traveller", email: "test@example.invalid" }, inquiry: { id, consentAt: now, destination: "Test destination" } };
  await repository.createLeadWithInquiry(record);
  assert.equal((await repository.listLeads()).find((item) => item.id === record.id).inquiry.id, id);
  const otherRepository = new PostgresLeadRepository(pool, { ...options, organisationId: otherOrg });
  assert.equal((await otherRepository.listLeads()).some((item) => item.inquiry.id === id), false);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM twe.notification_outbox WHERE enquiry_id = $1", [id])).rows[0].count, 1);
  await assert.rejects(repository.createLeadWithInquiry(record));
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM twe.notification_outbox WHERE enquiry_id = $1", [id])).rows[0].count, 1);
  await assert.rejects(pool.query("UPDATE twe.enquiries SET status = 'booked' WHERE id = $1", [id]));
  await assert.rejects(pool.query("INSERT INTO twe.notification_outbox (id, organisation_id, enquiry_id) VALUES ($1, $2, $3)", [randomUUID(), otherOrg, id]));

  const rolledBack = randomUUID();
  await assert.rejects(transaction(pool, async (client) => {
    await client.query("INSERT INTO twe.organisations VALUES ($1, $2)", [rolledBack, "rollback fixture"]);
    throw new Error("outbox failure simulation");
  }));
  assert.equal((await pool.query("SELECT id FROM twe.organisations WHERE id = $1", [rolledBack])).rowCount, 0);

  const userId = randomUUID();
  await pool.query("INSERT INTO twe.staff_users (id, organisation_id, issuer, subject, role) VALUES ($1, $2, 'https://id.example.invalid', $3, 'owner')", [userId, organisationId, randomUUID()]);
  const contentId = randomUUID();
  await pool.query("INSERT INTO twe.content_items (id, organisation_id, kind, slug) VALUES ($1, $2, 'page', $3)", [contentId, organisationId, `test-${randomUUID()}`]);
  const revisionId = randomUUID();
  await pool.query("INSERT INTO twe.content_revisions (id, organisation_id, content_id, version, body, editor_id) VALUES ($1, $2, $3, 1, $4, $5)", [revisionId, organisationId, contentId, { heading: "Literal '); DROP TABLE twe.enquiries; --" }, userId]);
  await assert.rejects(pool.query("UPDATE twe.content_revisions SET body = '{}' WHERE id = $1", [revisionId]), /append-only/);
  await assert.rejects(pool.query("DELETE FROM twe.content_revisions WHERE id = $1", [revisionId]), /append-only/);
  const auditId = randomUUID();
  await pool.query("INSERT INTO twe.audit_records (id, organisation_id, actor_id, action, record_id, request_id) VALUES ($1, $2, $3, 'content.saved', $4, 'integration-test')", [auditId, organisationId, userId, contentId]);
  await assert.rejects(pool.query("DELETE FROM twe.audit_records WHERE id = $1", [auditId]), /append-only/);
  await assert.rejects(pool.query("INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, status) VALUES ($1, $2, 'test', '{}', 'live')", [randomUUID(), organisationId]));

  const auth = new PostgresAuthStore(pool, organisationId);
  const subject = randomUUID();
  await pool.query("UPDATE twe.staff_users SET subject = $1 WHERE id = $2", [subject, userId]);
  const tokenHash = randomUUID().replaceAll("-", "").repeat(2);
  await auth.createSession({ issuer: "https://id.example.invalid", subject }, tokenHash, "a".repeat(64), "integration-login");
  assert.equal((await auth.getSession(tokenHash)).id, userId);
  await pool.query("UPDATE twe.staff_users SET active = false WHERE id = $1", [userId]);
  assert.equal(await auth.getSession(tokenHash), undefined);
  await pool.query("UPDATE twe.staff_users SET active = true WHERE id = $1", [userId]);
  await auth.revoke(tokenHash, "integration-logout");
  assert.equal(await auth.getSession(tokenHash), undefined);

  const content = new ContentRepository(pool, organisationId);
  const actor = { id: userId, organisationId };
  const body = { heading: "Synthetic home", body: "Plain text", seoTitle: "Test title", seoDescription: "Test description" };
  const current = await content.get("home");
  const draft = await content.save("home", body, current?.version || 0, actor, "integration-draft");
  assert.equal((await content.get("home")).body.heading, body.heading);
  assert.equal(await content.get("home", true), null);
  await assert.rejects(content.save("home", body, draft.version - 1, actor, "stale-save"), /page changed/);
  await assert.rejects(content.save("home", body, draft.version, { ...actor, organisationId: otherOrg }, "wrong-org"), /Organisation access denied/);
  await assert.rejects(content.save("home", { ...body, imageId: randomUUID() }, draft.version, actor, "missing-media"), /available image/);
  assert.equal((await content.get("home")).version, draft.version);
  const edited = await content.save("home", { ...body, heading: "Edited" }, draft.version, actor, "edit");
  const restored = await content.revert("home", draft.revisionId, edited.version, actor, "revert");
  assert.equal(restored.body.heading, body.heading);
  assert.equal(restored.version, edited.version + 1);
  assert.equal((await new ContentRepository(pool, otherOrg).history("home")).length, 0);
});
