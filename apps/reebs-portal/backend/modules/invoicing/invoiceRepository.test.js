import assert from "node:assert/strict";
import test from "node:test";

import { loadInvoicePaymentState, reserveInvoiceNumber } from "./invoiceRepository.js";

test("invoice number reservation uses one atomic upsert and stable formatting", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ lastValue: 42 }] };
    },
  };
  const number = await reserveInvoiceNumber(client, {
    organizationId: 7,
    documentType: "invoice",
    issueDate: "2026-09-04",
  });
  assert.equal(number, "INV-2026-000042");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /ON CONFLICT/);
  assert.deepEqual(calls[0].values, [7, "invoice", 2026]);
});

test("payment summaries use only paid Core applications", async () => {
  const client = {
    query: async (sql) => {
      if (sql.includes("to_regclass")) return { rows: [{ available: true }] };
      if (sql.includes("GROUP BY")) return { rows: [{ invoiceId: 3, amountPaidCents: 2500 }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const [document] = await loadInvoicePaymentState(client, {
    organizationId: 1,
    documents: [{
      id: 3,
      documentType: "invoice",
      issuedAt: "2026-09-04T08:00:00.000Z",
      paymentStateVersion: 1,
      financialSnapshot: { version: 1, totalCents: 10000 },
    }],
  });
  assert.equal(document.paymentSummary.amountPaidCents, 2500);
  assert.equal(document.paymentSummary.balanceDueCents, 7500);
  assert.equal(document.paymentStatus, "partially_paid");
});

test("missing payment foundation preserves a legacy paid invoice", async () => {
  const client = { query: async () => ({ rows: [{ available: false }] }) };
  const [document] = await loadInvoicePaymentState(client, {
    organizationId: 1,
    documents: [{
      id: 4,
      documentType: "invoice",
      paymentStatus: "paid",
      paymentStateVersion: 0,
      financialSnapshot: { version: 1, totalCents: 4000 },
    }],
  });
  assert.equal(document.paymentStatus, "paid");
  assert.equal(document.paymentSummary.amountPaidCents, 4000);
  assert.equal(document.paymentSummary.balanceDueCents, 0);
});

test("an issued Order receipt derives paid status from its trusted source snapshot", async () => {
  const client = { query: async () => ({ rows: [{ available: false }] }) };
  const [document] = await loadInvoicePaymentState(client, {
    organizationId: 1,
    documents: [{
      id: 5,
      documentType: "receipt",
      issuedAt: "2026-09-04T08:00:00.000Z",
      paymentStateVersion: 1,
      sourceSnapshot: { version: 1, type: "ORDER", amountPaidCents: 4000 },
      financialSnapshot: { version: 1, totalCents: 4000 },
    }],
  });
  assert.equal(document.paymentStatus, "paid");
  assert.equal(document.paymentSummary.balanceDueCents, 0);
});

test("compact documents retain their total when no persisted financial snapshot exists", async () => {
  const client = { query: async () => ({ rows: [{ available: false }] }) };
  const [document] = await loadInvoicePaymentState(client, {
    organizationId: 1,
    documents: [{
      id: 6,
      documentType: "invoice",
      paymentStatus: "draft",
      paymentStateVersion: 1,
      financialSnapshot: null,
      grandTotal: 125,
    }],
  });
  assert.equal(document.paymentSummary.totalCents, 12500);
  assert.equal(document.paymentSummary.amountPaidCents, 0);
  assert.equal(document.paymentSummary.balanceDueCents, 12500);
});
