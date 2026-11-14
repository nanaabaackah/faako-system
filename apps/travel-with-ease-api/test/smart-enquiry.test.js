import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import {
  QUESTIONNAIRE_ID, QUESTIONNAIRE_VERSION, applicableQuestionIds,
  questions, sourceQuestionnaires,
} from "../src/enquiries/questionnaires/index.js";
import { smartEnquirySchema, validatedQuestionnaireSnapshot } from "../src/enquiries/questionnaire-validation.js";
import { submissionRecord } from "../src/enquiries/submission.js";

const fullChoice = "I want full trip planning (itinerary, accommodation, activities, bookings)";
function answerFor(question) {
  if (question.id === "476632894") return "Synthetic Traveller";
  if (question.id === "1078451195") return "+233200000000";
  if (question.id === "214964047") return "synthetic@example.invalid";
  if (question.id === "836507955") return "2";
  if (question.id === "502234433") return "No";
  if (question.type === "CHECKBOX") return question.options.slice(0, 1);
  if (question.type === "MULTIPLE_CHOICE") return question.options[0];
  return "Synthetic answer";
}
function planningPayload() {
  const answers = { "1428564940": fullChoice };
  for (const id of applicableQuestionIds({}, answers)) {
    if (answers[id] === undefined && (questions[id].required || ["476632894", "1078451195", "214964047"].includes(id))) answers[id] = answerFor(questions[id]);
  }
  return {
    submissionId: randomUUID(), turnstileToken: "", questionnaireId: QUESTIONNAIRE_ID,
    questionnaireVersion: QUESTIONNAIRE_VERSION, entryType: "general", sourcePath: "/services",
    context: {}, answers,
    contact: { name: answers["476632894"], phone: answers["1078451195"], email: answers["214964047"] },
    consent: true, website: "",
  };
}

test("source inventory retains all 29 planning and 3 Start Here questions with original IDs", () => {
  const actual = (source) => source.items.filter((item) => !["PAGE_BREAK", "SECTION_HEADER"].includes(item.type));
  assert.equal(actual(sourceQuestionnaires.fullTripPlanning).length, 29);
  assert.equal(actual(sourceQuestionnaires.startHere).length, 3);
  assert.equal(questions["1444304495"].maxSelections, 3);
  assert.equal(questions["1366732008"].requireAllOptions, true);
  assert.equal(questions["1811901185"].collection, "deferred");
  assert.equal(questions["1811901185"].label, "Do you have any dietary requirements or allergies?");
});

test("server validates a complete planning route and stores immutable question snapshots", () => {
  const parsed = smartEnquirySchema.parse(planningPayload());
  const snapshot = validatedQuestionnaireSnapshot(parsed);
  assert.equal(snapshot.questionnaireVersion, QUESTIONNAIRE_VERSION);
  assert.ok(snapshot.applicableQuestionIds.includes("1444304495"));
  assert.equal(snapshot.applicableQuestionIds.includes("1811901185"), false);
  assert.equal(snapshot.questionSnapshots["541981576"].label, "Destination(s) you are considering");
  const record = submissionRecord(parsed, () => "2026-11-09T12:00:00.000Z");
  assert.equal(record.details.consentAcknowledgedAt, "2026-11-09T12:00:00.000Z");
  assert.equal(record.details.selectedServiceId, "full_planning");
});

test("server rejects hidden, deferred, excessive and invalid conditional answers", () => {
  const base = planningPayload();
  assert.equal(smartEnquirySchema.safeParse({ ...base, answers: { ...base.answers, "1811901185": "Sensitive health data" } }).success, false);
  assert.equal(smartEnquirySchema.safeParse({ ...base, answers: { ...base.answers, "1444304495": questions["1444304495"].options.slice(0, 4) } }).success, false);
  const visaYes = { ...base.answers, "502234433": "Yes" };
  assert.equal(smartEnquirySchema.safeParse({ ...base, answers: visaYes }).success, false);
  assert.equal(smartEnquirySchema.safeParse({ ...base, answers: { ...visaYes, "180737542": "Schengen — expires Aug 2027" } }).success, true);
  const readiness = { ...base, answers: { ...base.answers, "1428564940": "I need general travel advice to get ready (documents, budget, airport flow)" } };
  assert.equal(smartEnquirySchema.safeParse(readiness).success, false);
});

test("not-sure branch requires its decision and package context is paired", () => {
  const base = planningPayload();
  const answers = { "1428564940": "I’m not sure yet — please guide me" };
  for (const id of applicableQuestionIds({}, answers)) if (questions[id].required) answers[id] = answerFor(questions[id]);
  const uncertain = { ...base, answers, contact: { name: answers["476632894"], phone: answers["1078451195"], email: answers["214964047"] } };
  assert.equal(smartEnquirySchema.safeParse(uncertain).success, false);
  assert.equal(smartEnquirySchema.safeParse({ ...base, entryType: "package", context: { packageId: "zanzibar-escape" } }).success, false);
  assert.equal(smartEnquirySchema.safeParse({ ...base, entryType: "service", context: { serviceId: "premium", serviceTitle: "Wrong title" } }).success, false);
});

test("public intake rejects the versioned questionnaire without a private continuation", async (context) => {
  const origin = "http://localhost:4328";
  const writes = [];
  const app = createApp({
    repository: { createNativeEnquiry: async (data) => {
      writes.push(data);
      return { inquiryId: randomUUID(), status: "received", replayed: false };
    } },
    allowedOrigins: [origin],
    logger: { error() {} },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });

  assert.equal((await post(planningPayload())).status, 400);
  assert.equal(writes.length, 0);
  const injected = planningPayload();
  injected.answers["1811901185"] = "Sensitive health data";
  assert.equal((await post(injected)).status, 400);
  assert.equal(writes.length, 0);
});

test("continuation endpoints require exact origin and a verified one-time link", async (context) => {
  const origin = "http://localhost:4328";
  const token = "v1." + "x".repeat(100);
  const enquiryId = randomUUID();
  const completions = [];
  let available = true;
  const repository = {
    continuationContext: async (id) => available && id === enquiryId ? {
      inquiryId: id,
      contact: { name: "Synthetic Traveller", phone: "+233200000000", email: "synthetic@example.invalid" },
      entryType: "general", context: {},
    } : null,
    completeEnquiryContinuation: async (id, data) => {
      completions.push({ id, data });
      available = false;
      return { inquiryId: id, status: "completed", replayed: false };
    },
  };
  const app = createApp({
    repository, allowedOrigins: [origin], logger: { error() {} },
    continuationLinks: {
      verify: (candidate) => candidate === token
        ? { enquiryId, expiresAt: "2026-11-27T10:00:00.000Z" }
        : null,
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (path, body, requestOrigin = origin) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });

  assert.equal((await post("/api/public/enquiries/continuation/context", { continuationToken: "invalid" })).status, 410);
  assert.equal((await post("/api/public/enquiries/continuation/context", { continuationToken: token }, "https://attacker.invalid")).status, 403);
  const opened = await post("/api/public/enquiries/continuation/context", { continuationToken: token });
  assert.equal(opened.status, 200);
  assert.equal((await opened.json()).data.contact.email, "synthetic@example.invalid");
  const completion = planningPayload();
  const completed = await post("/api/public/enquiries/continuation/complete", {
    ...completion, continuationToken: token,
  });
  assert.equal(completed.status, 201);
  assert.equal(completions.length, 1);
  assert.equal(completions[0].id, enquiryId);
  assert.equal("continuationToken" in completions[0].data, false);
  assert.equal((await post("/api/public/enquiries/continuation/context", { continuationToken: token })).status, 410);
});
