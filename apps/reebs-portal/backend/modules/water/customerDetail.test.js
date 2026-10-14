import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith("/auditLog.js")) return { url: "data:text/javascript,export const writeAuditLog = async () => {};", shortCircuit: true };
  return next(specifier, context);
} });
const { loadWaterCustomerDetail } = await import("./customerDetail.js");
after(() => hooks.deregister());

test("customer Water totals cover every active order, not just ten history rows or Core records", async () => {
  const client = { async query(sql, values) {
    if (sql.includes('FROM "waterSale" w')) {
      assert.deepEqual(values, [2, 7]);
      assert.match(sql, /w\."archivedAt" IS NULL/);
      assert.match(sql, /pa\."organizationId" = w\."organizationId"/);
      assert.match(sql, /pr\."businessUnit" = 'WATER'/);
      assert.doesNotMatch(sql, /FROM "order"|LIMIT 10/);
      return { rows: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, totalAmount: 1000, quantity: 1,
        amountPaidCents: 400, applicationCount: 1, paymentStatus: "partially_paid" })) };
    }
    assert.deepEqual(values, [7, 2]);
    return { rows: [{ id: 3, availableCents: "2000" }] };
  } };
  const detail = await loadWaterCustomerDetail(client, 7, 2);
  assert.equal(detail.waterSales.length, 10);
  assert.deepEqual(detail.waterTotals, { sales: 12, revenue: 12000, quantity: 12, outstandingCents: 7200, legacyPaidCents: 0 });
  assert.equal(detail.waterCredit.availableCents, 2000);
});
