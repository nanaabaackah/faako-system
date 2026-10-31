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
import { Administration } from "../../src/auth/administration.js";
import { TutorialService } from "../../src/onboarding/service.js";
import { Invitations } from "../../src/onboarding/invitations.js";
import { EmailTemplates } from "../../src/notifications/templates.js";
import { defaultEnquiryCopy, defaultInvitationCopy } from "../../src/notifications/enquiry-template.js";

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
  await assert.rejects(migrate(pool, options), /explicit --initialise/);
  await migrate(pool, { ...options, initialise: true, organisationName: "Synthetic TWE", migrations: files.filter(file=>file.name < "006") });
  const preservedUser=randomUUID();
  await pool.query("INSERT INTO twe.staff_users(id,organisation_id,issuer,subject,role) VALUES($1,$2,'https://legacy.invalid','preserved','editor')",[preservedUser,organisationId]);
  await migrate(pool, options);
  await pool.query("CREATE ROLE twe_test_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION");
  await migrate(pool, { ...options, initialise: true, organisationName: "Do not rename existing", runtimeRole: "twe_test_runtime" });
  assert.equal((await pool.query("SELECT name FROM twe.organisations WHERE id=$1", [organisationId])).rows[0].name, "Synthetic TWE");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM twe.audit_records WHERE action='organisation.provisioned'")).rows[0].n, 1);
  const permissions = await pool.query("SELECT has_table_privilege('twe_test_runtime','twe.enquiries','INSERT') AS can_enquire, has_table_privilege('twe_test_runtime','twe.audit_records','UPDATE') AS can_rewrite_audit, has_schema_privilege('twe_test_runtime','twe','CREATE') AS can_create, has_table_privilege('twe_test_runtime','twe.enquiries','TRUNCATE') AS can_truncate");
  assert.deepEqual(permissions.rows[0], { can_enquire: true, can_rewrite_audit: false, can_create: false, can_truncate: false });
  await assert.rejects(migrate(pool, { ...options, runtimeRole: "missing_role" }), /missing or privileged/);
  await assert.rejects(migrate(pool, { ...options, runtimeRole: "bad;role" }), /simple PostgreSQL/);
  assert.equal((await pool.query("SELECT role FROM twe.staff_users WHERE id=$1",[preservedUser])).rows[0].role,"editor");
  assert.deepEqual(await migrate(pool, options), []);
  await assert.rejects(migrate(pool, { ...options, environment: "staging" }), /environment or organisation/);
  await assert.rejects(migrate(pool, { ...options, migrations: [{ ...files[0], checksum: "changed" }] }), /history differs/);
  await pool.query("INSERT INTO twe.organisations (id, name) VALUES ($1, 'Synthetic TWE'), ($2, 'Synthetic other tenant') ON CONFLICT DO NOTHING", [organisationId, otherOrg]);
  await assert.rejects(migrate(pool, { ...options, migrations: [...files, { name: "999_failure.sql", checksum: "synthetic", sql: "CREATE TABLE twe.must_rollback (id INTEGER); SELECT definitely_missing_column;" }] }));
  assert.equal((await pool.query("SELECT to_regclass('twe.must_rollback') AS table_name")).rows[0].table_name, null);
  assert.deepEqual(await migrate(pool, options), []);
  await verifyDatabaseIdentity(pool, options);

  await context.test("activation is identity-bound, atomic, single-use and audited; tutorials survive service recreation", async () => {
    const issuer = "https://activation.example.invalid";
    const settings = { issuer, audience: "a".repeat(64) };
    const identity = subject => ({ ...settings, subject });
    const invitations = new Invitations(pool, otherOrg, settings, "test", "installer-subject");
    const input = { identity: identity("installer-subject"), subject: "new-owner", approvalReference: "TEST-1", requestId: "test-activation" };
    await assert.rejects(invitations.issue({ ...input, identity: identity("attacker") }));
    const invitation = await invitations.issue(input);
    const competing = await invitations.issue({ ...input, subject: "competing-owner" });
    await assert.rejects(invitations.claim(identity("wrong-subject"), invitation.code, "test-wrong"));
    await assert.rejects(invitations.claim({ ...identity("new-owner"), audience: "wrong" }, invitation.code, "test-wrong-aud"));
    const race = await Promise.allSettled([invitations.claim(identity("new-owner"), invitation.code, "test-claim-a"), invitations.claim(identity("new-owner"), invitation.code, "test-claim-b")]);
    assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await invitations.identityStatus(identity("new-owner"))).status, "active");
    await assert.rejects(invitations.claim(identity("competing-owner"), competing.code, "test-competing"));
    await assert.rejects(invitations.issue({ ...input, subject: "second-owner" }));
    const { rows: [owner] } = await pool.query("SELECT id,role FROM twe.staff_users WHERE organisation_id=$1 AND subject='new-owner'", [otherOrg]);
    const actor = { ...owner, organisationId: otherOrg };
    const tutorials = new TutorialService(pool, otherOrg);
    const first = await tutorials.run(actor);
    assert.equal(first.progress.status, "new");
    const started = await tutorials.run(actor, { type: "start", revision: 0 });
    assert.equal(started.progress.status, "active");
    const paused = await tutorials.run(actor, { type: "skip", revision: 1 });
    assert.equal(paused.progress.status, "paused");
    await assert.rejects(tutorials.run(actor, { type: "complete", revision: 1 }), /another tab/);
    assert.deepEqual((await new TutorialService(pool, otherOrg).run(actor)).progress, paused.progress);
    await assert.rejects(new TutorialService(pool, organisationId).run(actor));
    // Exercise the restricted runtime grants, not just the migration owner.
    const runtimeClient = await pool.connect();
    let runtimeEditor;
    try {
      await runtimeClient.query("SET ROLE twe_test_runtime");
      const query = (...args) => runtimeClient.query(...args);
      const runtimePool = { query, connect: async () => ({ query, release() {} }) };
      assert.equal((await new TutorialService(runtimePool, otherOrg).run(actor)).progress.status, "paused");
      const runtimeInvitations = new Invitations(runtimePool, otherOrg, settings, "test");
      const invited = await runtimeInvitations.issue({ actor, subject: "runtime-editor", approvalReference: "TEST-RUNTIME", requestId: "test-runtime" });
      assert.equal((await runtimeInvitations.preview(identity("runtime-editor"), invited.code)).role, "editor");
      await runtimeInvitations.claim(identity("runtime-editor"), invited.code, "test-runtime-claim");
      const { rows: [editor] } = await query("SELECT id,role FROM twe.staff_users WHERE organisation_id=$1 AND subject='runtime-editor'", [otherOrg]);
      runtimeEditor = { ...editor, organisationId: otherOrg };
      const editorTours = await new TutorialService(runtimePool, otherOrg).run(runtimeEditor);
      assert.equal(editorTours.catalogue.some(tour => ["staff", "publishing"].includes(tour.id)), false);
      await assert.rejects(runtimeInvitations.issue({ actor: runtimeEditor, subject: "escalation", approvalReference: "TEST-DENIED" }));
    } finally { await runtimeClient.query("RESET ROLE"); runtimeClient.release(); }
    const admin = new Administration(pool, otherOrg, settings, "test");
    await admin.revokeSessions(actor, runtimeEditor.id, "test-revoke-editor");
    await assert.rejects(admin.revokeSessions(actor, actor.id, "test-deny-owner"));
    await assert.rejects(admin.staffEvents(runtimeEditor));
    const editorInvite = await invitations.issue({ actor, subject: "new-editor", approvalReference: "TEST-EDITOR", requestId: "test-editor" });
    await invitations.revoke({ actor, id: editorInvite.id, requestId: "test-revoke" });
    await assert.rejects(invitations.claim(identity("new-editor"), editorInvite.code, "test-revoked"));
    const expired = await invitations.issue({ actor, subject: "expired-editor", approvalReference: "TEST-EXPIRED", requestId: "test-expired" });
    await pool.query("UPDATE twe.staff_invitations SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1", [expired.id]);
    await assert.rejects(invitations.claim(identity("expired-editor"), expired.code, "test-expired"));
    await pool.query("UPDATE twe.staff_users SET active=false WHERE id=$1", [owner.id]);
    await assert.rejects(tutorials.run(actor));
    await assert.rejects(invitations.issue({ actor, subject: "disabled-owner-editor", approvalReference: "TEST-DISABLED" }));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM twe.audit_records WHERE organisation_id=$1 AND action='staff.invitation_accepted'", [otherOrg])).rows[0].n, 2);
  });

  const repository = new PostgresLeadRepository(pool, options);
  await repository.ready();
  // The staging demo uses the real tenant inbox, without queuing an automated
  // notification, external email or booking.
  const demoResult = await repository.createDemoEnquiry({
    kind: "package", destination: "Zanzibar", travelStyle: "A slower pace",
    travellers: "2", name: "Synthetic demo visitor",
    email: "staging-demo@example.invalid", phone: "+233240000000",
    notes: "Demo test, no payment", consent: true,
  });
  assert.equal(demoResult.demo, true);
  const demoRow = (await pool.query(
    "SELECT organisation_id, kind, contact, details, status FROM twe.enquiries WHERE id=$1",
    [demoResult.inquiryId],
  )).rows[0];
  assert.equal(demoRow.organisation_id, organisationId);
  assert.equal(demoRow.kind, "package");
  assert.equal(demoRow.status, "new");
  assert.equal(demoRow.details.source, "staging_demo");
  assert.equal(demoRow.details.demo, true);
  assert.equal(demoRow.contact.name, "Synthetic demo visitor");
  assert.equal((await pool.query(
    "SELECT count(*)::int AS count FROM twe.notification_outbox WHERE enquiry_id=$1",
    [demoResult.inquiryId],
  )).rows[0].count, 0);
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
  const accessSettings={issuer:"https://synthetic.cloudflareaccess.com",audience:"a".repeat(64)};
  const platformId=randomUUID();
  await pool.query("INSERT INTO twe.staff_users(id,organisation_id,issuer,subject,access_audience,role) VALUES($1,$2,$3,'platform',$4,'platform_admin')",[platformId,organisationId,accessSettings.issuer,accessSettings.audience]);
  const platform={id:platformId,role:"platform_admin",organisationId};
  const owner={id:userId,role:"owner",organisationId};
  const admin=new Administration(pool,organisationId,accessSettings,"test");
  const staged=await admin.provision(platform,{subject:"staged-editor"},"test-staff-stage");
  assert.equal(staged.active,false);
  await assert.rejects(admin.changeStaff(platform,staged.id,true,"test-escalation"),{status:403});
  await assert.rejects(admin.changeStaff(owner,platformId,false,"test-platform-change"),{status:403});
  await assert.rejects(admin.provision({...platform,organisationId:otherOrg},{subject:"other"},"test-cross-tenant"),{status:403});
  assert.equal((await admin.changeStaff(owner,staged.id,true,"test-owner-activate")).active,true);
  await assert.rejects(admin.grantSupport(platform,{userId:platformId,minutes:5,reasonReference:"SUP-1"},"test-self-grant"),{status:403});
  const grant=await admin.grantSupport(owner,{userId:platformId,minutes:5,reasonReference:"SUP-1"},"test-support");
  assert.equal((await admin.supportGrant(platformId)).id,grant.id);
  await admin.auditSupportUse(platform,await admin.supportGrant(platformId),"test-support-read");
  await assert.rejects(admin.auditSupportUse({...platform,organisationId:otherOrg},await admin.supportGrant(platformId),"test-cross-support"),{status:403});
  await admin.revokeSupport(owner,grant.id,"test-revoke-support");
  assert.equal(await admin.supportGrant(platformId),undefined);
  assert.ok((await admin.securityEvents(platform,"test-security-read")).some(event=>event.action==="support.enquiries_read"));
  await assert.rejects(admin.securityEvents(owner,"test-owner-system"),{status:403});
  const accessIdentity={issuer:accessSettings.issuer,subject:"platform",audience:accessSettings.audience,expiresAt:new Date(Date.now()+60000),assertionHash:"c".repeat(64)};
  await auth.createSession(accessIdentity,"d".repeat(64),"e".repeat(64),"test-access-session");
  assert.equal((await auth.getSession("d".repeat(64))).role,"platform_admin");
  await assert.rejects(auth.createSession(accessIdentity,"f".repeat(64),"e".repeat(64),"test-replay"));
  assert.equal(await auth.createSession({...accessIdentity,audience:"b".repeat(64)},"f".repeat(64),"e".repeat(64),"test-wrong-app"),null);
  await admin.revokeSessions(platform,platformId,"test-maintenance");
  assert.equal(await auth.getSession("d".repeat(64)),undefined);
  for (const remember of [false, true]) {
    const flowHash = randomUUID().replaceAll("-", "").repeat(2);
    const flow = { state: "synthetic-state", nonce: "synthetic-nonce", verifier: "synthetic-verifier", remember_me: remember };
    await auth.saveFlow(flowHash, flow);
    assert.deepEqual(await auth.consumeFlow(flowHash), flow);
    assert.equal(await auth.consumeFlow(flowHash), undefined, "OIDC preference is consumed only once");
  }
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
  await context.test("email template drafts, activation and audit survive recreation under runtime grants", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE twe_test_runtime");
      const query = (...args) => client.query(...args);
      const runtimePool = { query, connect: async () => ({ query, release() {} }) };
      const templates = new EmailTemplates(runtimePool, organisationId);
      const owner = { ...actor, role: "owner" };
      assert.equal((await templates.get(owner)).version, 0);
      const copy = { ...defaultEnquiryCopy, heading: "Reviewed acknowledgement" };
      await templates.change(owner, "template-draft", 0, copy);
      assert.deepEqual(await templates.activeCopy(), defaultEnquiryCopy);
      const invitationCopy = { ...defaultInvitationCopy, heading: "Reviewed staff invitation" };
      await templates.change(owner, "invitation-template-draft", 0, invitationCopy, false, "staff-invitation");
      assert.deepEqual(await templates.activeCopy("staff-invitation"), defaultInvitationCopy);
      await templates.change(owner, "invitation-template-approved", 1, null, true, "staff-invitation");
      assert.deepEqual(await new EmailTemplates(runtimePool, organisationId).activeCopy("staff-invitation"), invitationCopy);
      assert.deepEqual(await new EmailTemplates(runtimePool, otherOrg).activeCopy("staff-invitation"), defaultInvitationCopy);
      assert.deepEqual(await templates.activeCopy(), defaultEnquiryCopy, "Invitation approval must not change enquiry copy");
      await assert.rejects(templates.change({ ...owner, role: "editor" }, "invitation-denied", 2, invitationCopy, false, "staff-invitation"), { status: 403 });
      const invitationAudits = await query("SELECT action FROM twe.audit_records WHERE organisation_id=$1 AND action IN ('email_template.staff_invitation.saved','email_template.staff_invitation.approved')", [organisationId]);
      assert.equal(invitationAudits.rows.length, 2);
      await assert.rejects(templates.change(owner, "template-stale", 0, copy), { status: 409 });
      await templates.change(owner, "template-active", 1, null, true);
      assert.deepEqual(await new EmailTemplates(runtimePool, organisationId).activeCopy(), copy);
      assert.deepEqual(await new EmailTemplates(runtimePool, otherOrg).activeCopy(), defaultEnquiryCopy);
      await assert.rejects(new EmailTemplates(runtimePool, otherOrg).get(owner), { status: 403 });
      const audits = await query("SELECT action FROM twe.audit_records WHERE organisation_id=$1 AND action IN ('email_template.saved','email_template.activated')", [organisationId]);
      assert.equal(audits.rows.length, 2);
      await templates.change(owner, "template-rollback-draft", 2, defaultEnquiryCopy);
      await templates.change(owner, "template-rollback-active", 3, null, true);
      assert.deepEqual(await templates.activeCopy(), defaultEnquiryCopy);
    } finally { await client.query("RESET ROLE"); client.release(); }
  });
  await context.test("Drive sync uses runtime grants, keeps immutable revisions and isolates tenants", async () => {
    const client = await pool.connect();
    let version = "1", downloads = 0;
    const drive = {
      config: { folderId: "synthetic_folder_123" },
      async metadata() { return { id: "synthetic_image_123", version, md5Checksum: "a".repeat(32), mimeType: "image/png" }; },
      async download() { downloads++; return image; },
      async list() { return { items: [{ id: "synthetic_image_123", version, name: "Synthetic fixture" }], nextPageToken: "" }; },
    };
    try {
      await client.query("SET ROLE twe_test_runtime");
      const query = (...args) => client.query(...args);
      const runtimePool = { query, connect: async () => ({ query, release() {} }) };
      const sync = new MediaService(runtimePool, organisationId, storage, null, drive);
      const input = { fileId: "synthetic_image_123", version, alt: "Drive fixture", rights: "Generated test fixture" };
      const first = await sync.importDrive(input, actor, "drive-first");
      assert.equal(first.unchanged, false);
      const repeat = await sync.importDrive(input, actor, "drive-repeat");
      assert.equal(repeat.id, first.id);
      assert.equal(repeat.unchanged, true);
      assert.equal(downloads, 1);
      assert.equal((await sync.listDrive()).items[0].importedId, first.id);
      const current = await content.get("home");
      await content.save("home", { ...body, imageId: first.id }, current.version, actor, "drive-selected");
      version = "2";
      const second = await sync.importDrive({ ...input, version }, actor, "drive-refresh");
      assert.notEqual(second.id, first.id);
      assert.equal((await content.get("home")).body.imageId, first.id, "Sync never rewrites a selected revision");
      assert.equal((await new MediaService(runtimePool, otherOrg, storage, null, drive).listDrive()).items[0].importedId, null);
      await assert.rejects(sync.importDrive(input, { ...actor, organisationId: otherOrg }, "drive-foreign"), { status: 403 });
      const audit = await query("SELECT action FROM twe.audit_records WHERE organisation_id=$1 AND record_id=$2", [organisationId, first.id]);
      assert.equal(audit.rows.some(row => row.action === "media.drive_imported"), true);
      await sync.archive(second.id, actor, "drive-archive");
      await assert.rejects(sync.importDrive({ ...input, version }, actor, "drive-archived"), { status: 409 });
      version = "3";
      const beforeRace = objects.size;
      const replicas = [new MediaService(pool, organisationId, storage, null, drive),
        new MediaService(pool, organisationId, storage, null, drive)];
      const race = await Promise.all(replicas.map(replica =>
        replica.importDrive({ ...input, version }, actor, "drive-race")));
      assert.equal(race[0].id, race[1].id, "Replicas converge on one immutable source revision");
      assert.equal(objects.size, beforeRace + 3, "Losing replica leaves no orphan R2 derivatives");
      // Return to the fixture used by the publication assertions below.
      const selected = await content.get("home");
      await content.save("home", { ...body, imageId: asset.id }, selected.version, actor, "drive-restore-selection");
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  });
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
  let built = 0;
  const buildPayload = contact => { assert.equal(typeof contact.email, "string"); built++; return payload; };
  const claims = await Promise.all([outbox.claim(buildPayload), outbox.claim(buildPayload)]);
  assert.equal(claims.filter(Boolean).length, 1, "Concurrent workers cannot own the same job");
  assert.equal(built, 1, "Only the claimed tenant enquiry creates a payload");
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
  // Exercise publishing with runtime grants, not the privileged migration owner.
  const publicationClient = await pool.connect();
  await publicationClient.query("SET ROLE twe_test_runtime");
  const publicationQuery = (...args) => publicationClient.query(...args);
  const publicationPool = { query: publicationQuery, connect: async () => ({query: publicationQuery, release() {}}) };
  try {
  assert.equal((await publicationQuery("SELECT has_table_privilege(current_user, 'twe.organisations', 'UPDATE') AS allowed")).rows[0].allowed, false);
  const publication = new PublicationRepository(publicationPool, { ...options, sourceSha: "a".repeat(40) });
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
  assert.equal(snapshot.pages.home.image.sources.length, 1, "Small fixtures do not emit duplicate srcset widths");
  assert.equal(snapshot.pages.home.socialImage.src, `/media/${asset.id}-social.jpg`);
  const social = await sharp(path.join(artifact.publicDirectory, `media/${asset.id}-social.jpg`)).metadata();
  assert.equal(social.width, 1200); assert.equal(social.height, 630);
  assert.equal(social.exif, undefined);
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

  // Journal and map reuse real revision/permission/publication boundaries.
  for (const [slug, extension] of [["journal", { articles: [{ slug: "synthetic-guide", title: "Synthetic guide", excerpt: "Test only", body: "Literal <script> text", date: "2026-10-30" }] }], ["travel-footprint", { footprint: [{ countryCode: "TZ", total: 4, status: "verified" }] }]]) {
    const draft = await content.save(slug, { ...body, imageId: null, ...extension }, 0, actor, `save-${slug}`);
    assert.equal(await content.get(slug, true), null);
    assert.equal(await new ContentRepository(pool, otherOrg).get(slug), null);
    await assert.rejects(content.save(slug, draft.body, draft.version, { ...actor, organisationId: otherOrg }, "cross-tenant-save"), { status: 403 });
    const queued = await publication.enqueue(slug, draft.version, false, actor, `publish-${slug}`);
    const job = await publication.claim();
    await publication.confirm(queued.id, job.build_token, "synthetic-content", manifestDigest(job.manifest));
    const published = await content.get(slug, true);
    assert.deepEqual(published.body[slug === "journal" ? "articles" : "footprint"], extension[slug === "journal" ? "articles" : "footprint"]);
    await publication.enqueue(slug, draft.version, true, actor, `withdraw-${slug}`);
    const withdrawn = await publication.claim();
    await publication.confirm(withdrawn.id, withdrawn.build_token, "synthetic-withdrawal", manifestDigest(withdrawn.manifest));
    assert.equal(await content.get(slug, true), null);
  }
  const runtimeContent = new ContentRepository(publicationPool, organisationId);
  const privacy = await runtimeContent.save("privacy", {...body, imageId: null, heading: "Synthetic privacy"}, 0, actor, "save-runtime-privacy");
  const queuedPrivacy = await publication.enqueue("privacy", privacy.version, false, actor, "publish-runtime-privacy");
  const privacyJob = await publication.claim();
  await publication.confirm(queuedPrivacy.id, privacyJob.build_token, "synthetic-privacy", manifestDigest(privacyJob.manifest));
  assert.equal((await runtimeContent.get("privacy", true)).body.heading, "Synthetic privacy");
  assert.equal((await publicationQuery("SELECT count(*)::int AS n FROM twe.audit_records WHERE record_id=$1 AND action='content.publish_requested'", [queuedPrivacy.id])).rows[0].n, 1);
  await assert.rejects(publication.enqueue("privacy", privacy.version, false, {...actor, organisationId: otherOrg}, "cross-tenant-runtime"), {status:403});
  } finally { await publicationClient.query("RESET ROLE"); publicationClient.release(); }
});
