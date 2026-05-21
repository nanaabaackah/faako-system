import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  PAYMENT_STATUSES,
  mapPaystackStatus,
  verifyPaystackWebhookSignature,
} from "./src/paystack.js";

test("Paystack webhook signature verification accepts signed raw payloads", () => {
  const previousSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = "sk_test_webhook_signature";

  try {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: { reference: "STR-TEST-001", amount: 12000, currency: "GHS" },
      })
    );
    const signature = crypto
      .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    assert.equal(verifyPaystackWebhookSignature({ rawBody, signature }), true);
    assert.equal(verifyPaystackWebhookSignature({ rawBody, signature: "bad-signature" }), false);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.PAYSTACK_WEBHOOK_SECRET;
    } else {
      process.env.PAYSTACK_WEBHOOK_SECRET = previousSecret;
    }
  }
});

test("Paystack transaction statuses map to internal payment states", () => {
  assert.equal(mapPaystackStatus("success"), PAYMENT_STATUSES.PAID);
  assert.equal(mapPaystackStatus("failed"), PAYMENT_STATUSES.FAILED);
  assert.equal(mapPaystackStatus("abandoned"), PAYMENT_STATUSES.ABANDONED);
  assert.equal(mapPaystackStatus("pending"), PAYMENT_STATUSES.PAYMENT_PENDING);
});
