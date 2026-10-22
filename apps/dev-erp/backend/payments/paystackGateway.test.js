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
  const gateway = createPaystackGateway({ secretKey: "test", fetchImpl: async () => ({
    ok: true, json: async () => ({ status: true, data: { reference: "INV-12345678", authorization_url: "https://checkout.paystack.com/abc", access_code: "abc" } }),
  }) });
  const result = await gateway.initialize({ reference: "INV-12345678", amountPesewas: 1000, email: "client@example.com", callbackUrl: "https://example.com/return" });
  assert.equal(result.reference, "INV-12345678");
});
