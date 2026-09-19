import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  createPaystackProvider,
  normalizePaystackTransaction,
  verifyPaystackSignature,
} from "./paystackProvider.js";

test("verifies Paystack webhook signatures against the unmodified body", () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "REEBS-PAY-1" } });
  const secretKey = "sk_test_example";
  const signature = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  assert.equal(verifyPaystackSignature({ rawBody, signature, secretKey }), true);
  assert.equal(verifyPaystackSignature({ rawBody: `${rawBody} `, signature, secretKey }), false);
  assert.equal(verifyPaystackSignature({ rawBody, signature: "forged", secretKey }), false);
});

test("initialization sends only trusted normalized payment fields", async () => {
  let request;
  const provider = createPaystackProvider({
    secretKey: "sk_test_example",
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: { authorization_url: "https://checkout.paystack.com/test", access_code: "code", reference: "REEBS-PAY-1" },
        }),
      };
    },
  });
  const result = await provider.initializePayment({
    email: " Customer@Example.com ",
    amountCents: 12500,
    currency: "ghs",
    reference: "REEBS-PAY-1",
  });
  assert.equal(request.url, "https://api.paystack.co/transaction/initialize");
  assert.deepEqual(request.body, {
    email: "customer@example.com",
    amount: 12500,
    currency: "GHS",
    reference: "REEBS-PAY-1",
  });
  assert.equal(result.authorizationUrl, "https://checkout.paystack.com/test");
});

test("normalizes verification without exposing raw provider payload", () => {
  assert.deepEqual(
    normalizePaystackTransaction({
      reference: "ref-1",
      status: "success",
      amount: 5000,
      currency: "ghs",
      channel: "mobile_money",
      customer: { email: "PERSON@example.com", authorization: { reusable: true } },
      metadata: { secret: "not returned" },
    }),
    {
      provider: "PAYSTACK",
      providerReference: "ref-1",
      status: "success",
      amountCents: 5000,
      currency: "GHS",
      paidAt: null,
      channel: "mobile_money",
      customerEmail: "person@example.com",
    }
  );
});

test("provider owns signed webhook parsing and supports only charge.success", () => {
  const secretKey = "sk_test_example";
  const provider = createPaystackProvider({ secretKey, fetchImpl: async () => ({}) });
  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "REEBS-PAY-1", status: "success", amount: 5000, currency: "GHS" } });
  const signature = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const result = provider.processWebhook({ rawBody, signature });
  assert.equal(result.supported, true);
  assert.equal(result.transaction.providerReference, "REEBS-PAY-1");
  assert.throws(
    () => provider.processWebhook({ rawBody, signature: "0".repeat(128) }),
    (error) => error.code === "INVALID_WEBHOOK_SIGNATURE"
  );
});
