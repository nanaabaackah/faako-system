import test from "node:test";
import assert from "node:assert/strict";
import { readNotificationConfig, ResendSender } from "../src/notifications/resend.js";
import { deliverOne } from "../src/notifications/outbox.js";

const env = { APP_ENV: "staging", TWE_RESEND_API_KEY: "synthetic-only", TWE_EMAIL_FROM: "sender@example.invalid", TWE_EMAIL_RECIPIENT: "testing@travelwitheasegh.com", TWE_EMAIL_TEST_RECIPIENTS: "testing@travelwitheasegh.com", TWE_PORTAL_ORIGIN: "https://portal.example.invalid" };
test("sender supports a display name but rejects malformed addresses and header injection", () => {
  const from = "Travel With Ease <sender@example.invalid>";
  assert.equal(readNotificationConfig({ ...env, TWE_EMAIL_FROM: from }).from, from);
  for (const value of ["Brand <invalid>", "Brand <a@example.invalid> <b@example.invalid>", "Brand\r\nBcc: victim@example.invalid <sender@example.invalid>"]) {
    assert.throws(() => readNotificationConfig({ ...env, TWE_EMAIL_FROM: value }));
  }
});
test("environment delivery policy cannot be broadened by an allowlist", () => {
  for (const APP_ENV of ["development", "staging"]) {
    assert.equal(readNotificationConfig({ ...env, APP_ENV }).to, "testing@travelwitheasegh.com");
    assert.throws(() => readNotificationConfig({ ...env, APP_ENV, TWE_EMAIL_RECIPIENT: "notifications@travelwitheasegh.com", TWE_EMAIL_TEST_RECIPIENTS: "notifications@travelwitheasegh.com" }));
    assert.throws(() => readNotificationConfig({ ...env, APP_ENV, TWE_EMAIL_RECIPIENT: "customer@example.invalid", TWE_EMAIL_TEST_RECIPIENTS: "customer@example.invalid" }));
  }
  assert.throws(() => readNotificationConfig({ ...env, APP_ENV: "production" }));
  assert.equal(readNotificationConfig({ ...env, APP_ENV: "production", TWE_EMAIL_RECIPIENT: "notifications@travelwitheasegh.com" }).to, "notifications@travelwitheasegh.com");
});
test("notification configuration requires exact test recipients outside production", () => {
  assert.equal(readNotificationConfig({}), null);
  assert.equal(readNotificationConfig(env).environment, "staging");
  for (const override of [{ TWE_EMAIL_TEST_RECIPIENTS: "" }, { TWE_EMAIL_RECIPIENT: "customer@example.invalid" }, { APP_ENV: "stage" }, { TWE_PORTAL_ORIGIN: "http://portal.example.invalid" }, { TWE_RESEND_API_KEY: "" }]) assert.throws(() => readNotificationConfig({ ...env, ...override }));
});
test("Resend transport pins payload, uses stable idempotency and never includes customer data", async () => {
  const sent = [];
  const sender = new ResendSender(readNotificationConfig(env), async (url, options) => { sent.push({ url, options }); return { ok: true, json: async () => ({ id: "synthetic-message" }) }; });
  const job = { id: "synthetic-job", delivery_payload: sender.payload() };
  assert.equal(await sender.send(job), "synthetic-message");
  await sender.send(job);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].options.redirect, "error");
  assert.equal(sent[0].options.headers["Idempotency-Key"], sent[1].options.headers["Idempotency-Key"]);
  assert.equal(sent[0].options.body, sent[1].options.body);
  assert.deepEqual(Object.keys(JSON.parse(sent[0].options.body)).sort(), ["from", "subject", "text", "to"]);
  await assert.rejects(sender.send({ ...job, delivery_payload: { ...job.delivery_payload, to: ["customer@example.invalid"] } }));
  assert.equal(sent.length, 2);
});
test("delivery failure preserves durable job policy and omits provider error details from logs", async () => {
  const job = { id: "synthetic" }; const actions = [];
  const outbox = { claim: async () => job, finish: async () => { actions.push("finish"); return true; }, fail: async () => actions.push("fail") };
  const sender = { payload: () => ({}), send: async () => { throw new Error("secret provider body"); } };
  const logs = [];
  assert.equal(await deliverOne(outbox, sender, { warn: (...args) => logs.push(args) }), true);
  assert.deepEqual(actions, ["fail"]);
  assert.doesNotMatch(JSON.stringify(logs), /secret provider body/);
  sender.send = async () => "synthetic-provider-id";
  await deliverOne(outbox, sender);
  assert.deepEqual(actions, ["fail", "finish"]);
});
