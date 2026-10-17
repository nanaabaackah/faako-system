import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import prismaPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { createInvoicePaymentHandlers } from "./paymentLedger.js";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DEV_ERP_TEST_DATABASE_URL || "";

const assertDisposableDatabase = (value) => {
  if (!value) return false;
  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (!loopback || !/(?:^|[_-])(test|tmp|disposable)(?:$|[_-])/i.test(databaseName)) {
    throw new Error("DEV_ERP_TEST_DATABASE_URL must identify a disposable loopback test database.");
  }
  if ([process.env.DATABASE_URL_PRODUCTION, process.env.DATABASE_URL].filter(Boolean).includes(value)) {
    throw new Error("Refusing to use a configured production/default database for payment integration tests.");
  }
  return true;
};

const enabled = assertDisposableDatabase(databaseUrl);
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = ({ invoiceId, paymentId, userId, organizationId, key, body = {} }) => ({
  params: { id: String(invoiceId), ...(paymentId ? { paymentId: String(paymentId) } : {}) },
  body,
  headers: { "idempotency-key": key, "x-request-id": key },
  user: { userId, organizationId, fullName: `Test User ${userId}`, email: `test-${userId}@example.invalid`, roleName: "Admin" },
  ip: "127.0.0.1",
});

test("payment migrations and concurrency invariants hold on disposable PostgreSQL", { skip: !enabled, timeout: 120_000 }, async (t) => {
  const migrationRuns = [];
  for (let run = 1; run <= 2; run += 1) {
    const started = performance.now();
    await execFileAsync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: new URL("../../", import.meta.url),
      env: { ...process.env, APP_ENV: "test", DATABASE_URL: databaseUrl, DATABASE_URL_DEVELOPMENT: "", DATABASE_URL_PRODUCTION: "" },
    });
    migrationRuns.push(Math.round(performance.now() - started));
  }
  t.diagnostic(`Migration deploy durations: ${migrationRuns.join("ms, ")}ms; second execution verified idempotency.`);

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new prismaPkg.PrismaClient({ adapter: new PrismaPg(pool) });
  t.after(async () => { await prisma.$disconnect(); await pool.end(); });

  const integrity = await pool.query(`
    SELECT
      to_regclass('public."InvoicePayment"') AS payment_table,
      to_regclass('public."InvoicePaymentLedgerEntry"') AS ledger_table,
      to_regclass('public."PaymentIdempotencyClaim"') AS claim_table,
      (SELECT count(*)::int FROM pg_constraint WHERE conrelid = '"InvoicePaymentLedgerEntry"'::regclass AND contype = 'f') AS ledger_foreign_keys,
      (SELECT count(*)::int FROM pg_indexes WHERE tablename IN ('InvoicePayment', 'InvoicePaymentLedgerEntry', 'PaymentIdempotencyClaim')) AS payment_indexes
  `);
  assert.ok(integrity.rows[0].payment_table);
  assert.ok(integrity.rows[0].ledger_table);
  assert.ok(integrity.rows[0].claim_table);
  assert.ok(integrity.rows[0].ledger_foreign_keys >= 4);
  assert.ok(integrity.rows[0].payment_indexes >= 10);

  const recoveryClient = await pool.connect();
  try {
    await recoveryClient.query("BEGIN");
    await recoveryClient.query('CREATE TABLE "Phase6FailedMigrationProbe" ("id" INTEGER PRIMARY KEY)');
    await assert.rejects(recoveryClient.query("SELECT 1 / 0"));
    await recoveryClient.query("ROLLBACK");
  } finally {
    recoveryClient.release();
  }
  const recovery = await pool.query(`SELECT to_regclass('public."Phase6FailedMigrationProbe"') AS probe`);
  assert.equal(recovery.rows[0].probe, null);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organization = await prisma.organization.create({ data: { name: `Payment Test ${suffix}`, slug: `payment-test-${suffix}` } });
  const otherOrganization = await prisma.organization.create({ data: { name: `Other Payment Test ${suffix}`, slug: `other-payment-test-${suffix}` } });
  const role = await prisma.role.create({ data: { organizationId: organization.id, name: `Admin ${suffix}` } });
  const users = await Promise.all([1, 2, 3].map((number) => prisma.user.create({ data: {
    organizationId: organization.id, roleId: role.id, firstName: "Test", lastName: String(number), fullName: `Test User ${number}`,
    email: `payment-${suffix}-${number}@example.invalid`, password: "not-a-real-password",
  } })));
  const invoice = await prisma.invoice.create({ data: {
    organizationId: organization.id, invoiceNumber: `INV-${suffix}`, status: "SENT", currency: "GHS", issueDate: new Date(),
    clientName: "Sanitized Test Client", subtotal: "100.00", taxRate: "0.00", taxAmount: "0.00", discount: "0.00", total: "100.00", paidAmount: "0.00",
  } });
  const legacyInvoice = await prisma.invoice.create({ data: {
    organizationId: organization.id, invoiceNumber: `LEGACY-${suffix}`, status: "SENT", currency: "GHS", issueDate: new Date(),
    clientName: "Sanitized Legacy Client", subtotal: "50.00", taxRate: "0.00", taxAmount: "0.00", discount: "0.00", total: "50.00", paidAmount: "15.00",
  } });
  assert.equal((await prisma.invoice.findUnique({ where: { id: legacyInvoice.id } })).legacyPaidAmount, null);
  assert.equal(await prisma.invoicePayment.count({ where: { invoiceId: legacyInvoice.id } }), 0);
  const serializeInvoice = (value) => ({ id: value.id, invoiceNumber: value.invoiceNumber, status: value.status, currency: value.currency, total: Number(value.total), paidAmount: Number(value.paidAmount) });
  const handlers = createInvoicePaymentHandlers({ prisma, isGlobalAdmin: () => false, serializeInvoice });

  const recordRequest = request({ invoiceId: invoice.id, userId: users[0].id, organizationId: organization.id, key: `record-${suffix}`, body: { amount: "40.00", currency: "GHS", method: "MOBILE_MONEY", provider: "MTN", externalReference: `MOMO-${suffix}`, paidAt: "2026-10-18" } });
  const recordResponses = [response(), response()];
  await Promise.all(recordResponses.map((res) => handlers.record(recordRequest, res)));
  assert.deepEqual(recordResponses.map((res) => res.statusCode).sort(), [200, 201]);
  assert.equal(await prisma.invoicePayment.count({ where: { invoiceId: invoice.id } }), 1);
  const paymentId = recordResponses[0].body.payment.id;

  const conflicting = response();
  await handlers.record({ ...recordRequest, body: { ...recordRequest.body, amount: "41.00" } }, conflicting);
  assert.equal(conflicting.statusCode, 409);
  assert.equal(conflicting.body.code, "IDEMPOTENCY_CONFLICT");

  const verifyRequest = request({ invoiceId: invoice.id, paymentId, userId: users[1].id, organizationId: organization.id, key: `verify-${suffix}` });
  const verifyResponses = [response(), response()];
  await Promise.all(verifyResponses.map((res) => handlers.verify(verifyRequest, res)));
  assert.deepEqual(verifyResponses.map((res) => res.statusCode).sort(), [200, 200]);
  assert.equal(await prisma.invoicePaymentLedgerEntry.count({ where: { paymentId, entryType: "PAYMENT" } }), 1);
  assert.equal(Number((await prisma.invoice.findUnique({ where: { id: invoice.id } })).paidAmount), 40);

  const reverseRequest = request({ invoiceId: invoice.id, paymentId, userId: users[2].id, organizationId: organization.id, key: `reverse-${suffix}`, body: { reason: "Disposable concurrency test reversal" } });
  const reverseResponses = [response(), response()];
  await Promise.all(reverseResponses.map((res) => handlers.reverse(reverseRequest, res)));
  assert.deepEqual(reverseResponses.map((res) => res.statusCode).sort(), [200, 200]);
  assert.equal(await prisma.invoicePaymentLedgerEntry.count({ where: { paymentId, entryType: "REVERSAL" } }), 1);
  assert.equal(Number((await prisma.invoice.findUnique({ where: { id: invoice.id } })).paidAmount), 0);

  const failedAdjustment = response();
  await handlers.adjust(request({ invoiceId: invoice.id, userId: users[2].id, organizationId: organization.id, key: `bad-adjust-${suffix}`, body: { entryType: "RECONCILIATION_ADJUSTMENT", signedAmount: "101.00", reason: "Must roll back" } }), failedAdjustment);
  assert.equal(failedAdjustment.statusCode, 409);
  assert.equal(await prisma.invoicePaymentLedgerEntry.count({ where: { invoiceId: invoice.id, entryType: "RECONCILIATION_ADJUSTMENT" } }), 0);

  const crossTenant = response();
  await handlers.list(request({ invoiceId: invoice.id, userId: users[2].id, organizationId: otherOrganization.id, key: "unused-key" }), crossTenant);
  assert.equal(crossTenant.statusCode, 404);

  const posted = await prisma.invoicePaymentLedgerEntry.findFirstOrThrow({ where: { paymentId, entryType: "PAYMENT" } });
  await assert.rejects(prisma.invoicePaymentLedgerEntry.update({ where: { id: posted.id }, data: { reason: "mutation attempt" } }), /immutable/i);
  await assert.rejects(prisma.invoicePaymentLedgerEntry.delete({ where: { id: posted.id } }), /immutable/i);
});
