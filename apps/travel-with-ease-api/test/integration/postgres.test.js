import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase, transaction, verifyDatabaseIdentity } from "../../src/db/database.js";
import { migrate, readMigrations } from "../../src/db/migrations.js";
import { PostgresLeadRepository } from "../../src/db/repository.js";
import { PostgresAuthStore } from "../../src/auth/store.js";
import { ContentRepository } from "../../src/content/repository.js";
import { MediaService } from "../../src/media/service.js";
import sharp from "sharp";
import { NotificationOutbox } from "../../src/notifications/outbox.js";
import { PublicationRepository, manifestDigest } from "../../src/content/publication.js";
import { preparePublication } from "../../src/content/artifact.js";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
  await assert.rejects(migrate(pool, { ...options, migrations: [...files, { name: "999_failure.sql", checksum: "synthetic", sql: "CREATE TABLE twe.must_rollback (id INTEGER); SELECT definitely_missing_column;" }] }));
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

  const concurrent = await Promise.allSettled([
    content.save("home", { ...body, heading: "Concurrent A" }, restored.version, actor, "concurrent-a"),
    content.save("home", { ...body, heading: "Concurrent B" }, restored.version, actor, "concurrent-b"),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.find((result) => result.status === "rejected").reason.status, 409);

  const objects = new Map();
  const storage = { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { return objects.get(key); }, async remove(key) { objects.delete(key); } };
  const media = new MediaService(pool, organisationId, storage);
  const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#010c33" } }).png().toBuffer();
  const asset = await media.upload(image, "image/png", { alt: "Synthetic fixture", rights: "Generated test fixture" }, actor, "media-upload");
  assert.equal(objects.size, 3);
  assert.equal((await media.list()).items.some((item) => item.id === asset.id), true);
  assert.equal((await sharp(await media.preview(asset.id)).metadata()).format, "webp");
  await assert.rejects(new MediaService(pool, otherOrg, storage).preview(asset.id), { status: 404 });
  const home = await content.get("home");
  await content.save("home", { ...body, imageId: asset.id }, home.version, actor, "image-selected");
  await assert.rejects(media.archive(asset.id, actor, "archive-in-use"), { status: 409 });
  const replacement = await media.upload(image, "image/png", { alt: "Replacement fixture", rights: "Generated test fixture" }, actor, "media-replace", asset.id);
  assert.notEqual(replacement.id, asset.id);
  assert.equal((await content.get("home")).body.imageId, asset.id);
  await media.archive(replacement.id, actor, "archive-unused");
  assert.equal((await media.list()).items.some((item) => item.id === replacement.id), false);
  const objectCount = objects.size;
  await assert.rejects(media.upload(image, "image/png", { alt: "Rejected fixture", rights: "Generated test fixture" }, { ...actor, id: randomUUID() }, "media-db-failure"));
  assert.equal(objects.size, objectCount, "Database failure removes all candidate storage objects");

  const sessionHashes = ["b".repeat(64), "c".repeat(64)];
  for (const token of sessionHashes) await auth.createSession({ issuer: "https://id.example.invalid", subject }, token, "a".repeat(64), "multi-session");
  await auth.revokeAll(userId, "revoke-all");
  for (const token of sessionHashes) assert.equal(await auth.getSession(token), undefined);
  await auth.recordDenied("denied-login");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM twe.audit_records WHERE organisation_id = $1 AND action = 'auth.denied' AND request_id = 'denied-login'", [organisationId])).rows[0].count > 0, true);

  const outbox = new NotificationOutbox(pool, organisationId);
  const payload = { from: "test@example.invalid", to: ["sink@example.invalid"], subject: "Synthetic", text: "Test" };
  const claims = await Promise.all([outbox.claim(payload), outbox.claim(payload)]);
  assert.equal(claims.filter(Boolean).length, 1, "Concurrent workers cannot own the same job");
  const claimed = claims.find(Boolean);
  assert.equal(await new NotificationOutbox(pool, otherOrg).claim(payload), undefined);
  await pool.query("UPDATE twe.notification_outbox SET lease_until = now() - interval '1 second' WHERE id = $1", [claimed.id]);
  const reclaimed = await outbox.claim({ ...payload, text: "Changed configuration must not rewrite retry payload" });
  assert.notEqual(reclaimed.lease_token, claimed.lease_token);
  assert.deepEqual(reclaimed.delivery_payload, payload);
  assert.equal(await outbox.finish(claimed, "stale-worker"), false);
  await outbox.fail(reclaimed);
  assert.equal(await outbox.claim(payload), undefined, "Backoff prevents immediate retry");
  await pool.query("UPDATE twe.notification_outbox SET first_attempt_at = now() - interval '25 hours', available_at = now() WHERE id = $1", [claimed.id]);
  assert.equal(await outbox.claim(payload), undefined);
  assert.equal((await pool.query("SELECT status, last_error FROM twe.notification_outbox WHERE id = $1", [claimed.id])).rows[0].status, "failed");

  // The raw SQL revision fixture above is deliberately not an approved page.
  // Its unpublished body must never enter a publication artifact.
  const publication = new PublicationRepository(pool, { ...options, sourceSha: "a".repeat(40) });
  const latestHome = await content.get("home");
  const queued = await publication.enqueue("home", latestHome.version, false, actor, "publish-home");
  assert.equal(queued.status, "pending");
  assert.equal(await content.get("home", true), null);
  await assert.rejects(publication.enqueue("home", latestHome.version, false, actor, "duplicate-publish"), { status: 409 });
  const build = await publication.claim();
  assert.equal(await publication.claim(), undefined);
  await assert.rejects(pool.query("UPDATE twe.publication_jobs SET manifest = '{}' WHERE id = $1", [build.id]), /immutable/);
  await assert.rejects(publication.confirm(build.id, randomUUID(), "synthetic-deployment", manifestDigest(build.manifest)));
  await publication.fail(build.id, build.build_token);
  assert.equal(await content.get("home", true), null);
  await publication.retry(build.id, actor, "retry-build");
  const retried = await publication.claim();
  assert.deepEqual(retried.manifest, build.manifest);
  const newerDraft = await content.save("home", { ...body, heading: "PRIVATE newer draft" }, latestHome.version, actor, "newer-draft");
  const artifactDirectory = await mkdtemp(path.join(tmpdir(), "twe-publication-test-"));
  const artifact = await preparePublication(retried, media, artifactDirectory);
  const snapshot = JSON.parse(await readFile(artifact.snapshot, "utf8"));
  assert.equal(snapshot.pages.home.heading, body.heading);
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE newer draft|object_key|Generated test fixture/);
  assert.equal(snapshot.pages.home.image.src, `/media/${asset.id}.webp`);
  console.log(`Synthetic publication artifact: ${artifactDirectory}`);
  await publication.confirm(retried.id, retried.build_token, "synthetic-deployment", artifact.marker.digest);
  assert.equal((await content.get("home", true)).body.heading, body.heading);
  assert.equal((await content.get("home")).body.heading, newerDraft.body.heading);
  const unpublished = await publication.enqueue("home", newerDraft.version, true, actor, "unpublish-home");
  const removal = await publication.claim();
  await publication.confirm(unpublished.id, removal.build_token, "synthetic-removal", manifestDigest(removal.manifest));
  assert.equal(await content.get("home", true), null);
  assert.equal((await new PublicationRepository(pool, { ...options, organisationId: otherOrg }).list()).length, 0);
  await assert.rejects(publication.retry(retried.id, actor, "stale-retry"), { status: 409 });
});
