import assert from "node:assert/strict";
import test from "node:test";
import { applyPaymentToPayable } from "./paymentApplicationService.js";

test("Water provider settlement stays in Water and invalidates stale sale edits", async () => {
  const calls = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes('FROM "waterSale"')) {
      assert.match(sql, /FOR UPDATE OF w/);
      assert.deepEqual(params, [7, 4]);
      return { rows: [{ id: 4, customerId: 2, totalAmount: 6000, paymentStatus: "pending" }] };
    }
    if (sql.includes('FROM "paymentApplication"')) return { rows: [{ amountPaidCents: 0 }] };
    if (sql.includes('INSERT INTO "paymentRecord"')) {
      assert.equal(params[4], "WATER");
      assert.equal(params[5], 6000);
      return { rows: [{ id: 30, businessUnit: "WATER", amountCents: 6000 }] };
    }
    if (sql.includes('INSERT INTO "paymentApplication"')) {
      assert.deepEqual(params.slice(3, 8), [null, "WATER", "WATER_ORDER", 4, 6000]);
      return { rows: [{ id: 31, payableType: "WATER_ORDER", payableId: 4 }] };
    }
    if (sql.includes('UPDATE "waterSale"')) {
      assert.match(sql, /"updatedAt" = NOW\(\)/);
      assert.match(sql, /"paymentStatus" = \$7/);
      assert.deepEqual(params, [7, 4, "momo", "WATER-PAY-TEST", "provider-test", "2026-09-24T12:00:00.000Z", "paid"]);
      return { rows: [], rowCount: 1 };
    }
    assert.fail(`Water settlement must not write a Core order, journal or receipt: ${sql}`);
  } };
  const result = await applyPaymentToPayable(client, {
    id: 3, organizationId: 7, customerId: 2, reference: "WATER-PAY-TEST",
    businessUnit: "WATER", payableType: "WATER_ORDER", payableId: 4,
    currency: "GHS", amountCents: 6000, provider: "PAYSTACK",
  }, { channel: "mobile_money", providerReference: "provider-test", paidAt: "2026-09-24T12:00:00Z" });
  assert.equal(result.payment.businessUnit, "WATER");
  assert.equal(result.application.payableId, 4);
  assert.equal(result.receipt, null);
  assert.equal(calls.length, 5);
});

test("a partial Water provider collection leaves the remaining balance payable", async () => {
  const client = { async query(sql, params = []) {
    if (sql.includes('FROM "waterSale"')) return { rows: [{
      id: 4, customerId: 2, totalAmount: 9000, paymentStatus: "pending",
    }] };
    if (sql.includes('FROM "paymentApplication"')) return { rows: [{ amountPaidCents: 2000 }] };
    if (sql.includes('INSERT INTO "paymentRecord"')) return { rows: [{ id: 30 }] };
    if (sql.includes('INSERT INTO "paymentApplication"')) return { rows: [{ id: 31 }] };
    if (sql.includes('UPDATE "waterSale"')) {
      assert.equal(params[2], "momo");
      assert.equal(params[5], null, "a partially collected sale has no fully paid date");
      assert.equal(params[6], "pending");
      return { rows: [], rowCount: 1 };
    }
    assert.fail(`Unexpected Water settlement query: ${sql}`);
  } };
  await applyPaymentToPayable(client, {
    id: 3, organizationId: 7, customerId: 2, reference: "WATER-PARTIAL-TEST",
    businessUnit: "WATER", payableType: "WATER_ORDER", payableId: 4,
    currency: "GHS", amountCents: 3000, provider: "PAYSTACK",
  }, { channel: "mobile_money", providerReference: "partial-test", paidAt: "2026-09-24T12:00:00Z" });
});
