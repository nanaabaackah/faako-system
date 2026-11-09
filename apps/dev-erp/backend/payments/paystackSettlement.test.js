import test from "node:test";
import assert from "node:assert/strict";
import { validateVerifiedPaystackPayment } from "./paystackSettlement.js";

const intent = { provider: "PAYSTACK", status: "PENDING", reference: "INV-12345678", amountPesewas: 15000, currency: "GHS", type: "INVOICE", invoiceId: 42, organizationId: 7 };
const transaction = { reference: "INV-12345678", amountPesewas: 15000, currency: "GHS", status: "success" };

test("valid verified invoice payment returns a scoped settlement decision", () => {
  assert.deepEqual(validateVerifiedPaystackPayment({ intent, transaction }), {
    settled: true, reference: transaction.reference, amountPesewas: 15000, currency: "GHS",
    organizationId: 7, type: "INVOICE", invoiceId: 42, standalonePaymentId: null,
  });
});
test("valid standalone payment has no invoice posting target", () => {
  const result = validateVerifiedPaystackPayment({ intent: { ...intent, type: "STANDALONE", invoiceId: null, standalonePaymentId: 19 }, transaction });
  assert.equal(result.invoiceId, null);
  assert.equal(result.standalonePaymentId, 19);
});
test("pending provider status cannot settle", () => {
  assert.equal(validateVerifiedPaystackPayment({ intent, transaction: { ...transaction, status: "pending" } }).settled, false);
});
test("reject mismatched reference, amount, currency and cancelled intents", () => {
  for (const changed of [{ reference: "OTHER-12345678" }, { amountPesewas: 100 }, { currency: "USD" }]) {
    assert.throws(() => validateVerifiedPaystackPayment({ intent, transaction: { ...transaction, ...changed } }));
  }
  assert.throws(() => validateVerifiedPaystackPayment({ intent: { ...intent, status: "CANCELLED" }, transaction }));
});
