import test from "node:test";
import assert from "node:assert/strict";
import approved from "../../travel-with-ease-web/content/approved-public-release.json" with { type: "json" };
import { ContentPromotionImporter, createPromotionBundle, exportPromotionBundle, verifyPromotionBundle } from "../src/content/promotion.js";
import { INTAKE_FORM_ID, defaultIntakeDefinition } from "../src/enquiries/intake-definition.js";
import { DETAILED_FORM_ID, defaultDetailedDefinition } from "../src/enquiries/questionnaires/configuration.js";
import { pageNames } from "../src/content/schema.js";
import { approvedEditorCopy } from "../src/content/approved-copy.js";
import { defaultTemplateCopies } from "../src/notifications/template-catalogue.js";

const organisationId = "11111111-1111-4111-8111-111111111111";
const publicationId = "22222222-2222-4222-8222-222222222222";
const pages = Object.fromEntries(pageNames.map((slug) => [slug,
  approved.pages[slug] ? approvedEditorCopy(approved.pages[slug]) : (slug === "site-appearance" ? {
    heading: "Shared website imagery", body: "", ctaLabel: "", ctaPath: "/#plan",
    seoTitle: "Website appearance", seoDescription: "Internal shared imagery settings.",
  } : null)]));
const source = { environment: "staging", organisationId, publicationId,
  sourceSha: "a".repeat(40), deploymentId: "staging-deployment" };

test("promotion bundle contains all CMS sections and detects content tampering", () => {
  const bundle = createPromotionBundle({ source, pages, media: [] });
  assert.equal(Object.keys(bundle.pages).length, pageNames.length);
  assert.equal(bundle.source.environment, "staging");
  assert.equal(verifyPromotionBundle(bundle).fingerprint, bundle.fingerprint);
  const changed = structuredClone(bundle);
  changed.pages.home.heading = "Changed after approval";
  assert.throws(() => verifyPromotionBundle(changed), /integrity/);
});

test("promotion export uses only the latest verified live manifest and excludes drafts", async () => {
  const live = { id: publicationId, source_sha: "a".repeat(40), deployment_id: "staging-deployment",
    manifest: { pages: [{ slug: "contact", body: { ...pages.contact, heading: "Published contact" } }] } };
  const bundle = await exportPromotionBundle({
    publication: { lastLive: async () => live },
    media: { get: async () => { throw new Error("no media expected"); }, store: {} },
    source: { organisationId }, approvedPages: approved.pages,
  });
  assert.equal(bundle.pages.contact.heading, "Published contact");
  assert.notEqual(bundle.pages.contact.heading, "Unpublished draft");
  assert.match(bundle.source.approvedBaselineFingerprint, /^[a-f0-9]{64}$/);
});

test("promotion rejects incomplete sections, wrong environments and missing referenced media", () => {
  const incomplete = { ...pages }; delete incomplete.home;
  assert.throws(() => createPromotionBundle({ source, pages: incomplete }), /every CMS/);
  assert.throws(() => createPromotionBundle({ source: { ...source, environment: "production" }, pages }), /source identity/);
  const referenced = structuredClone(pages);
  referenced.home.imageId = "33333333-3333-4333-8333-333333333333";
  assert.throws(() => createPromotionBundle({ source, pages: referenced, media: [] }), /missing referenced media/);
});

test("initial production import seeds published and draft revisions without operational records", async () => {
  const bundle = createPromotionBundle({ source, pages, media: [] });
  const statements = [];
  const client = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "owner", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, { put: async () => {}, remove: async () => {} }, {
    organisationId, actorId: "44444444-4444-4444-8444-444444444444",
    transact: async (_pool, operation) => operation(client),
  });
  const result = await importer.apply(bundle, "promotion-test");
  assert.equal(result.status, "imported");
  assert.equal(statements.filter(({ sql }) => sql.startsWith("INSERT INTO twe.content_items")).length, pageNames.length);
  assert.equal(statements.filter(({ sql }) => sql.startsWith("INSERT INTO twe.content_revisions")).length,
    pageNames.filter((slug) => bundle.pages[slug] !== null).length);
  assert.equal(statements.some(({ sql }) => sql.includes("pg_advisory_xact_lock")), true);
  assert.equal(statements.some(({ sql }) => /enquiries|staff_sessions|notification_outbox/.test(sql)), false);
  assert.equal(statements.some(({ values }) => values?.includes("content.production_seed_imported")), true);
});

test("production import rejects cross-tenant bundles before storage", async () => {
  const bundle = createPromotionBundle({ source, pages, media: [] });
  let writes = 0;
  const importer = new ContentPromotionImporter({}, { put: async () => { writes += 1; }, remove: async () => {} }, {
    organisationId: "55555555-5555-4555-8555-555555555555",
    actorId: "44444444-4444-4444-8444-444444444444",
    transact: async () => { throw new Error("transaction must not start"); },
  });
  await assert.rejects(importer.apply(bundle), /source organisation/);
  assert.equal(writes, 0);
});


test("promotion uses the verified manifest baseline rather than a later checkout", async () => {
  const baseline = structuredClone(approved.pages);
  baseline.home.heading = "Verified staging baseline";
  const bundle = await exportPromotionBundle({
    publication: { lastLive: async () => ({
      id: publicationId, source_sha: source.sourceSha, deployment_id: source.deploymentId,
      manifest: { baseline, pages: [] },
    }) },
    media: { get: async () => { throw new Error("no media expected"); }, store: {} },
    source: { organisationId }, approvedPages: approved.pages,
  });
  assert.equal(bundle.pages.home.heading, "Verified staging baseline");
});

test("promotion recognizes the actual platform_admin Superadmin role", async () => {
  const bundle = createPromotionBundle({ source, pages, media: [] });
  const client = { query: async (sql) => {
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "platform_admin", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, { put: async () => {}, remove: async () => {} }, {
    organisationId, actorId: "44444444-4444-4444-8444-444444444444",
    transact: async (_pool, operation) => operation(client),
  });
  assert.equal((await importer.apply(bundle)).status, "imported");
});

test("promotion exports only active email copy and verifies its integrity", async () => {
  const active = { subject: "Subject", heading: "Heading", message: "Active copy", ctaLabel: "Continue" };
  const bundle = await exportPromotionBundle({
    publication: { lastLive: async () => ({ id: publicationId, source_sha: source.sourceSha, deployment_id: source.deploymentId, manifest: { pages: [] } }) },
    media: { get: async () => { throw new Error("no media expected"); }, store: {} },
    templates: { activeCopy: async () => active },
    source: { organisationId }, approvedPages: approved.pages,
  });
  assert.deepEqual(bundle.emailTemplates["enquiry-acknowledgement"], active);
  assert.deepEqual(bundle.emailTemplates["staff-invitation"], active);
  assert.equal(verifyPromotionBundle(bundle).fingerprint, bundle.fingerprint);
  const tampered = structuredClone(bundle);
  tampered.emailTemplates["staff-invitation"].message = "Changed";
  assert.throws(() => verifyPromotionBundle(tampered), /integrity/);
  assert.throws(() => createPromotionBundle({ source, pages, emailTemplates: { "staff-invitation": active } }), /every shared template/);
  const statements = [];
  const client = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "owner", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, { put: async () => {}, remove: async () => {} }, {
    organisationId, actorId: "44444444-4444-4444-8444-444444444444",
    transact: async (_pool, operation) => operation(client),
  });
  await importer.apply(bundle);
  assert.equal(statements.filter(({sql}) => sql.startsWith("INSERT INTO twe.email_templates")).length, 2);
  assert.equal(statements.some(({sql}) => /notification_outbox|staff_sessions|enquiries/.test(sql)), false);
});

test("identical recorded production promotion is a no-write replay; edited content is not overwritten", async () => {
  const active = { subject: "Subject", heading: "Heading", message: "Active copy", ctaLabel: "Continue" };
  const bundle = createPromotionBundle({ source, pages, emailTemplates: { "enquiry-acknowledgement": active, "staff-invitation": active } });
  let edited = false;
  let receipt = true;
  const statements = [];
  const client = { query: async (sql) => {
    statements.push(sql);
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "owner", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: pageNames.length }] };
    if (sql.includes("FROM twe.audit_records")) return { rows: receipt ? [{}] : [] };
    if (sql.includes("FROM twe.content_items c")) return { rows: pageNames.map(slug => ({
      slug, publication_initialized: true, published_body: bundle.pages[slug],
      draft_body: edited && slug === "home" ? { ...bundle.pages[slug], heading: "Production edit" } : bundle.pages[slug],
    })) };
    if (sql.includes("FROM twe.email_templates")) return { rows: Object.entries(bundle.emailTemplates).map(([slug, copy]) => ({ slug, draft: copy, active: copy })) };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, {
    put: async () => { throw new Error("no object write expected"); },
    remove: async () => { throw new Error("no object removal expected"); },
  }, { organisationId, actorId: "44444444-4444-4444-8444-444444444444",
    transact: async (_pool, operation) => operation(client) });
  assert.equal((await importer.apply(bundle)).status, "already_imported");
  edited = true;
  await assert.rejects(importer.apply(bundle), /will not overwrite/);
  edited = false;
  receipt = false;
  await assert.rejects(importer.apply(bundle), /will not overwrite/);
  assert.ok(statements.every(sql => sql.startsWith("SELECT")));
});

test("promotion carries only active form versions, rejects tampering and seeds independent active definitions", async () => {
  const intake = { formId: INTAKE_FORM_ID, version: 3, definition: defaultIntakeDefinition() };
  const detailed = { formId: DETAILED_FORM_ID, version: 2, definition: { ...defaultDetailedDefinition(), continueLabel: "Next" } };
  const enquiryForms = { [INTAKE_FORM_ID]: intake, [DETAILED_FORM_ID]: detailed };
  const bundle = createPromotionBundle({ source, pages, enquiryForms });
  assert.deepEqual(verifyPromotionBundle(bundle).enquiryForms, enquiryForms);
  const changed = structuredClone(bundle);
  changed.enquiryForms[DETAILED_FORM_ID].definition.continueLabel = "Changed";
  assert.throws(() => verifyPromotionBundle(changed), /integrity/);
  assert.throws(() => createPromotionBundle({ source, pages, enquiryForms: { [INTAKE_FORM_ID]: intake } }), /both active/);
  const statements = [];
  const client = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "owner", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, { put: async () => {}, remove: async () => {} }, {
    organisationId, actorId: "44444444-4444-4444-8444-444444444444", transact: async (_pool, operation) => operation(client),
  });
  assert.equal((await importer.apply(bundle)).status, "imported");
  assert.deepEqual(statements.filter(({sql})=>sql.startsWith("INSERT INTO twe.enquiry_form_drafts")).map(({values})=>[values[1],values[2]]), [[INTAKE_FORM_ID,3],[DETAILED_FORM_ID,2]]);
  assert.equal(statements.filter(({sql})=>sql.startsWith("INSERT INTO twe.enquiry_form_versions")).length,4);
  assert.equal(statements.some(({sql})=>/INSERT INTO twe\.(enquiries|staff_sessions|notification_outbox)\b/.test(sql)),false);
});

test("contextual promotion transfers only active shared copies and overrides for published packages", async () => {
  const slug = "enquiry-package-" + pages.packages.packages[0].id;
  const custom = { ...defaultTemplateCopies["enquiry-package"], heading: "Reviewed package" };
  const copies = { ...defaultTemplateCopies, [slug]: custom };
  const bundle = createPromotionBundle({ source, pages, emailTemplates: copies });
  assert.deepEqual(verifyPromotionBundle(bundle).emailTemplates, copies);
  const unknown = "enquiry-package-30000000-0000-4000-8000-000000000099";
  assert.throws(() => createPromotionBundle({ source, pages, emailTemplates: { ...copies, [unknown]: custom } }), /only published package overrides/);
  const incomplete = { ...copies }; delete incomplete["enquiry-service-premium"];
  assert.throws(() => createPromotionBundle({ source, pages, emailTemplates: incomplete }), /every shared template/);
  const statements = [];
  const client = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("SELECT role")) return { rows: [{ role: "owner", active: true }] };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 1 };
  } };
  const importer = new ContentPromotionImporter({}, { put: async () => {}, remove: async () => {} }, {
    organisationId, actorId: "44444444-4444-4444-8444-444444444444",
    transact: async (_pool, callback) => callback(client),
  });
  await importer.apply(bundle);
  const inserted = statements.filter(item => item.sql.includes("INSERT INTO twe.email_templates"));
  assert.equal(inserted.length, Object.keys(copies).length);
  assert.deepEqual(inserted.find(item => item.values[1] === slug).values[2], custom);
});
