import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";

const url = new URL("./settlement.js", import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === url && specifier.endsWith("/auditLog.js")) {
    return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  }
  return next(specifier, context);
} });
const { recordWaterCollection, validateWaterCollection, assertWaterCommercialEdit } = await import(url);
after(() => hooks.deregister());

test("Water paid, partial, unpaid and legacy projections do not fabricate collections", () => {
  const sale = { totalAmount: 10000, paymentStatus: "paid" };
  assert.equal(deriveWaterSettlement(sale, { amountPaidCents: 4000, applicationCount: 1 }).paymentStatus, "partially_paid");
  assert.equal(deriveWaterSettlement(sale, { amountPaidCents: 4000, applicationCount: 1 }).balanceDueCents, 6000);
  assert.equal(deriveWaterSettlement(sale, { amountPaidCents: 10000, applicationCount: 2 }).paymentStatus, "paid");
  const legacy = deriveWaterSettlement(sale);
  assert.equal(legacy.collectedCents, 0);
  assert.equal(legacy.legacyPaidCents, 10000);
  assert.equal(legacy.legacyPaymentCompatibility, true);
  assert.equal(deriveWaterSettlement({ ...sale, paymentStatus: "unpaid" }).balanceDueCents, 10000);
});

const input = { organizationId: 7, saleId: 3, productKey: "sachet-water-30pk", amountCents: 4000, method: "cash", paidAt: "2026-07-20T12:00:00Z", idempotencyKey: "collection-test-001", actor: { userId: 1 } };

test("Water collection boundary requires amount, method, electronic reference, date and key", () => {
  assert.equal(validateWaterCollection(input).method, "Cash");
  for (const patch of [{ amountCents: 0 }, { amountCents: 1.2 }, { method: "credit" }, { method: "momo" }, { currency: "USD" }, { paidAt: "invalid" }, { idempotencyKey: "" }]) {
    assert.throws(() => validateWaterCollection({ ...input, ...patch }));
  }
});

test("commercial edits cannot rewrite payment facts, overdraw a collection or reassign its customer", () => {
  const sale = { totalAmount: 10000, customerId: 1, paymentStatus: "unpaid", paymentMethod: "credit" };
  const totals = { amountPaidCents: 4000 };
  assert.doesNotThrow(() => assertWaterCommercialEdit(sale, { notes: "correct" }, totals, 10000, 1));
  assert.throws(() => assertWaterCommercialEdit(sale, { paymentStatus: "paid" }, totals, 10000, 1), { code: "WATER_COLLECTION_REQUIRED" });
  assert.throws(() => assertWaterCommercialEdit(sale, {}, totals, 3000, 1), { code: "WATER_REFUND_REQUIRED" });
  assert.throws(() => assertWaterCommercialEdit(sale, {}, totals, 10000, 2), { code: "WATER_CUSTOMER_RECONCILIATION_REQUIRED" });
  assert.throws(() => assertWaterCommercialEdit(sale, {}, { amountPaidCents: 10000, legacyPaymentCompatibility: true }, 11000, 1), { code: "WATER_LEGACY_PAYMENT_RECONCILIATION" });
});

test("partial then final collection reuse shared Water-only records and exact retry is idempotent", async () => {
  const payments = [];
  const sale = { id: 3, organizationId: 7, productKey: input.productKey, customerId: 2, totalAmount: 10000, paymentStatus: "unpaid" };
  const calls = [];
  const client = { async query(sql, values = []) {
    calls.push(sql);
    if (/pg_advisory/.test(sql)) return { rows: [] };
    if (/SELECT pr\.\*/.test(sql)) return { rows: payments.filter((row) => row.idempotencyKey === values[1]) };
    if (/SELECT \* FROM "waterSale"/.test(sql)) {
      assert.deepEqual(values, [7, 3, input.productKey]);
      return { rows: [{ ...sale }] };
    }
    if (/COUNT\(\*\)/.test(sql)) return { rows: [{ amountPaidCents: payments.reduce((sum, row) => sum + row.amountCents, 0), applicationCount: payments.length, lastPaidAt: input.paidAt }] };
    if (/INSERT INTO "paymentRecord"/.test(sql)) {
      assert.equal(values[4], "WATER");
      const record = { id: payments.length + 1, amountCents: values[5], method: values[7], provider: values[8], providerReference: values[9], paidAt: values[12], idempotencyKey: values[15], payableId: 3, productKey: input.productKey };
      payments.push(record);
      return { rows: [record] };
    }
    if (/INSERT INTO "paymentApplication"/.test(sql)) {
      assert.deepEqual(values.slice(3, 7), [null, "WATER", "WATER_ORDER", 3]);
      return { rows: [{ id: payments.length, businessUnit: "WATER", payableId: 3 }] };
    }
    if (/UPDATE "waterSale"/.test(sql)) { sale.paymentStatus = values[2]; return { rows: [] }; }
    assert.fail(`Unexpected SQL: ${sql}`);
  } };
  assert.equal((await recordWaterCollection(client, input)).projection.balanceDueCents, 6000);
  assert.equal(sale.paymentStatus, "partially_paid");
  assert.equal((await recordWaterCollection(client, input)).idempotentReplay, true);
  assert.equal(payments.length, 1);
  await assert.rejects(() => recordWaterCollection(client, { ...input, amountCents: 5000 }), { code: "IDEMPOTENCY_CONFLICT" });
  await assert.rejects(() => recordWaterCollection(client, { ...input, idempotencyKey: "collection-test-002", amountCents: 7000 }), { code: "PAYMENT_OVERAPPLICATION" });
  assert.equal((await recordWaterCollection(client, { ...input, idempotencyKey: "collection-test-002", amountCents: 6000 })).projection.balanceDueCents, 0);
  assert.equal(sale.paymentStatus, "paid");
  assert.ok(calls.every((sql) => !/(?:INSERT INTO|UPDATE) "(?:orderPayment|orderReceipt|journal)/i.test(sql)));
});
