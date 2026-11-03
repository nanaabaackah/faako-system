import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { nativeInquirySchema } from "../src/validation.js";
import { FileLeadRepository } from "../src/crm/repository.js";

const payload = () => ({
  submissionId: randomUUID(), enquiryType: "trip", service: "not_sure",
  destination: "Help me choose", travelTimeframe: "Exploring next year",
  travellers: 2, budget: "", name: "Synthetic Traveller",
  email: "synthetic@example.invalid", phone: "+233200000000",
  notes: "", consent: true, website: "",
});

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
