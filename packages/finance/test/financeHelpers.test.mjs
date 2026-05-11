import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RECEIPT_STATUSES,
  buildFinanceSummary,
  buildReceiptDisplaySummary,
  centsToMajor,
  formatCurrencyFromCents,
  formatCurrencyMajor,
  formatWhatsAppReceiptMessage,
  getPaymentMethodLabel,
  isSuccessfulPaymentStatus,
  majorToCents,
  normalizePaymentMethod,
  normalizePaymentStatus,
  normalizeReceiptStatus,
  normalizeReference,
} from "../src/index.js";

test("currency helpers format major and minor values without mutating inputs", () => {
  assert.equal(majorToCents("12.345"), 1235);
  assert.equal(centsToMajor(1235), 12.35);
  assert.equal(formatCurrencyMajor(1234.5, "GHS", { display: "code", locale: "en-US" }), "GHS 1,234.50");
  assert.match(formatCurrencyFromCents(123450, "GHS", { locale: "en-GH" }), /1,234\.50/);
});

test("payment method and status normalization supports app aliases", () => {
  assert.equal(normalizePaymentMethod("MTN Mobile Money"), PAYMENT_METHODS.MTN_MOMO);
  assert.equal(normalizePaymentMethod("mobile_money"), PAYMENT_METHODS.MOBILE_MONEY);
  assert.equal(getPaymentMethodLabel("bank_transfer"), "Bank Transfer");
  assert.equal(normalizePaymentStatus("confirmed"), PAYMENT_STATUSES.PAID);
  assert.equal(normalizePaymentStatus("partially-paid"), PAYMENT_STATUSES.PARTIAL);
  assert.equal(isSuccessfulPaymentStatus("successful"), true);
  assert.equal(isSuccessfulPaymentStatus("failed"), false);
});

test("receipt and balance helpers provide display-safe summaries", () => {
  assert.equal(normalizeReceiptStatus("offline pending"), RECEIPT_STATUSES.PENDING_SYNC);
  assert.deepEqual(buildFinanceSummary({ totalCents: 10000, paidCents: 3500 }), {
    totalCents: 10000,
    paidCents: 3500,
    balanceDueCents: 6500,
    status: FINANCE_STATUSES.PART_PAID,
  });
  assert.deepEqual(normalizeReference(" momo 123 "), {
    rawReference: "momo 123",
    normalizedReference: "MOMO123",
  });
});

test("receipt message helpers format from immutable snapshots", () => {
  const receipt = {
    receiptNumber: "REC-1",
    amountCents: 10000,
    snapshot: {
      order: { orderNumber: "ORD-1" },
      customer: { name: "Nana" },
      items: [{ productName: "Chair", quantity: 2, totalCents: 10000 }],
    },
  };
  const summary = buildReceiptDisplaySummary(receipt, { display: "code", locale: "en-US" });
  assert.equal(summary.receiptNumber, "REC-1");
  assert.equal(summary.sourceLabel, "ORD-1");
  assert.equal(summary.amountLabel, "GHS 100.00");
  assert.match(formatWhatsAppReceiptMessage(receipt, { display: "code", locale: "en-US" }), /Receipt REC-1/);
});
