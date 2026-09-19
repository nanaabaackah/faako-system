import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWaterWebhookFingerprint,
  handler,
  normalizePaymentStatus,
} from "./water-momo-webhook.js";

test("Water webhook fingerprints exact payloads for retry idempotency", () => {
  const first = buildWaterWebhookFingerprint('{"reference":"WATER-1-2"}', "1:2:WATER-1-2");
  assert.equal(first, buildWaterWebhookFingerprint('{"reference":"WATER-1-2"}', "1:2:WATER-1-2"));
  assert.notEqual(first, buildWaterWebhookFingerprint('{"reference":"WATER-1-2"}', "1:3:WATER-1-3"));
});

test("Mobile Money notifications are pending unless success is explicit", () => {
  assert.equal(normalizePaymentStatus("", "momo"), "pending");
  assert.equal(normalizePaymentStatus("success", "momo"), "paid");
  assert.equal(normalizePaymentStatus("failed", "momo"), "unpaid");
});

test("Water webhook rejects forged shared-secret notifications before database access", async () => {
  const previous = process.env.WATER_MOMO_WEBHOOK_SECRET;
  process.env.WATER_MOMO_WEBHOOK_SECRET = "expected-secret";
  try {
    const response = await handler({
      httpMethod: "POST",
      headers: { "x-water-webhook-secret": "forged-secret" },
      body: JSON.stringify({ reference: "WATER-1-2", status: "success", amountCents: 1000 }),
    });
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /Invalid webhook secret/);
  } finally {
    if (previous === undefined) delete process.env.WATER_MOMO_WEBHOOK_SECRET;
    else process.env.WATER_MOMO_WEBHOOK_SECRET = previous;
  }
});

test("Water reference context cannot be reassigned by request fields", async () => {
  const previous = process.env.WATER_MOMO_WEBHOOK_SECRET;
  process.env.WATER_MOMO_WEBHOOK_SECRET = "expected-secret";
  try {
    const response = await handler({
      httpMethod: "POST",
      headers: { "x-water-webhook-secret": "expected-secret" },
      body: JSON.stringify({
        reference: "WATER-1-2",
        saleId: 3,
        organizationId: 1,
        status: "success",
        amountCents: 1000,
      }),
    });
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /does not match/);
  } finally {
    if (previous === undefined) delete process.env.WATER_MOMO_WEBHOOK_SECRET;
    else process.env.WATER_MOMO_WEBHOOK_SECRET = previous;
  }
});
