import test from "node:test";
import assert from "node:assert/strict";
import {
  readNotificationConfig,
  ResendSender,
} from "../src/notifications/resend.js";
import { enquiryTemplate } from "../src/notifications/enquiry-template.js";
import { deliverOne } from "../src/notifications/outbox.js";

const env = {
  APP_ENV: "staging",
  TWE_RESEND_API_KEY: "synthetic-only",
  TWE_EMAIL_FROM: "Travel With Ease <sender@example.invalid>",
};
test("configuration supports display-name senders and rejects incomplete or unsafe settings", () => {
  assert.equal(readNotificationConfig({}), null);
  assert.equal(readNotificationConfig(env).from, env.TWE_EMAIL_FROM);
  for (const override of [
    { TWE_RESEND_API_KEY: "" },
    { APP_ENV: "stage" },
    { TWE_EMAIL_FROM: "Brand <invalid>" },
    {
      TWE_EMAIL_FROM:
        "Brand\r\nBcc: victim@example.invalid <sender@example.invalid>",
    },
  ])
    assert.throws(() => readNotificationConfig({ ...env, ...override }));
});
test("local/staging redirect only to testing regardless of entered contact or obsolete overrides", async () => {
  for (const environment of ["development", "staging"]) {
    const sent = [];
    const sender = new ResendSender(
      readNotificationConfig({
        ...env,
        APP_ENV: environment,
        TWE_EMAIL_RECIPIENT: "real@example.com",
        TWE_EMAIL_TEST_RECIPIENTS: "real@example.com",
      }),
      async (_url, options) => {
        sent.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ id: "test" }) };
      },
    );
    const payload = sender.payload({
      name: "Traveller",
      email: "real@example.com",
    });
    await sender.send({ id: "test", delivery_payload: payload });
    assert.deepEqual(sent[0].to, ["testing@travelwitheasegh.com"]);
    assert.equal(sent[0].cc, undefined);
    assert.doesNotMatch(JSON.stringify(sent), /real@example.com/);
    for (const override of [
      { to: ["real@example.com"] },
      { cc: ["real@example.com"] },
      { bcc: ["real@example.com"] },
      { reply_to: "real@example.com" },
      { html: undefined },
    ])
      await assert.rejects(
        sender.send({
          id: "test",
          delivery_payload: { ...payload, ...override },
        }),
      );
    assert.equal(sent.length, 1);
  }
});
test("production acknowledges customer and CCs notifications with stable retries", async () => {
  const sent = [];
  const sender = new ResendSender(
    readNotificationConfig({ ...env, APP_ENV: "production" }),
    async (url, options) => {
      sent.push({ url, options });
      return { ok: true, json: async () => ({ id: "synthetic-message" }) };
    },
  );
  assert.throws(() => sender.payload({ email: "invalid" }));
  const payload = sender.payload({
    name: "Traveller",
    email: "customer@example.invalid",
    notes: "private itinerary",
  });
  assert.deepEqual(payload.to, ["customer@example.invalid"]);
  assert.deepEqual(payload.cc, ["notifications@travelwitheasegh.com"]);
  assert.doesNotMatch(
    payload.html + payload.text,
    /private itinerary|staff workspace|api\/auth/,
  );
  const job = { id: "synthetic-job", delivery_payload: payload };
  await sender.send(job);
  await sender.send(job);
  assert.equal(
    sent[0].options.headers["Idempotency-Key"],
    sent[1].options.headers["Idempotency-Key"],
  );
  assert.equal(sent[0].options.body, sent[1].options.body);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].options.redirect, "error");
  await assert.rejects(
    sender.send({ ...job, delivery_payload: { ...payload, cc: [] } }),
  );
});
test("template includes public company identity, escaped greeting and plaintext", () => {
  const template = enquiryTemplate({ name: '<img src=x onerror="alert(1)">' });
  assert.match(template.html, /&lt;img/);
  assert.doesNotMatch(template.html, /<img src=x/);
  for (const output of [template.html, template.text]) {
    for (const value of [
      "TWE Concierge",
      "BN045370826",
      "nana@travelwitheasegh.com",
      "233208387020",
      "travelwitheaseghana",
      "sent automatically",
    ])
      assert.ok(output.includes(value));
    assert.doesNotMatch(output, /nana.oseiwusu@gmail.com|IATA|tracking.pixel/);
  }
  assert.match(template.html, /Primary%20gold.png/);
  assert.match(
    enquiryTemplate({ test: true }).html,
    /No enquiry, booking or payment was created/,
  );
});
test("failure preserves durable retry policy without logging provider details", async () => {
  const job = { id: "synthetic" };
  const actions = [];
  const outbox = {
    claim: async (factory) => {
      assert.equal(typeof factory, "function");
      return job;
    },
    finish: async () => {
      actions.push("finish");
      return true;
    },
    fail: async () => actions.push("fail"),
  };
  const sender = {
    payload: () => ({}),
    send: async () => {
      throw new Error("secret provider body");
    },
  };
  const logs = [];
  assert.equal(
    await deliverOne(outbox, sender, { warn: (...args) => logs.push(args) }),
    true,
  );
  assert.deepEqual(actions, ["fail"]);
  assert.doesNotMatch(JSON.stringify(logs), /secret provider body/);
  sender.send = async () => "synthetic-provider-id";
  await deliverOne(outbox, sender);
  assert.deepEqual(actions, ["fail", "finish"]);
});
