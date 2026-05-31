import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvoicePaymentSummary,
  parseInvoicePaidAmount,
} from "./paymentSummary.js";

test("parseInvoicePaidAmount accepts zero and rounds currency values", () => {
  assert.deepEqual(parseInvoicePaidAmount(0), { paidAmount: 0 });
  assert.deepEqual(parseInvoicePaidAmount("12.345"), { paidAmount: 12.35 });
});

test("parseInvoicePaidAmount rejects negative and malformed values", () => {
  assert.deepEqual(parseInvoicePaidAmount(-1), {
    error: "paidAmount must be 0 or greater.",
  });
  assert.deepEqual(parseInvoicePaidAmount("not-a-number"), {
    error: "paidAmount must be 0 or greater.",
  });
});

test("buildInvoicePaymentSummary reports unpaid, partial, paid, and overpaid balances", () => {
  assert.deepEqual(buildInvoicePaymentSummary({ total: 100, paidAmount: 0 }), {
    paidAmount: 0,
    balanceDue: 100,
    paymentStatus: "unpaid",
  });
  assert.deepEqual(buildInvoicePaymentSummary({ total: 100, paidAmount: 25 }), {
    paidAmount: 25,
    balanceDue: 75,
    paymentStatus: "part_paid",
  });
  assert.deepEqual(buildInvoicePaymentSummary({ total: 100, paidAmount: 100 }), {
    paidAmount: 100,
    balanceDue: 0,
    paymentStatus: "paid",
  });
  assert.deepEqual(buildInvoicePaymentSummary({ total: 100, paidAmount: 125 }), {
    paidAmount: 125,
    balanceDue: 0,
    paymentStatus: "overpaid",
  });
});
