import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { demoInquirySchema } from "../src/validation.js";

const valid = {
  kind: "personalised", destination: "Zanzibar", travelStyle: "A slower pace",
  travellers: "2", name: "Test Traveller", email: "test@example.invalid",
  phone: "+233240000000", notes: "Test question", consent: true, website: "",
};

test("staging demo enquiries require truthful contact fields and explicit consent", () => {
  const result = demoInquirySchema.safeParse(valid);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, valid);
  for (const change of [
    { consent: false }, { name: "" }, { destination: "Other" }, { kind: "payment" },
    { travelStyle: "invalid" }, { travellers: "99" }, { notes: "x".repeat(1501) },
    { email: "invalid" }, { phone: "bad" }, { demo: true },
  ]) assert.equal(demoInquirySchema.safeParse({ ...valid, ...change }).success, false);
});

test("production and unverified hosted startup cannot expose staging demo endpoint", () => {
  const repository = { async createDemoEnquiry() {} };
  assert.throws(() => createApp({
    environment: "production", repository, allowedOrigins: ["https://staging.example.test"],
    demoOrigin: "https://staging.example.test",
  }), /Hosted startup requires verified/);
  assert.throws(() => createApp({
    environment: "test", repository, allowedOrigins: ["https://staging.example.test"],
    demoOrigin: "https://staging.example.test",
  }), /forbidden in production/);
});
