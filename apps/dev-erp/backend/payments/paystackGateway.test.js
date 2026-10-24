import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createPaystackGateway, parseGhsPesewas, verifyPaystackSignature } from "./paystackGateway.js";

test("GHS amounts use exact pesewas", () => {
  assert.equal(parseGhsPesewas("10.05"), 1005);
  assert.throws(() => parseGhsPesewas("1.005"));
  assert.throws(() => parseGhsPesewas("0"));
});
test("webhook signature requires matching raw body", () => {
  const raw = Buffer.from('{"event":"charge.success"}');
  const sig = crypto.createHmac("sha512", "secret").update(raw).digest("hex");
  assert.equal(verifyPaystackSignature(raw, sig, "secret"), true);
  assert.equal(verifyPaystackSignature(Buffer.from("different"), sig, "secret"), false);
});
test("initialize validates hosted checkout and reference", async () => {
  let sentBody;
  const gateway = createPaystackGateway({ secretKey: "test", fetchImpl: async () => ({
    ok: true, json: async () => ({ status: true, data: { reference: "INV-12345678", authorization_url: "https://checkout.paystack.com/abc", access_code: "abc" } }),
  }) });
  const observingGateway = createPaystackGateway({ secretKey: "test", fetchImpl: async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ status: true, data: { reference: "INV-12345678", authorization_url: "https://checkout.paystack.com/abc", access_code: "abc" } }) };
  } });
  void gateway;
  const result = await observingGateway.initialize({ reference: "INV-12345678", amountPesewas: 1000, email: "client@example.com", callbackUrl: "https://example.com/return", metadata: { id: 12 }, channels: ["card", "unsupported"] });
  assert.equal(result.reference, "INV-12345678");
  assert.equal(sentBody.amount, "1000");
  assert.deepEqual(sentBody.channels, ["card"]);
  assert.equal(sentBody.metadata.id, "12");
});

test("verification exposes only normalized settlement fields", async () => {
  const gateway = createPaystackGateway({ secretKey: "test", fetchImpl: async () => ({
    ok: true,
    json: async () => ({ status: true, data: {
      id: 991,
      reference: "INV-12345678",
      status: "success",
      amount: 1205,
      currency: "GHS",
      paid_at: "2026-10-23T10:00:00.000Z",
      channel: "mobile_money",
      domain: "test",
      customer: { email: "client@example.com", authorization: { authorization_code: "must-not-leak" } },
    } }),
  }) });
  const result = await gateway.verify("INV-12345678");
  assert.deepEqual(result, {
    reference: "INV-12345678",
    status: "success",
    amountPesewas: 1205,
    currency: "GHS",
    paidAt: "2026-10-23T10:00:00.000Z",
    transactionId: "991",
    channel: "mobile_money",
    customerEmail: "client@example.com",
    domain: "test",
  });
  assert.equal(JSON.stringify(result).includes("authorization_code"), false);
});
