import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildReceiptPdf,
  calculateInvoicePaymentAmountMinor,
  createPaystackPaymentHandlers,
  registerPaystackPaymentRoutes,
  resolvePaystackRuntimeConfig,
} from "./paystackPayments.js";

const response = () => ({
  statusCode: 200,
  payload: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  setHeader(name, value) { this.headers[name] = value; },
  send(payload) { this.payload = payload; return this; },
});

test("Paystack stays disabled until a matching safe test configuration is explicit", () => {
  const disabled = resolvePaystackRuntimeConfig({
    PAYSTACK_SECRET_KEY: "sk_test_example",
    PAYSTACK_CALLBACK_URL: "https://dev.example.com/payment/status",
    PAYSTACK_CURRENCY: "GHS",
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.configured, true);

  const mismatch = resolvePaystackRuntimeConfig({
    PAYSTACK_PAYMENTS_ENABLED: "true",
    PAYSTACK_MODE: "live",
    PAYSTACK_SECRET_KEY: "sk_test_example",
    PAYSTACK_CALLBACK_URL: "http://dev.example.com/payment/status",
    PAYSTACK_CURRENCY: "USD",
  });
  assert.equal(mismatch.enabled, true);
  assert.equal(mismatch.configured, false);
  assert.equal(mismatch.configurationErrors.length, 3);
});

test("invoice collection modes calculate exact minor-unit amounts", () => {
  assert.equal(calculateInvoicePaymentAmountMinor({ mode: "FULL", totalMinor: 10005, balanceMinor: 8005 }), 8005);
  assert.equal(calculateInvoicePaymentAmountMinor({ mode: "DEPOSIT_PERCENT", totalMinor: 10005, balanceMinor: 10005, percentage: "12.5" }), 1251);
  assert.equal(calculateInvoicePaymentAmountMinor({ mode: "DEPOSIT_FIXED", totalMinor: 10005, balanceMinor: 10005, amount: "10.05" }), 1005);
  assert.throws(
    () => calculateInvoicePaymentAmountMinor({ mode: "DEPOSIT_PERCENT", totalMinor: 10005, balanceMinor: 10005, percentage: "0" }),
    /greater than 0/,
  );
});

test("standalone payment creation is tenant scoped and stores minor units", async () => {
  let createData;
  let stored;
  let transactions = 0;
  const prisma = {
    standalonePayment: { findUnique: async () => stored || null },
    $transaction: async (work) => { transactions += 1; return work({
      standalonePayment: {
        create: async ({ data }) => {
          createData = data;
          stored = { id: 7, ...data, receivedMinor: 0, status: "DRAFT", canceledAt: null, reconciledInvoiceId: null, reconciledAt: null, createdAt: new Date(), updatedAt: new Date() };
          return stored;
        },
      },
      auditLog: { create: async ({ data }) => data },
    }); },
  };
  const handlers = createPaystackPaymentHandlers({
    prisma,
    isGlobalAdmin: () => false,
    env: {},
  });
  const res = response();
  await handlers.createStandalone({
    body: { customerName: "Client", customerEmail: "CLIENT@example.com", amount: "125.50", description: "Discovery workshop" },
    headers: { "idempotency-key": "standalone-test-key" },
    header: (name) => name.toLowerCase() === "idempotency-key" ? "standalone-test-key" : "",
    user: { organizationId: 42, userId: 9, email: "admin@example.com" },
    requestId: "req-test",
    ip: "127.0.0.1",
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(createData.organizationId, 42);
  assert.equal(createData.expectedMinor, 12550);
  assert.equal(createData.customerEmail, "client@example.com");
  assert.equal(createData.creationKey, "standalone-test-key");
  const replay = response();
  await handlers.createStandalone({
    body: { customerName: "Client", customerEmail: "CLIENT@example.com", amount: "125.50", description: "Discovery workshop" },
    headers: { "idempotency-key": "standalone-test-key" },
    header: (name) => name.toLowerCase() === "idempotency-key" ? "standalone-test-key" : "",
    user: { organizationId: 42, userId: 9, email: "admin@example.com" },
  }, replay);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.payload.idempotentReplay, true);
  assert.equal(transactions, 1);
});

test("initialization fails closed when payments are disabled", async () => {
  const handlers = createPaystackPaymentHandlers({ prisma: {}, isGlobalAdmin: () => false, env: {} });
  const res = response();
  await handlers.initializeInvoice({ params: { id: "1" }, body: {}, user: { organizationId: 1 } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, "PAYMENTS_DISABLED");
});

test("webhook rejects requests without a verified raw-body signature", async () => {
  const handlers = createPaystackPaymentHandlers({
    prisma: {},
    isGlobalAdmin: () => false,
    env: {
      PAYSTACK_PAYMENTS_ENABLED: "true",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_secret",
      PAYSTACK_CALLBACK_URL: "https://dev.example.com/payment/status",
      PAYSTACK_CURRENCY: "GHS",
    },
    gateway: {},
  });
  const res = response();
  await handlers.webhook({ rawBody: Buffer.from("{}"), body: {}, header: () => "invalid" }, res);
  assert.equal(res.statusCode, 401);
});

test("route registration keeps public return and webhook routes unauthenticated", () => {
  const routes = [];
  const app = {
    get(path, ...handlers) { routes.push({ method: "GET", path, handlers }); },
    post(path, ...handlers) { routes.push({ method: "POST", path, handlers }); },
  };
  const authMiddleware = () => {};
  const requireAdmin = () => {};
  registerPaystackPaymentRoutes(app, {
    prisma: {},
    isGlobalAdmin: () => false,
    env: {},
    authMiddleware,
    requireAdmin,
  });
  assert.equal(routes.find((route) => route.path === "/api/webhooks/paystack").handlers.length, 1);
  assert.equal(routes.find((route) => route.path === "/api/public/payments/status/:token").handlers.length, 1);
  assert.equal(routes.find((route) => route.path === "/api/payments/requests").handlers[0], authMiddleware);
});

test("payment-link email delivery is idempotent and does not resend on replay", async () => {
  let delivery = null;
  let sends = 0;
  const prisma = {
    paymentIntent: {
      findFirst: async () => ({
        id: 12,
        organizationId: 4,
        customerName: "Client",
        customerEmail: "client@example.com",
        amountMinor: 12500,
        checkoutUrl: "https://checkout.paystack.com/example",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 60_000),
        invoice: { invoiceNumber: "INV-12" },
        standalonePayment: null,
      }),
      update: async ({ data }) => data,
    },
    paymentLinkDelivery: {
      findUnique: async () => delivery,
      create: async ({ data }) => {
        delivery = { id: 8, status: "NOT_SENT", sentAt: null, ...data };
        return delivery;
      },
      update: async ({ data }) => {
        delivery = { ...delivery, ...data };
        return delivery;
      },
    },
    auditLog: { create: async ({ data }) => data },
    $transaction: async (operations) => Promise.all(operations),
  };
  const handlers = createPaystackPaymentHandlers({
    prisma,
    isGlobalAdmin: () => false,
    env: {
      PAYSTACK_PAYMENTS_ENABLED: "true",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_secret",
      PAYSTACK_CALLBACK_URL: "https://dev.example.com/payment/status",
      PAYSTACK_CURRENCY: "GHS",
      PAYMENT_EMAIL_FROM: "payments@example.com",
    },
    sendEmail: async () => { sends += 1; },
  });
  const req = {
    params: { id: "12" },
    body: { recipient: "client@example.com", message: "Thank you" },
    headers: { "idempotency-key": "payment-link-email-12" },
    header: (name) => name.toLowerCase() === "idempotency-key" ? "payment-link-email-12" : "",
    user: { organizationId: 4, userId: 2, email: "admin@example.com" },
    requestId: "req-link",
  };
  const first = response();
  await handlers.sendLink(req, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.payload.idempotentReplay, false);
  assert.equal(sends, 1);

  const replay = response();
  await handlers.sendLink(req, replay);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.payload.idempotentReplay, true);
  assert.equal(sends, 1);
});

test("receipt PDFs are generated from immutable settlement snapshots", () => {
  const pdf = buildReceiptPdf({
    businessName: "Faako",
    customerName: "Client",
    paymentDate: "2026-10-23T10:00:00.000Z",
    amount: "100.00",
    currency: "GHS",
    paymentMethod: "mobile_money",
    providerReference: "DEV-PAY-reference",
    remainingAmount: "0.00",
  }, "RCP-20261023-000001");
  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});

test("Paystack persistence migration is additive and keeps existing financial tables", async () => {
  const migration = await readFile(
    new URL("../../prisma/migrations/20261022130000_add_paystack_payment_collection/migration.sql", import.meta.url),
    "utf8",
  );
  for (const table of ["StandalonePayment", "PaymentIntent", "PaymentLinkDelivery", "PaymentProviderEvent", "PaymentReceipt"]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(migration, /PaymentIntent_providerTransactionId_key/);
  assert.match(migration, /StandalonePayment_amounts_check/);
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN)/i);
  assert.doesNotMatch(migration, /UPDATE\s+"(?:Invoice|InvoicePayment|InvoicePaymentLedgerEntry)"/i);
});
