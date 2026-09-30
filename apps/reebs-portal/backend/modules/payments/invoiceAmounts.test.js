import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceTotalCents } from "./invoiceAmounts.js";

test("invoice total is calculated in pesewas from trusted document rows", () => {
  assert.equal(calculateInvoiceTotalCents({
    lineItems: [{ rowType: "item", quantity: 2, unitPrice: 100 }],
    additionalItems: [{ quantity: 1, unitPrice: 50 }],
    taxRate: 0.1,
    discountAmount: 25,
  }), 25000);
});

test("headings and excessive discounts cannot produce a negative payable", () => {
  assert.equal(calculateInvoiceTotalCents({
    lineItems: [{ rowType: "heading", total: 900 }, { quantity: 1, unitPrice: 10 }],
    discountAmount: 50,
  }), 0);
});
