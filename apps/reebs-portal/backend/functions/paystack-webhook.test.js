import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

test("Paystack webhook rejects a forged signature before opening a database connection", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "test-secret";
  try {
    const { handler } = await import("./paystack-webhook.js");
    const response = await handler({
      httpMethod: "POST",
      headers: { "x-paystack-signature": "0".repeat(128) },
      body: JSON.stringify({ event: "charge.success", data: { reference: "fake" } }),
    });
    assert.equal(response.statusCode, 401);
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});

test("valid unsupported Paystack events are acknowledged without financial processing", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "test-secret";
  try {
    const body = JSON.stringify({ event: "customeridentification.success", data: {} });
    const signature = crypto.createHmac("sha512", "test-secret").update(body).digest("hex");
    const { handler } = await import(`./paystack-webhook.js?test=${Date.now()}`);
    const response = await handler({ httpMethod: "POST", headers: { "x-paystack-signature": signature }, body });
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).ignored, true);
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});

test("signed Paystack success events reject references without a trusted organization scope", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "test-secret";
  try {
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "customer-supplied-reference",
        status: "success",
        amount: 5000,
        currency: "GHS",
      },
    });
    const signature = crypto.createHmac("sha512", "test-secret").update(body).digest("hex");
    const { handler } = await import(`./paystack-webhook.js?unscoped=${Date.now()}`);
    const response = await handler({
      httpMethod: "POST",
      headers: { "x-paystack-signature": signature },
      body,
    });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /reference is invalid/i);
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});
