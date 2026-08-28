import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvoiceDocumentEmailText,
  buildInvoiceDocumentSummary,
} from "./invoice-document-email.js";
import {
  buildCustomerBookingEmailText,
  buildInternalBookingEmailText,
} from "./_shared/transactionEmailTemplates.js";
import { DEFAULT_SERVICE_PAYMENT_TERMS } from "../../shared/paymentCopy.js";

const withPaymentEnvironment = async (callback) => {
  const keys = ["EMAIL_PAYMENT_MOMO_DETAILS", "EMAIL_PAYMENT_BANK_DETAILS"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.EMAIL_PAYMENT_MOMO_DETAILS = "Configured mobile-money instructions";
  process.env.EMAIL_PAYMENT_BANK_DETAILS = "Configured bank instructions";
  try {
    await callback();
  } finally {
    keys.forEach((key) => {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
};

const invoice = {
  documentType: "invoice",
  docLabel: "Invoice",
  invoiceNumber: "INV-42",
  customerName: "Example Customer",
  paymentStatus: "unpaid",
  issueDate: "2000-01-01",
  dueDate: "2000-01-02",
  depositAmount: 31.25,
  taxRate: 0,
  discountAmount: 0,
  lineItems: [
    {
      id: "line-1",
      name: "Event service",
      quantity: 1,
      unitLabel: "Per item",
      unitPrice: 100,
    },
  ],
  additionalItems: [],
};

test("invoice email summary preserves the persisted deposit even after its due date", () => {
  const summary = buildInvoiceDocumentSummary(invoice);

  assert.equal(summary.grandTotal, 100);
  assert.equal(summary.depositAmount, 31.25);
  assert.equal(summary.balanceDue, 68.75);
  assert.equal(summary.overdue, true);
});

test("a paid persisted invoice reports no remaining balance", () => {
  const summary = buildInvoiceDocumentSummary({
    ...invoice,
    paymentStatus: "paid",
  });

  assert.equal(summary.depositAmount, 31.25);
  assert.equal(summary.balanceDue, 0);
  assert.equal(summary.overdue, false);
});

test("invoice email uses configured payment instructions without recalculating a percentage", async () => {
  await withPaymentEnvironment(() => {
    const summary = buildInvoiceDocumentSummary(invoice);
    const text = buildInvoiceDocumentEmailText(invoice, summary, "GHS");

    assert.match(text, /Deposit overdue:.*31\.25/);
    assert.match(text, /Configured mobile-money instructions/);
    assert.match(text, /Configured bank instructions/);
    assert.match(text, /Reference: INV-42/);
    assert.doesNotMatch(text, /70%|100%|48\s*(?:hrs?|hours?)/i);
  });
});

test("booking emails use server-configured payment routes and generic deposit copy", async () => {
  await withPaymentEnvironment(() => {
    const booking = {
      id: 51,
      customerName: "Example Customer",
      customerEmail: "customer@example.com",
      totalAmount: 10000,
      eventDate: "2030-01-01",
      items: [],
    };
    const customerText = buildCustomerBookingEmailText(booking, {
      supportEmail: "support@example.com",
    });
    const internalText = buildInternalBookingEmailText(booking);

    assert.match(customerText, /required deposit/i);
    assert.match(customerText, /Configured bank instructions/);
    assert.match(internalText, /Configured mobile-money instructions/);
    assert.doesNotMatch(`${customerText}\n${internalText}`, /70%|48\s*(?:hrs?|hours?)/i);
  });
});

test("shared browser fallback copy contains no live payment credentials", () => {
  assert.match(DEFAULT_SERVICE_PAYMENT_TERMS, /configured server-side channels/i);
  assert.doesNotMatch(DEFAULT_SERVICE_PAYMENT_TERMS, /(?:account number|mobile money to|\b\d{10,}\b)/i);
});
