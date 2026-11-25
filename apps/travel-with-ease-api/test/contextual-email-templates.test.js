import test from "node:test";
import assert from "node:assert/strict";
import { EmailTemplates, templateSlugSchema, templateCopySchema } from "../src/notifications/templates.js";
import { defaultTemplateCopies, templateCandidates, emailTemplateOptions, packageTemplateSlug } from "../src/notifications/template-catalogue.js";
import { ResendSender } from "../src/notifications/resend.js";

const organisationId = "tenant-a";
const actor = { id: "staff", role: "owner", organisationId };
const published = { id: "30000000-0000-4000-8000-000000000001", title: "Island Escape" };
const draft = { id: "30000000-0000-4000-8000-000000000002", title: "Draft destination" };
const specific = "enquiry-package-" + published.id;
const draftSlug = "enquiry-package-" + draft.id;
const copy = (heading, slug = "enquiry-acknowledgement") => ({ ...defaultTemplateCopies[slug], heading });
const enquiry = details => ({ id: "11111111-1111-4111-8111-111111111111", kind: "personalised", contact: { name: "Sample traveller", email: "traveller@example.invalid" }, details });
function fixture(active = {}) {
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    assert.equal(values[0], organisationId);
    if (sql.includes("FROM twe.content_items")) return { rows: [{ publication_initialized: true, published_body: { packages: [published] }, draft_body: { packages: [published, draft] } }] };
    if (sql.includes("slug=ANY")) return { rows: values[1].filter(slug => Object.hasOwn(active, slug)).map(slug => ({ slug, active: active[slug] })) };
    return { rows: Object.hasOwn(active, values[1]) ? [{ version: 2, active: active[values[1]], active_version: 1, draft: active[values[1]] }] : [] };
  } };
  return { service: new EmailTemplates(pool, organisationId), calls, pool };
}

test("catalogue includes actual services, live and draft package IDs; staff permission stays separate", async () => {
  const { service } = fixture();
  const catalogue = await service.catalogue(actor);
  assert.equal(catalogue.length, emailTemplateOptions.length + 2);
  for (const slug of ["enquiry-service-readiness", "enquiry-service-full-planning", "enquiry-service-premium", "enquiry-service-group", "enquiry-gift", "enquiry-group", "enquiry-celebration", specific, draftSlug]) {
    assert.ok(catalogue.some(option => option.slug === slug), slug);
  }
  assert.equal((await service.catalogue({ ...actor, role: "editor" })).some(option => option.slug === "staff-invitation"), false);
  await assert.rejects(service.catalogue({ ...actor, organisationId: "other-tenant" }), { status: 403 });
  await assert.rejects(service.get(actor, "enquiry-package-30000000-0000-4000-8000-000000000099"), { status: 404 });
  assert.equal(templateSlugSchema.safeParse("enquiry-package-../../etc").success, false);
});

test("context prioritises individual packages and explicit service entries, then enquiry type and selected support", () => {
  const expected = [
    [{}, "enquiry-acknowledgement"],
    [{ enquiryType: "gift", selectedServiceId: "premium" }, "enquiry-gift"],
    [{ enquiryType: "group" }, "enquiry-group"],
    [{ enquiryType: "celebration" }, "enquiry-celebration"],
    [{ entryType: "service", selectedServiceId: "group", enquiryType: "celebration" }, "enquiry-service-group"],
    [{ selectedServiceId: "readiness" }, "enquiry-service-readiness"],
    [{ selectedServiceId: "full_planning" }, "enquiry-service-full-planning"],
    [{ selectedServiceId: "premium" }, "enquiry-service-premium"],
    [{ entryType: "package", selectedPackageId: published.id, selectedServiceId: "premium" }, specific],
    [{ entryType: "package" }, packageTemplateSlug],
    [{ enquiryType: "__proto__" }, "enquiry-acknowledgement"],
  ];
  for (const [details, slug] of expected) assert.equal(templateCandidates(enquiry(details))[0], slug);
  assert.deepEqual(templateCandidates({ kind: "legacy_estimator", details: { selectedPackageId: published.id } }), ["enquiry-acknowledgement"]);
});

test("individual package inherits active shared copy until activated, never leaking draft package titles", async () => {
  const shared = copy("Reviewed package acknowledgement", packageTemplateSlug);
  const override = copy("Reviewed Island Escape", packageTemplateSlug);
  const general = copy("Reviewed general");
  const { service } = fixture({ [packageTemplateSlug]: shared, "enquiry-acknowledgement": general, [draftSlug]: override });
  const packageEnquiry = enquiry({ entryType: "package", selectedPackageId: published.id, selectedPackageTitle: "Visitor supplied text" });
  const resolved = await service.resolveDelivery(packageEnquiry);
  assert.deepEqual(resolved.copy, shared);
  assert.equal(resolved.context.packageTitle, published.title);
  assert.deepEqual((await service.get(actor, specific)).draft, shared);
  const notPublished = await service.resolveDelivery(enquiry({ entryType: "package", selectedPackageId: draft.id, selectedPackageTitle: draft.title }));
  assert.deepEqual(notPublished.copy, shared);
  assert.equal(notPublished.context.packageTitle, undefined);
  assert.deepEqual(await service.activeForEnquiry(enquiry({})), general);
  assert.deepEqual(await service.activeForEnquiry(enquiry({ selectedServiceId: "premium" })), defaultTemplateCopies["enquiry-service-premium"]);
  const active = fixture({ [packageTemplateSlug]: shared, [specific]: override });
  assert.deepEqual((await active.service.resolveDelivery(packageEnquiry)).copy, override);
  const exported = await active.service.exportActiveCopies([published.id, draft.id]);
  assert.deepEqual(exported[specific], override);
  assert.equal(Object.hasOwn(exported, draftSlug), false);
  assert.equal(Object.keys(exported).length, emailTemplateOptions.length + 1);
});

test("personalised email retains the secure questionnaire link and fixed staging recipient", async () => {
  const customised = templateCopySchema.parse({
    ...defaultTemplateCopies[packageTemplateSlug],
    subject: "Your {{package}} enquiry",
    heading: "Hello {{customer}}",
    message: "Thank you for enquiring about {{package}}.",
    continuationCtaLabel: "Tell us more about {{package}}",
  });
  const { service, pool } = fixture({ [specific]: customised });
  const continuationUrl = "https://staging.travelwitheasegh.com/enquiry/#continue=synthetic";
  const sender = new ResendSender({ environment: "staging", from: "test@example.invalid" }, null,
    (value, client) => service.resolveDelivery(value, client), { issue: () => ({ url: continuationUrl }) });
  const payload = await sender.preparePayload(enquiry({ entryType: "package", selectedPackageId: published.id, selectedPackageTitle: "<script>untrusted</script>" }), pool);
  assert.deepEqual(payload.to, ["testing@travelwitheasegh.com"]);
  assert.equal(payload.subject, "Your Island Escape enquiry");
  assert.match(payload.html, /Hello Sample traveller/);
  assert.match(payload.html, /Tell us more about Island Escape/);
  assert.ok(payload.text.includes(continuationUrl));
  assert.doesNotMatch(payload.html, /<script>|untrusted/);
  assert.doesNotMatch(payload.staff.text, /continue=|Island Escape/);
  const preview = await service.preview(actor, specific, customised);
  assert.match(preview.text, /Tell us more about Island Escape/);
  assert.doesNotMatch(preview.text, /continue=synthetic/);
  const broken = new ResendSender({ environment: "staging", from: "test@example.invalid" }, null, async () => { throw new Error("private"); });
  await assert.rejects(broken.preparePayload(enquiry({}), pool), { code: "template_lookup_failed" });
});
