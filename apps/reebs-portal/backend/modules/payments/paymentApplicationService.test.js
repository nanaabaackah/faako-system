import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith("/auditLog.js")) return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  return next(specifier, context);
} });
const { applyPaymentToPayable } = await import("./paymentApplicationService.js");
after(() => hooks.deregister());

for (const [total, prior, payment, status] of [[6000, 0, 6000, "paid"], [9000, 2000, 3000, "partially_paid"]]) {
  test(`Water provider collection projects ${status}, retains its ledger and never writes Core`, async () => {
    const calls = [];
    let collected = prior;
    const sale = { id: 4, organizationId: 7, customerId: 2, productKey: "gwater-15pk", totalAmount: total, paymentStatus: "pending" };
    const client = { async query(sql, params = []) {
      calls.push(sql);
      if (sql.includes('FROM "waterSale" w')) {
        assert.match(sql, /FOR UPDATE OF w/);
        assert.deepEqual(params, [7, 4]);
        return { rows: [{ ...sale }] };
      }
      if (sql.startsWith('SELECT * FROM "waterSale"')) {
        assert.match(sql, /FOR UPDATE/);
        assert.deepEqual(params, [7, 4, sale.productKey]);
        return { rows: [{ ...sale }] };
      }
      if (sql.includes('FROM "paymentApplication"') && sql.includes('SUM(')) return { rows: [{ amountPaidCents: collected, applicationCount: collected > 0 ? 1 : 0, lastPaidAt: "2026-09-24T12:00:00.000Z" }] };
      if (/pg_advisory|SELECT pr\.\*|SELECT id FROM "paymentRecord"/.test(sql)) return { rows: [] };
      if (sql.includes('INSERT INTO "paymentRecord"')) {
        assert.equal(params[4], "WATER");
        assert.equal(params[5], payment);
        assert.equal(params[7], "Mobile Money");
        return { rows: [{ id: 30, businessUnit: "WATER", amountCents: payment }] };
      }
      if (sql.includes('INSERT INTO "paymentApplication"')) {
        assert.deepEqual(params.slice(3, 8), [null, "WATER", "WATER_ORDER", 4, payment]);
        collected += payment;
        return { rows: [{ id: 31, payableType: "WATER_ORDER", payableId: 4 }] };
      }
      if (sql.includes('UPDATE "waterSale"')) {
        assert.match(sql, /clock_timestamp\(\)/);
        assert.equal(params[2], status);
        assert.equal(params[3], status === "paid" ? "2026-09-24T12:00:00.000Z" : null);
        assert.equal(params[4], sale.productKey);
        return { rows: [], rowCount: 1 };
      }
      assert.fail(`Unexpected settlement query: ${sql}`);
    } };
    const result = await applyPaymentToPayable(client, {
      id: 3, organizationId: 7, customerId: 2, reference: "WATER-PAY-TEST",
      businessUnit: "WATER", payableType: "WATER_ORDER", payableId: 4,
      currency: "GHS", amountCents: payment, provider: "PAYSTACK",
    }, { channel: "mobile_money", providerReference: "provider-test", paidAt: "2026-09-24T12:00:00Z" });
    assert.equal(result.payment.businessUnit, "WATER");
    assert.equal(result.application.payableId, 4);
    assert.equal(result.projection.balanceDueCents, total - prior - payment);
    assert.equal(result.receipt, null);
    assert.equal(calls.some((sql) => /(?:INSERT|UPDATE).*"(?:order|orderPayment|journalEntry)"/.test(sql)), false);
  });
}
