import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildExternalReferenceKey,
  createInvoicePaymentHandlers,
  fingerprintPaymentRequest,
} from "./paymentLedger.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const request = ({ body = {}, params = {}, userId = 1, organizationId = 2, key = "payment-key-123" } = {}) => ({
  body,
  params,
  headers: { "idempotency-key": key, "x-request-id": "request-1" },
  user: { userId, organizationId, fullName: `User ${userId}`, email: `user${userId}@example.com`, roleName: "Admin" },
  ip: "127.0.0.1",
});

const buildPrisma = () => {
  const state = {
    invoice: { id: 10, organizationId: 2, invoiceNumber: "INV-010", status: "SENT", currency: "GHS", clientName: "Acme", total: "100.00", paidAmount: "0.00", legacyPaidAmount: null, paymentLedgerActivatedAt: null, lineItems: [] },
    payments: [], ledger: [], claims: [], audit: [], accounting: null,
  };
  let nextPaymentId = 1;
  let nextLedgerId = 1;
  let nextClaimId = 1;
  const attach = (payment) => ({
    ...payment,
    recordedByUser: { id: payment.recordedByUserId, fullName: `User ${payment.recordedByUserId}`, email: `user${payment.recordedByUserId}@example.com` },
    verifiedByUser: payment.verifiedByUserId ? { id: payment.verifiedByUserId, fullName: `User ${payment.verifiedByUserId}`, email: `user${payment.verifiedByUserId}@example.com` } : null,
    rejectedByUser: null,
    ledgerEntries: state.ledger.filter((entry) => entry.paymentId === payment.id),
  });
  const tx = {
    $executeRawUnsafe: async () => 1,
    invoice: {
      findFirst: async ({ where }) => where.id === state.invoice.id && (!where.organizationId || where.organizationId === state.invoice.organizationId) ? state.invoice : null,
      update: async ({ data }) => { state.invoice = { ...state.invoice, ...data }; return state.invoice; },
    },
    invoicePayment: {
      create: async ({ data }) => {
        if (data.externalReferenceKey && state.payments.some((payment) => payment.externalReferenceKey === data.externalReferenceKey)) throw Object.assign(new Error("duplicate reference"), { code: "P2002" });
        const payment = { id: nextPaymentId++, transactionId: `payment-${nextPaymentId}`, verificationStatus: "PENDING_VERIFICATION", createdAt: new Date(), ...data };
        state.payments.push(payment);
        return attach(payment);
      },
      findFirst: async ({ where }) => state.payments.find((payment) => payment.id === where.id && payment.invoiceId === where.invoiceId && payment.organizationId === where.organizationId && (!where.verificationStatus || payment.verificationStatus === where.verificationStatus)) || null,
      findUnique: async ({ where }) => { const payment = state.payments.find((entry) => entry.id === where.id); return payment ? attach(payment) : null; },
      update: async ({ where, data }) => { const payment = state.payments.find((entry) => entry.id === where.id); Object.assign(payment, data); return payment; },
      findMany: async () => state.payments.map(attach),
    },
    invoicePaymentLedgerEntry: {
      create: async ({ data }) => {
        if (data.reversesEntryId && state.ledger.some((entry) => entry.reversesEntryId === data.reversesEntryId)) throw Object.assign(new Error("duplicate reversal"), { code: "P2002" });
        const entry = { id: nextLedgerId++, transactionId: `ledger-${nextLedgerId}`, status: "POSTED", postedAt: new Date(), ...data };
        state.ledger.push(entry);
        return entry;
      },
      findFirst: async ({ where }) => state.ledger.find((entry) => entry.paymentId === where.paymentId && entry.entryType === where.entryType) || null,
      findMany: async () => state.ledger,
      aggregate: async () => ({ _sum: { signedAmount: state.ledger.reduce((sum, entry) => sum + Number(entry.signedAmount), 0).toFixed(2) } }),
    },
    paymentIdempotencyClaim: {
      create: async ({ data }) => {
        if (state.claims.some((claim) => claim.organizationId === data.organizationId && claim.operation === data.operation && claim.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error("duplicate claim"), { code: "P2002" });
        const claim = { id: nextClaimId++, ...data, completedAt: null, responseSnapshot: null };
        state.claims.push(claim);
        return claim;
      },
      update: async ({ where, data }) => { const claim = state.claims.find((entry) => entry.id === where.id); Object.assign(claim, data); return claim; },
      findUnique: async ({ where }) => state.claims.find((claim) => {
        const key = where.organizationId_operation_idempotencyKey;
        return claim.organizationId === key.organizationId && claim.operation === key.operation && claim.idempotencyKey === key.idempotencyKey;
      }) || null,
    },
    accountingEntry: {
      findFirst: async () => state.accounting,
      create: async ({ data }) => { state.accounting = { id: 1, ...data }; return state.accounting; },
      update: async ({ data }) => { state.accounting = { ...state.accounting, ...data }; return state.accounting; },
    },
    auditLog: { create: async ({ data }) => { state.audit.push(data); return data; } },
  };
  const prisma = {
    ...tx,
    $transaction: async (callback) => callback(tx),
  };
  return { prisma, state };
};

const handlersFor = (prisma) => createInvoicePaymentHandlers({
  prisma,
  isGlobalAdmin: () => false,
  serializeInvoice: (invoice) => ({ ...invoice, total: Number(invoice.total), paidAmount: Number(invoice.paidAmount) }),
});

test("payment fingerprints are canonical and provider references are scoped", () => {
  assert.equal(fingerprintPaymentRequest({ b: 2, a: 1 }), fingerprintPaymentRequest({ a: 1, b: 2 }));
  assert.equal(buildExternalReferenceKey({ method: "MOBILE_MONEY", provider: "MTN MoMo", externalReference: " ABC 123 " }), "MOBILE_MONEY:mtn-momo:abc123");
});

test("recording a payment creates a pending workflow record without settling the invoice", async () => {
  const { prisma, state } = buildPrisma();
  const res = createResponse();
  await handlersFor(prisma).record(request({ params: { id: "10" }, body: { amount: "25.00", currency: "GHS", method: "MOBILE_MONEY", provider: "MTN", externalReference: "TX-1", paidAt: "2026-10-18" } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.payment.verificationStatus, "PENDING_VERIFICATION");
  assert.equal(state.invoice.paidAmount, "0.00");
  assert.equal(state.ledger.length, 0);
});

test("identical retries return the original pending payment and do not create duplicates", async () => {
  const { prisma, state } = buildPrisma();
  const handler = handlersFor(prisma).record;
  const input = { params: { id: "10" }, body: { amount: "25.00", currency: "GHS", method: "BANK_TRANSFER", externalReference: "BANK-1", paidAt: "2026-10-18" } };
  await handler(request(input), createResponse());
  const replay = createResponse();
  await handler(request(input), replay);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.body.idempotentReplay, true);
  assert.equal(state.payments.length, 1);
});

test("verification posts once and a compensating reversal restores the invoice balance", async () => {
  const { prisma, state } = buildPrisma();
  const handlers = handlersFor(prisma);
  const recorded = createResponse();
  await handlers.record(request({ params: { id: "10" }, body: { amount: "25.00", method: "CASH", paidAt: "2026-10-18" } }), recorded);
  const paymentId = recorded.body.payment.id;
  const verified = createResponse();
  await handlers.verify(request({ params: { id: "10", paymentId: String(paymentId) }, userId: 2, key: "verify-key-123" }), verified);
  assert.equal(verified.statusCode, 200);
  assert.equal(state.invoice.paidAmount, "25.00");
  assert.equal(state.ledger[0].entryType, "PAYMENT");
  const reversed = createResponse();
  await handlers.reverse(request({ params: { id: "10", paymentId: String(paymentId) }, userId: 3, key: "reverse-key-123", body: { reason: "Bank confirmed the receipt was invalid." } }), reversed);
  assert.equal(reversed.statusCode, 200);
  assert.equal(state.invoice.paidAmount, "0.00");
  assert.equal(state.ledger[1].entryType, "REVERSAL");
  assert.equal(state.ledger[1].signedAmount, "-25.00");
  assert.equal(state.payments[0].verificationStatus, "REVERSED");
});

test("the recorder cannot verify a manual payment without an authorized override", async () => {
  const { prisma } = buildPrisma();
  const handlers = handlersFor(prisma);
  const recorded = createResponse();
  await handlers.record(request({ params: { id: "10" }, body: { amount: "10.00", method: "CASH" } }), recorded);
  const res = createResponse();
  await handlers.verify(request({ params: { id: "10", paymentId: String(recorded.body.payment.id) }, key: "verify-self-123" }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "SEGREGATION_OF_DUTIES");
});

test("the payment migration is additive, constrained, and protects posted ledger entries", async () => {
  const migration = await readFile(new URL("../../prisma/migrations/20261018090000_add_immutable_invoice_payment_ledger/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE "InvoicePayment"/);
  assert.match(migration, /CREATE TABLE "InvoicePaymentLedgerEntry"/);
  assert.match(migration, /PaymentIdempotencyClaim_organizationId_operation_idempotencyKey_key/);
  assert.match(migration, /InvoicePayment_organizationId_externalReferenceKey_key/);
  assert.match(migration, /FOR UPDATE|immutable/i);
  assert.match(migration, /InvoicePaymentLedgerEntry_no_update/);
  assert.match(migration, /InvoicePaymentLedgerEntry_no_delete/);
  assert.doesNotMatch(migration, /UPDATE "Invoice" SET|DELETE FROM "Invoice"|TRUNCATE/i);
});
