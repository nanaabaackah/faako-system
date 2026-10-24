import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import prismaPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createPaystackPaymentHandlers } from "./paystackPayments.js";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DEV_ERP_TEST_DATABASE_URL || "";
const assertDisposable = (value) => {
  if (!value) return false;
  const url = new URL(value);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !/(?:^|[_-])(test|tmp|disposable)(?:$|[_-])/i.test(databaseName)) {
    throw new Error("DEV_ERP_TEST_DATABASE_URL must identify a disposable loopback test database.");
  }
  if ([process.env.DATABASE_URL, process.env.DATABASE_URL_PRODUCTION].filter(Boolean).includes(value)) {
    throw new Error("Refusing to use a configured production/default database.");
  }
  return true;
};

const enabled = assertDisposable(databaseUrl);
const env = {
  PAYSTACK_PAYMENTS_ENABLED: "true",
  PAYSTACK_MODE: "test",
  PAYSTACK_SECRET_KEY: "sk_test_disposable_secret",
  PAYSTACK_CALLBACK_URL: "https://dev.example.com/payment/status",
  PAYSTACK_CURRENCY: "GHS",
};
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const webhookRequest = (body) => {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return { rawBody, body, header: (name) => name === "x-paystack-signature" ? signature : "", requestId: `test-${Date.now()}` };
};

test("Paystack settlement is idempotent and preserves standalone/invoice boundaries", { skip: !enabled, timeout: 120_000 }, async (t) => {
  for (let run = 0; run < 2; run += 1) {
    await execFileAsync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: new URL("../../", import.meta.url),
      env: { ...process.env, APP_ENV: "test", DATABASE_URL: databaseUrl, DATABASE_URL_DEVELOPMENT: "", DATABASE_URL_PRODUCTION: "" },
    });
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new prismaPkg.PrismaClient({ adapter: new PrismaPg(pool) });
  t.after(async () => { await prisma.$disconnect(); await pool.end(); });

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organization = await prisma.organization.create({ data: { name: `Paystack ${suffix}`, slug: `paystack-${suffix}` } });
  const role = await prisma.role.create({ data: { organizationId: organization.id, name: `Admin ${suffix}` } });
  const user = await prisma.user.create({ data: { organizationId: organization.id, roleId: role.id, firstName: "Paystack", lastName: "Tester", fullName: "Paystack Tester", email: `paystack-${suffix}@example.invalid`, password: "not-a-password" } });
  const invoice = await prisma.invoice.create({ data: { organizationId: organization.id, invoiceNumber: `PS-${suffix}`, status: "SENT", currency: "GHS", issueDate: new Date(), clientName: "Test Client", clientEmail: "client@example.invalid", subtotal: "100.00", taxRate: "0.00", taxAmount: "0.00", discount: "0.00", total: "100.00", paidAmount: "0.00" } });
  const invoiceIntent = await prisma.paymentIntent.create({ data: { organizationId: organization.id, type: "INVOICE", invoiceId: invoice.id, customerName: invoice.clientName, customerEmail: invoice.clientEmail, amountMinor: 4000, currency: "GHS", providerReference: `DEV-INV-${suffix}`.replace(/[^A-Za-z0-9._=-]/g, ""), publicTokenHash: crypto.randomBytes(32).toString("hex"), initializationKey: `invoice-${suffix}`, requestFingerprint: "test", status: "PENDING", createdByUserId: user.id } });

  const settlements = new Map([[invoiceIntent.providerReference, { reference: invoiceIntent.providerReference, status: "success", amountPesewas: 4000, currency: "GHS", paidAt: new Date().toISOString(), transactionId: `txn-${suffix}`, channel: "mobile_money", customerEmail: invoiceIntent.customerEmail, domain: "test" }]]);
  const handlers = createPaystackPaymentHandlers({ prisma, isGlobalAdmin: () => false, env, gateway: { verify: async (reference) => settlements.get(reference) } });
  const event = { event: "charge.success", data: { reference: invoiceIntent.providerReference } };
  const webhookResponses = [response(), response()];
  await Promise.all(webhookResponses.map((res) => handlers.webhook(webhookRequest(event), res)));
  assert.deepEqual(webhookResponses.map((res) => res.statusCode), [200, 200]);
  assert.equal(await prisma.invoicePayment.count({ where: { invoiceId: invoice.id } }), 1);
  assert.equal(await prisma.invoicePaymentLedgerEntry.count({ where: { invoiceId: invoice.id, entryType: "PAYMENT" } }), 1);
  assert.equal(await prisma.paymentReceipt.count({ where: { paymentIntentId: invoiceIntent.id } }), 1);
  assert.equal(Number((await prisma.invoice.findUnique({ where: { id: invoice.id } })).paidAmount), 40);

  const standalone = await prisma.standalonePayment.create({ data: { organizationId: organization.id, customerName: "Standalone Client", customerEmail: "standalone@example.invalid", description: "Standalone collection", creationKey: `standalone-create-${suffix}`, requestFingerprint: "test", expectedMinor: 5000, createdByUserId: user.id } });
  const standaloneIntent = await prisma.paymentIntent.create({ data: { organizationId: organization.id, type: "STANDALONE", standalonePaymentId: standalone.id, customerName: standalone.customerName, customerEmail: standalone.customerEmail, amountMinor: 2500, currency: "GHS", providerReference: `DEV-PAY-${suffix}`.replace(/[^A-Za-z0-9._=-]/g, ""), publicTokenHash: crypto.randomBytes(32).toString("hex"), initializationKey: `standalone-${suffix}`, requestFingerprint: "test", status: "PENDING", createdByUserId: user.id } });
  settlements.set(standaloneIntent.providerReference, { reference: standaloneIntent.providerReference, status: "success", amountPesewas: 2500, currency: "GHS", paidAt: new Date().toISOString(), transactionId: `txn-standalone-${suffix}`, channel: "card", customerEmail: standaloneIntent.customerEmail, domain: "test" });
  const standaloneResponse = response();
  await handlers.webhook(webhookRequest({ event: "charge.success", data: { reference: standaloneIntent.providerReference } }), standaloneResponse);
  assert.equal(standaloneResponse.statusCode, 200);
  assert.equal((await prisma.standalonePayment.findUnique({ where: { id: standalone.id } })).status, "PARTIALLY_PAID");
  assert.equal(await prisma.invoicePayment.count({ where: { externalReference: standaloneIntent.providerReference } }), 0);
  assert.equal(await prisma.accountingEntry.count({ where: { sourceRef: { contains: String(standalone.id) } } }), 0);

  const mismatchIntent = await prisma.paymentIntent.create({ data: { organizationId: organization.id, type: "INVOICE", invoiceId: invoice.id, customerName: invoice.clientName, customerEmail: invoice.clientEmail, amountMinor: 1000, currency: "GHS", providerReference: `DEV-BAD-${suffix}`.replace(/[^A-Za-z0-9._=-]/g, ""), publicTokenHash: crypto.randomBytes(32).toString("hex"), initializationKey: `mismatch-${suffix}`, requestFingerprint: "test", status: "PENDING", createdByUserId: user.id } });
  settlements.set(mismatchIntent.providerReference, { reference: mismatchIntent.providerReference, status: "success", amountPesewas: 999, currency: "GHS", paidAt: new Date().toISOString(), transactionId: `txn-mismatch-${suffix}`, channel: "card", customerEmail: mismatchIntent.customerEmail, domain: "test" });
  const mismatchResponse = response();
  await handlers.webhook(webhookRequest({ event: "charge.success", data: { reference: mismatchIntent.providerReference } }), mismatchResponse);
  assert.equal(mismatchResponse.statusCode, 200);
  assert.equal(mismatchResponse.body.reconciliationRequired, true);
  assert.equal(await prisma.invoicePayment.count({ where: { externalReference: mismatchIntent.providerReference } }), 0);
});
