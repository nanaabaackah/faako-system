import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";

// Use an audit stub. These tests never connect to a local or production database.
const correctionUrl = new URL("./paymentCorrections.js", import.meta.url).href;
const settlementUrl = new URL("./settlement.js", import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([correctionUrl, settlementUrl].includes(context.parentURL) && specifier.endsWith("/auditLog.js")) {
    return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  }
  return next(specifier, context);
} });
const { correctManualWaterPayment, reconcileLegacyWaterPayment } = await import(correctionUrl);
after(() => hooks.deregister());

const base = {
  organizationId: 7, productKey: "gwater-15pk", saleId: 3, paymentId: 19,
  actorId: 1, actor: { userId: 1 }, idempotencyKey: "water-correction-001",
  reason: "The originally recorded payment was incorrect.",
};
const sale = { id: 3, organizationId: 7, productKey: "gwater-15pk", totalAmount: 6000,
  customerId: 2, paymentStatus: "paid" };
const manual = { id: 19, organizationId: 7, amountCents: 6000, appliedAmountCents: 6000,
  applicationId: 31, applicationStatus: "APPLIED", source: "MANUAL",
  provider: "MANUAL_WATER", verificationStatus: "MANUAL", attemptId: null,
  supersededAt: null };

const fixture = ({ receipt = manual, applicationRows = [{ id: 31, payableId: 3, status: "APPLIED" }],
  priorSale = sale, applicationCount = 1 } = {}) => {
  const calls = [];
  const client = { async query(statement, params = []) {
    calls.push({ statement, params });
    if (statement.startsWith('SELECT * FROM "waterSale"')) return { rows: [{ ...priorSale }] };
    if (statement.includes('FROM "paymentRecord" pr JOIN "paymentApplication" pa')) {
      return { rows: receipt ? [{ ...receipt }] : [] };
    }
    if (statement.includes('FROM "paymentApplication"') && statement.includes('ORDER BY id FOR UPDATE')) {
      return { rows: applicationRows };
    }
    if (statement.includes('COUNT(*)::int AS "applicationCount"')) {
      return { rows: [{ amountPaidCents: 0, applicationCount, lastPaidAt: null }] };
    }
    if (statement.startsWith('UPDATE "paymentApplication"') || statement.startsWith('UPDATE "paymentRecord"')
      || statement.startsWith('UPDATE "waterSale"')) return { rows: [], rowCount: 1 };
    if (statement.startsWith('INSERT INTO "waterPaymentCorrection"')) return { rows: [{ id: 91 }], rowCount: 1 };
    assert.fail("Unexpected database statement: " + statement);
  } };
  return { client, calls };
};

test("Correction requires an explanation and cannot silently change a paid receipt", async () => {
  const f = fixture();
  await assert.rejects(correctManualWaterPayment(f.client, { ...base, mode: "reverse", reason: "no" }),
    { code: "WATER_CORRECTION_REASON_REQUIRED" });
  assert.equal(f.calls.length, 0);
});

test("Only manual Water receipts are correctable: provider-verified entries remain protected", async () => {
  for (const property of [
    { source: "ONLINE_PROVIDER" }, { verificationStatus: "VERIFIED" },
    { provider: "PAYSTACK" }, { attemptId: 11 },
  ]) {
    const f = fixture({ receipt: { ...manual, ...property } });
    await assert.rejects(correctManualWaterPayment(f.client, { ...base, mode: "reverse" }),
      { code: "WATER_PROVIDER_CORRECTION_BLOCKED" });
    assert.equal(f.calls.some(({ statement }) => statement.startsWith('UPDATE ')), false);
  }
});

test("Previously corrected entries and credits used on other Water orders cannot be reversed", async () => {
  const old = fixture({ receipt: { ...manual, supersededAt: new Date().toISOString() } });
  await assert.rejects(correctManualWaterPayment(old.client, { ...base, mode: "reverse" }),
    { code: "WATER_COLLECTION_ALREADY_CORRECTED" });
  const used = fixture({ applicationRows: [
    { id: 31, payableId: 3, status: "APPLIED" },
    { id: 33, payableId: 8, status: "APPLIED" },
  ] });
  await assert.rejects(correctManualWaterPayment(used.client, { ...base, mode: "reverse" }),
    { code: "WATER_CREDIT_ALREADY_USED" });
  assert.equal(used.calls.some(({ statement }) => statement.startsWith('UPDATE ')), false);
});

test("Reversal retains the original receipt, reverses only its application and audits the change", async () => {
  const f = fixture();
  const result = await correctManualWaterPayment(f.client, { ...base, mode: "reverse" });
  assert.deepEqual(result, { originalPaymentId: 19, replacementPaymentId: null });
  assert.equal(f.calls.filter(({ statement }) => statement.startsWith('UPDATE "paymentApplication"')).length, 1);
  assert.equal(f.calls.filter(({ statement }) => statement.startsWith('UPDATE "paymentRecord"')).length, 1);
  assert.equal(f.calls.filter(({ statement }) => statement.startsWith('INSERT INTO "waterPaymentCorrection"')).length, 1);
  const audit = f.calls.find(({ statement }) => statement.startsWith('INSERT INTO "waterPaymentCorrection"'));
  assert.equal(audit.params[5], "REVERSED");
  assert.equal(audit.params[3], 19);
  assert.equal(audit.params[4], null);
  assert.equal(f.calls.some(({ statement }) => /(?:UPDATE|DELETE) "orderPayment"/.test(statement)), false);
});

test("Legacy paid status can be corrected to unpaid without fabricating a receipt", async () => {
  const f = fixture({ applicationCount: 0 });
  const result = await reconcileLegacyWaterPayment(f.client, { ...base, mode: "unpaid" });
  assert.deepEqual(result, { replacementPaymentId: null });
  assert.equal(f.calls.some(({ statement }) => statement.includes('SET "paymentStatus" = \'unpaid\'')), true);
  assert.equal(f.calls.some(({ statement }) => statement.startsWith('INSERT INTO "paymentRecord"')), false);
  const entry = f.calls.find(({ statement }) => statement.startsWith('INSERT INTO "waterPaymentCorrection"'));
  assert.equal(entry.params[5], "LEGACY_UNPAID");
});

test("Legacy reconciliation does not overwrite verified collection history", async () => {
  const f = fixture({ applicationCount: 1 });
  await assert.rejects(reconcileLegacyWaterPayment(f.client, { ...base, mode: "unpaid" }),
    { code: "WATER_LEGACY_RECONCILIATION_NOT_NEEDED" });
  assert.equal(f.calls.some(({ statement }) => statement.startsWith('UPDATE ')), false);
});
