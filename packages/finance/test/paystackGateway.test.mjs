import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createPaystackGateway,
  normalizeGatewayPaymentRequest,
  verifyPaystackSignature,
} from "../src/gateways/index.js";

test("gateway contract requires GHS minor units and a server reference", () => {
  assert.deepEqual(normalizeGatewayPaymentRequest({
    amountCents: 12500,
    currency: "ghs",
    email: "CUSTOMER@example.com",
    reference: "REEBS-ORDER-123",
  }), {
    amountCents: 12500,
    currency: "GHS",
    email: "customer@example.com",
    reference: "REEBS-ORDER-123",
    callbackUrl: undefined,
    metadata: {},
  });
  assert.throws(() => normalizeGatewayPaymentRequest({ amountCents: 0 }), /positive integer/);
});

test("Paystack initialization sends minor units without exposing the secret", async () => {
  let request;
  const gateway = createPaystackGateway({
    secretKey: "sk_test_example",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ status: true, data: {
        reference: "REEBS-ORDER-123",
        authorization_url: "https://checkout.example.test/abc",
        access_code: "abc",
      } }) };
    },
  });
  const result = await gateway.initialize({
    amountCents: 12500,
    currency: "GHS",
    email: "customer@example.com",
    reference: "REEBS-ORDER-123",
  });
  assert.equal(JSON.parse(request.options.body).amount, 12500);
  assert.equal(result.authorizationUrl, "https://checkout.example.test/abc");
  assert.equal(JSON.stringify(result).includes("sk_test_example"), false);
});

test("Paystack webhook signatures use the exact raw body", () => {
  const rawBody = '{"event":"charge.success"}';
  const secretKey = "sk_test_example";
  const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  assert.equal(verifyPaystackSignature({ rawBody, signature, secretKey }), true);
  assert.equal(verifyPaystackSignature({ rawBody: `${rawBody} `, signature, secretKey }), false);
});
