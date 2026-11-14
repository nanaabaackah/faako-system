import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { nativeInquirySchema } from "../src/validation.js";
import { FileLeadRepository } from "../src/crm/repository.js";
import { smartEnquirySchema } from "../src/enquiries/questionnaire-validation.js";
import {
  QUESTIONNAIRE_ID, QUESTIONNAIRE_VERSION, applicableQuestionIds, questions,
} from "../src/enquiries/questionnaires/index.js";

const payload = () => ({
  submissionId: randomUUID(), enquiryType: "trip", service: "not_sure",
  destination: "Help me choose", travelTimeframe: "Exploring next year",
  travellers: 2, budget: "", name: "Synthetic Traveller",
  email: "synthetic@example.invalid", phone: "+233200000000",
  notes: "", consent: true, website: "",
});

function continuationPayload(contact, submissionId = randomUUID()) {
  const answers = {
    "1428564940": "I want full trip planning (itinerary, accommodation, activities, bookings)",
  };
  for (const id of applicableQuestionIds({}, answers)) {
    const question = questions[id];
    if (answers[id] !== undefined || (!question.required && !["476632894", "1078451195", "214964047"].includes(id))) continue;
    if (id === "476632894") answers[id] = contact.name;
    else if (id === "1078451195") answers[id] = contact.phone;
    else if (id === "214964047") answers[id] = contact.email;
    else if (id === "836507955") answers[id] = "2";
    else if (id === "502234433") answers[id] = "No";
    else if (question.type === "CHECKBOX") answers[id] = question.options.slice(0, 1);
    else if (question.type === "MULTIPLE_CHOICE") answers[id] = question.options[0];
    else answers[id] = "Synthetic answer";
  }
  return smartEnquirySchema.parse({
    submissionId, turnstileToken: "", questionnaireId: QUESTIONNAIRE_ID,
    questionnaireVersion: QUESTIONNAIRE_VERSION, entryType: "general",
    sourcePath: "/plan-your-trip", context: {}, answers, contact,
    consent: true, website: "",
  });
}

test("first-contact enquiries require explicit classification, consent and bounded minimal data", () => {
  const input = payload();
  assert.equal(nativeInquirySchema.parse(input).enquiryType, "trip");
  for (const enquiryType of ["trip", "gift", "group", "celebration"]) {
    assert.equal(nativeInquirySchema.safeParse({ ...input, enquiryType }).success, true);
  }
  for (const change of [
    { consent: false }, { enquiryType: undefined }, { enquiryType: "invented" },
    { travellers: 0 }, { travellers: 1.5 }, { travellers: 101 },
    { email: "invalid" }, { submissionId: "../private" },
    { notes: "x".repeat(1501) }, { organisationId: randomUUID() },
    { passportNumber: "not-collected" }, { estimateLowMinor: "1" },
  ]) assert.equal(nativeInquirySchema.safeParse({ ...input, ...change }).success, false);
});

test("local enquiries persist, deduplicate concurrent retries and reject changed payload replays", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "twe-enquiry-test-"));
  const file = path.join(directory, "synthetic.json");
  const repository = new FileLeadRepository(file);
  const input = nativeInquirySchema.parse(payload());
  const results = await Promise.all([
    repository.createNativeEnquiry(input), repository.createNativeEnquiry(input),
  ]);
  assert.equal(results[0].inquiryId, results[1].inquiryId);
  assert.equal(results[1].replayed, true);
  await assert.rejects(repository.createNativeEnquiry({ ...input, destination: "Changed" }),
    error => error.code === "enquiry_submission_conflict");
  const reopened = new FileLeadRepository(file);
  assert.equal((await reopened.listLeads()).length, 1);
  assert.equal((await reopened.createNativeEnquiry(input)).replayed, true);
  assert.equal((await reopened.listLeads())[0].inquiry.enquiryType, "trip");
  await repository.createNativeEnquiry({ ...input, submissionId: randomUUID() });
  assert.equal((await repository.listLeads()).length, 2);
});

test("private completion enriches one enquiry once and identical retries are idempotent", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "twe-progressive-test-"));
  const repository = new FileLeadRepository(path.join(directory, "synthetic.json"));
  const intake = nativeInquirySchema.parse(payload());
  const created = await repository.createNativeEnquiry(intake);
  const before = (await repository.listLeads())[0];
  const context = await repository.continuationContext(created.inquiryId);
  assert.deepEqual(context.contact, { name: intake.name, email: intake.email, phone: intake.phone });
  const completion = continuationPayload({
    name: "Updated Traveller", email: "updated@example.invalid", phone: "+233211111111",
  });
  const [first, concurrentRetry] = await Promise.all([
    repository.completeEnquiryContinuation(created.inquiryId, completion),
    repository.completeEnquiryContinuation(created.inquiryId, completion),
  ]);
  assert.equal(first.inquiryId, created.inquiryId);
  assert.equal(concurrentRetry.replayed, true);
  const leads = await repository.listLeads();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].createdAt, before.createdAt);
  assert.equal(leads[0].inquiry.submissionId, intake.submissionId);
  assert.equal(leads[0].inquiry.continuationSubmissionId, completion.submissionId);
  assert.equal(leads[0].inquiry.questionnaireVersion, QUESTIONNAIRE_VERSION);
  assert.equal(leads[0].contact.email, "updated@example.invalid");
  assert.equal(await repository.continuationContext(created.inquiryId), null);
  await assert.rejects(
    repository.completeEnquiryContinuation(created.inquiryId, {
      ...completion, submissionId: randomUUID(),
    }),
    (error) => error.code === "enquiry_continuation_conflict",
  );
});

test("public intake checks exact Origin, validation, honeypot and confirmed persistence", async context => {
  const origin = "http://localhost:4328";
  let writes = 0;
  const repository = { createNativeEnquiry: async () => {
    writes++;
    return { inquiryId: randomUUID(), status: "received", replayed: false };
  } };
  const app = createApp({ repository, allowedOrigins: [origin], logger: { error() {} } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  context.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/public/enquiries`;
  const post = (body, requestOrigin = origin) => fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });
  const saved = await post(payload());
  assert.equal(saved.status, 201);
  const receipt = await saved.json();
  assert.equal(receipt.data.status, "received");
  assert.ok(receipt.meta.requestId);
  assert.equal(writes, 1);
  assert.equal((await post({ ...payload(), consent: false })).status, 400);
  assert.equal((await post(payload(), "https://attacker.invalid")).status, 403);
  assert.equal((await post({ ...payload(), website: "bot.invalid" })).status, 202);
  assert.equal(writes, 1);
  repository.createNativeEnquiry = async () => { throw new Error("private backend diagnostic"); };
  const failed = await post(payload());
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private backend diagnostic/);
});
