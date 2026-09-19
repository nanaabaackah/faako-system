import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvoicePaymentSummary,
  calculateInvoiceFinancialSnapshot,
  deriveInvoiceStatus,
  formatInvoiceNumber,
  validateInvoiceForIssue,
} from "./invoiceDomain.js";

test("invoice totals are calculated in integer pesewas from sanitized lines", () => {
  assert.deepEqual(calculateInvoiceFinancialSnapshot({
    lineItems: [
      { rowType: "heading", name: "Rentals", quantity: 0, unitPrice: 0 },
      { rowType: "item", name: "Castle", quantity: 2, unitPrice: 125.55 },
    ],
    additionalItems: [{ description: "Delivery", quantity: 1, unitPrice: 50 }],
    taxRate: 0.1,
    discountAmount: 20,
  }), {
    version: 1,
    subtotalCents: 25110,
    additionalCents: 5000,
    taxCents: 3011,
    discountCents: 2000,
    totalCents: 31121,
    taxRate: 0.1,
  });
});

test("payment status is derived from applications and due date", () => {
  const base = {
    documentType: "invoice",
    issuedAt: "2026-09-01T10:00:00.000Z",
    dueDate: "2026-09-03",
    paymentStateVersion: 1,
    totalCents: 10000,
    today: new Date("2026-09-04T12:00:00.000Z"),
  };
  assert.equal(deriveInvoiceStatus({ ...base, amountPaidCents: 0 }), "overdue");
  assert.equal(deriveInvoiceStatus({ ...base, dueDate: "2026-09-05", amountPaidCents: 4000 }), "partially_paid");
  assert.equal(deriveInvoiceStatus({ ...base, amountPaidCents: 10000 }), "paid");
});

test("legacy status remains stable until the payment-state migration is opted in", () => {
  assert.equal(deriveInvoiceStatus({ legacyStatus: "paid", paymentStateVersion: 0 }), "paid");
});

test("invoice payment summary never reports a negative balance", () => {
  const summary = buildInvoicePaymentSummary({
    issuedAt: "2026-09-04T10:00:00.000Z",
    paymentStateVersion: 1,
    financialSnapshot: { version: 1, totalCents: 5000 },
  }, 6000);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.paymentStatus, "paid");
});

test("issuing requires a customer, billable line, date and positive total", () => {
  assert.equal(validateInvoiceForIssue({ documentType: "invoice" })?.code, "INVOICE_CUSTOMER_REQUIRED");
  const valid = {
    documentType: "invoice",
    customerId: 2,
    issueDate: "2026-09-04",
    lineItems: [{ rowType: "item", quantity: 1, unitPrice: 100 }],
  };
  assert.equal(validateInvoiceForIssue(valid), null);
});

test("invoice numbers are stable human-readable sequence values", () => {
  assert.equal(formatInvoiceNumber({ documentType: "invoice", year: 2026, sequence: 12 }), "INV-2026-000012");
  assert.equal(formatInvoiceNumber({ documentType: "receipt", year: 2026, sequence: 3 }), "REC-2026-000003");
});

test("a receipt is not marked paid without verified money", () => {
  assert.equal(deriveInvoiceStatus({
    documentType: "receipt",
    issuedAt: "2026-09-04T08:00:00.000Z",
    paymentStateVersion: 1,
    totalCents: 5000,
    amountPaidCents: 0,
  }), "unpaid");
});
