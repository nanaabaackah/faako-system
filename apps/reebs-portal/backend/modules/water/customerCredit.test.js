import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith("/auditLog.js")) return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  return next(specifier, context);
} });
const { recordWaterCollection } = await import("./settlement.js");
const { applyWaterCustomerCredit, loadWaterCustomerCredit } = await import("./customerCredit.js");
after(() => hooks.deregister());

const input = { organizationId: 7, saleId: 1, productKey: "gwater-15pk", amountCents: 15000,
  method: "cash", paidAt: "2026-07-01", idempotencyKey: "water-credit-test-001", retainCustomerCredit: true };
function fixture(customerId = 2) {
  const sales = [
    { id: 1, organizationId: 7, customerId, productKey: "gwater-15pk", totalAmount: 10000, paymentStatus: "unpaid" },
    { id: 2, organizationId: 7, customerId, productKey: "sachet-water-30pk", totalAmount: 3000, paymentStatus: "unpaid" },
    { id: 3, organizationId: 7, customerId, productKey: "gwater-15pk", totalAmount: 4000, paymentStatus: "unpaid" },
  ];
  const payments = [], applications = [], calls = [];
  const client = { async query(sql, values = []) {
    calls.push({ sql, values });
    if (sql.includes("pg_advisory")) return { rows: [] };
    if (sql.includes('SELECT * FROM "waterSale"')) return { rows: sales.filter((s) => s.organizationId === values[0] && s.id === values[1] && s.productKey === values[2]) };
    if (sql.includes("SELECT pr.*")) return { rows: payments.filter((p) => p.idempotencyKey === values[1]).map((p) => {
      const a = applications.find((a) => a.paymentId === p.id);
      return { ...p, payableId: a.saleId, productKey: sales.find((s) => s.id === a.saleId).productKey, appliedAmountCents: a.amountCents };
    }) };
    if (sql.includes('INSERT INTO "paymentRecord"')) {
      const p = { id: payments.length + 1, customerId: values[1], amountCents: values[5], method: values[7], provider: values[8], providerReference: values[9], paidAt: values[12], idempotencyKey: values[15] };
      payments.push(p); return { rows: [p] };
    }
    if (sql.includes('INSERT INTO "paymentApplication"')) {
      const a = { id: applications.length + 1, paymentId: values[2], saleId: values.length === 5 ? values[3] : values[6], amountCents: values.length === 5 ? values[4] : values[7] };
      applications.push(a); return { rows: [a] };
    }
    if (sql.includes('COUNT(*)::int AS "applicationCount"')) {
      const rows = applications.filter((a) => a.saleId === values[1]);
      return { rows: [{ amountPaidCents: rows.reduce((sum, a) => sum + a.amountCents, 0), applicationCount: rows.length, lastPaidAt: "2026-07-02" }] };
    }
    if (sql.includes('UPDATE "waterSale"')) { sales.find((s) => s.id === values[1]).paymentStatus = values[2]; return { rows: [] }; }
    if (sql.includes("GROUP BY pr.id")) {
      assert.deepEqual(values, [7, customerId]);
      assert.match(sql, /pr\."businessUnit" = 'WATER'/);
      assert.match(sql, /BOOL_AND\(pa.status = 'APPLIED'/);
      return { rows: payments.map((p) => ({ ...p, availableCents: p.amountCents - applications.filter((a) => a.paymentId === p.id).reduce((sum, a) => sum + a.amountCents, 0) })).filter((p) => p.availableCents > 0) };
    }
    if (sql.includes('SELECT "paymentId"')) return { rows: applications.filter((a) => a.saleId === values[1]) };
    if (sql.includes('SELECT id FROM "paymentRecord"')) { assert.match(sql, /FOR UPDATE/); return { rows: payments }; }
    assert.fail(`Unexpected query: ${sql}`);
  } };
  return { client, payments, applications, calls, sales };
}

test("manual overpayment becomes Water credit, settles future products, and never duplicates cash", async () => {
  const f = fixture();
  const first = await recordWaterCollection(f.client, input);
  assert.equal(first.payment.amountCents, 15000);
  assert.equal(first.application.amountCents, 10000);
  assert.equal(first.projection.balanceDueCents, 0);
  assert.equal((await loadWaterCustomerCredit(f.client, 7, 2)).availableCents, 5000);
  const second = await applyWaterCustomerCredit(f.client, { ...input, saleId: 2, productKey: "sachet-water-30pk", amountCents: 3000 });
  assert.equal(second.balanceDueCents, 0);
  assert.equal((await loadWaterCustomerCredit(f.client, 7, 2)).availableCents, 2000);
  const third = await applyWaterCustomerCredit(f.client, { ...input, saleId: 3, amountCents: 2000 });
  assert.equal(third.balanceDueCents, 2000);
  assert.equal((await loadWaterCustomerCredit(f.client, 7, 2)).availableCents, 0);
  assert.equal(f.payments.length, 1);
  assert.equal(f.applications.length, 3);
  const replay = await recordWaterCollection(f.client, input);
  assert.equal(replay.application.amountCents, 10000);
  assert.equal(replay.idempotentReplay, true);
  await assert.rejects(() => applyWaterCustomerCredit(f.client, { ...input, saleId: 3, amountCents: 100 }), { code: "WATER_CREDIT_UNAVAILABLE" });
  assert.ok(f.calls.every(({ sql }) => !/INSERT INTO "(?:orderPayment|journal|orderReceipt)"/.test(sql)));
});

test("overpayment requires explicit consent, a customer, and a manual source", async () => {
  for (const [patch, customerId, code] of [
    [{ retainCustomerCredit: false }, 2, "PAYMENT_OVERAPPLICATION"],
    [{ source: "ONLINE_PROVIDER", provider: "PAYSTACK" }, 2, "PAYMENT_OVERAPPLICATION"],
    [{}, null, "WATER_CREDIT_CUSTOMER_REQUIRED"],
  ]) {
    const f = fixture(customerId);
    await assert.rejects(() => recordWaterCollection(f.client, { ...input, ...patch }), { code });
    assert.equal(f.payments.length, 0);
  }
});

test("credit rejects wrong tenant/product, overapplication and stale amount before writes", async () => {
  const f = fixture();
  await recordWaterCollection(f.client, input);
  for (const [patch, code] of [
    [{ organizationId: 8 }, "WATER_SALE_NOT_FOUND"],
    [{ productKey: "sachet-water-30pk" }, "WATER_SALE_NOT_FOUND"],
    [{ amountCents: 5000 }, "PAYMENT_OVERAPPLICATION"],
    [{ amountCents: 1000 }, "WATER_CREDIT_AMOUNT_CHANGED"],
  ]) await assert.rejects(() => applyWaterCustomerCredit(f.client, { ...input, saleId: 3, amountCents: 4000, ...patch }), { code });
  assert.equal(f.applications.length, 1);
});
