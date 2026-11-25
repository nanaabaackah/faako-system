import test from "node:test";
import assert from "node:assert/strict";
import {
  readNotificationConfig,
  ResendSender,
} from "../src/notifications/resend.js";
import { defaultEnquiryCopy, enquiryTemplate } from "../src/notifications/enquiry-template.js";
import { deliverOne } from "../src/notifications/outbox.js";
import { createContinuationLinks } from "../src/enquiries/continuation-links.js";

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
test("production sends separately pinned customer and staff messages with stable retries", async () => {
  const sent = [];
  const sender = new ResendSender(
    readNotificationConfig({ ...env, APP_ENV: "production" }),
    async (url, options) => {
      sent.push({ url, options });
      return { ok: true, json: async () => ({ id: "synthetic-message" }) };
    },
  );
  assert.throws(() => sender.payload({ email: "invalid" }));
  const enquiryId = "57f9be65-c7aa-4bf8-97ce-e60fdb8e3c33";
  const payload = sender.payload({
    id: enquiryId,
    contact: { name: "Traveller", email: "customer@example.invalid" },
    notes: "private itinerary",
  });
  assert.deepEqual(payload.to, ["customer@example.invalid"]);
  assert.equal(payload.cc, undefined);
  assert.deepEqual(payload.staff.to, ["notifications@travelwitheasegh.com"]);
  assert.doesNotMatch(payload.staff.html + payload.staff.text, /private itinerary|customer@example|continue=v1/);
  const job = { id: "synthetic-job", enquiry_id: enquiryId, delivery_payload: payload };
  await sender.send(job);
  await sender.send(job);
  assert.equal(sent.length, 4);
  for (let i = 0; i < 2; i++) {
    assert.equal(sent[i].options.headers["Idempotency-Key"], sent[i + 2].options.headers["Idempotency-Key"]);
    assert.equal(sent[i].options.body, sent[i + 2].options.body);
    assert.equal(sent[i].url, "https://api.resend.com/emails");
    assert.equal(sent[i].options.redirect, "error");
    assert.equal(JSON.parse(sent[i].options.body).staff, undefined);
  }
  assert.notEqual(sent[0].options.headers["Idempotency-Key"], sent[1].options.headers["Idempotency-Key"]);
  for (const changed of [{ ...payload, cc: [] }, { ...payload, staff: { ...payload.staff, to: ["attacker@example.invalid"] } }, { ...payload, staff: { ...payload.staff, text: "private link" } }]) {
    await assert.rejects(sender.send({ ...job, delivery_payload: changed }));
  }
  assert.equal(sent.length, 4);
});

test("partial provider failure retries the same two requests without changing their idempotency keys", async () => {
  const calls = [];
  const accepted = new Map();
  const sender = new ResendSender(readNotificationConfig({ ...env, APP_ENV: "production" }), async (_url, options) => {
    const key = options.headers["Idempotency-Key"];
    calls.push({ key, body: options.body });
    if (key.endsWith("-staff") && calls.length === 2) return { ok: false };
    if (!accepted.has(key)) accepted.set(key, "provider-" + accepted.size);
    return { ok: true, json: async () => ({ id: accepted.get(key) }) };
  });
  const enquiryId = "57f9be65-c7aa-4bf8-97ce-e60fdb8e3c33";
  const job = { id: "retry-job", enquiry_id: enquiryId, delivery_payload: sender.payload({ id: enquiryId, contact: { email: "customer@example.invalid" } }) };
  await assert.rejects(sender.send(job), /provider_rejected/);
  assert.equal(await sender.send(job), "provider-0");
  assert.equal(accepted.size, 2);
  assert.deepEqual(calls.slice(0, 2), calls.slice(2));
});

test("staging pair never sends to a real customer or staff mailbox", async () => {
  const messages = [];
  const sender = new ResendSender(readNotificationConfig(env), async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ id: "synthetic" }) };
  });
  const enquiryId = "57f9be65-c7aa-4bf8-97ce-e60fdb8e3c33";
  await sender.send({ id: "staging-job", enquiry_id: enquiryId, delivery_payload: sender.payload({ id: enquiryId, contact: { email: "real@example.invalid" } }) });
  assert.equal(messages.length, 2);
  assert.ok(messages.every(message => message.to[0] === "testing@travelwitheasegh.com" && !message.cc));
  assert.doesNotMatch(JSON.stringify(messages), /real@example.invalid|notifications@travelwitheasegh.com/);
});
test("acknowledgement creates a private expiring questionnaire fragment without enquiry answers", () => {
  const sender = new ResendSender(
    readNotificationConfig({ ...env, APP_ENV: "production" }),
    null,
    { ...defaultEnquiryCopy, message: "Received.", ctaLabel: "Old label" },
    createContinuationLinks({
      secret: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
      origin: "https://travelwitheasegh.com",
      clock: () => Date.parse("2026-11-13T10:00:00.000Z"),
    }),
  );
  const payload = sender.payload({
    id: "57f9be65-c7aa-4bf8-97ce-e60fdb8e3c33",
    createdAt: "2026-11-13T10:00:00.000Z",
    contact: { name: "Traveller", email: "traveller@example.invalid" },
    answers: { passport: "must-not-appear" },
  });
  assert.doesNotMatch(payload.staff.html + payload.staff.text, /continue=v1|traveller@example.invalid|passport/);
  for (const output of [payload.html, payload.text]) {
    assert.match(output, /Complete your trip details/);
    assert.match(output, /plan-your-trip#continue=v1\./);
    assert.match(output, /Valid for 14 days/);
    assert.doesNotMatch(output, /must-not-appear|passport/);
  }
});
test("template includes public company identity, escaped greeting and plaintext", () => {
  const template = enquiryTemplate({ name: '<img src=x onerror="alert(1)">' });
  assert.match(template.html, /&lt;img/);
  assert.doesNotMatch(template.html, /<img src=x/);
  for (const output of [template.html, template.text]) {
    for (const value of [
      "Travel With Ease",
      "info@travelwitheasegh.com",
      "233208387020",
      "travelwitheaseghana",
      "sent automatically",
    ])
      assert.ok(output.includes(value));
    assert.doesNotMatch(output, /nana.oseiwusu@gmail.com|IATA|tracking.pixel/);
    assert.doesNotMatch(output, /business registration|BN\d{6,}|House no\s+\d|TWE\s+Concierge/i);
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
