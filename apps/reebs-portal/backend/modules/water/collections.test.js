import test from "node:test";
import assert from "node:assert/strict";
import { loadWaterCollections, projectWaterSales } from "./reporting.js";

const collection = (saleId, amountCents, applicationStatus = "APPLIED") => ({
  saleId, amountCents, applicationStatus, productKey: "sachet-water-30pk", status: "PAID",
});

test("Water collections require matching tenant, product, Water application and payment record", async () => {
  const client = { async query(sql, values) {
    assert.deepEqual(values, [7, "sachet-water-30pk", null]);
    for (const clause of [
      'pa."organizationId" = $1', 'w."productKey" = $2', 'w."archivedAt" IS NULL',
      'pr."organizationId" = pa."organizationId"', 'w."organizationId" = pa."organizationId"',
      'pa."businessUnit" = \'WATER\'', 'pr."businessUnit" = \'WATER\'',
      'pa."payableType" = \'WATER_ORDER\'', "pa.currency = 'GHS'", "pr.currency = 'GHS'",
    ]) assert.ok(sql.includes(clause), clause);
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
    return { rows: [{ saleId: 8, amountPaidCents: "3000", applicationCount: 1 }] };
  } };
  assert.equal((await loadWaterCollections(client, 7, "sachet-water-30pk"))[0].saleId, 8);
});

test("partial, complete and reversed applications are authoritative without mutating sale history", () => {
  const sales = [1, 2, 3].map((id) => ({ id, productKey: "sachet-water-30pk", totalAmount: 6000, quantity: 2, paymentStatus: "paid", paidAt: "2026-09-01" }));
  const before = structuredClone(sales);
  const projected = projectWaterSales(sales, [
    collection(1, 2000), collection(2, 6000), collection(3, 6000, "REVERSED"),
  ]);
  assert.deepEqual(projected.map(({ amountPaidCents, balanceDueCents, paymentStatus }) => ({ amountPaidCents, balanceDueCents, paymentStatus })), [
    { amountPaidCents: 2000, balanceDueCents: 4000, paymentStatus: "partially_paid" },
    { amountPaidCents: 6000, balanceDueCents: 0, paymentStatus: "paid" },
    { amountPaidCents: 0, balanceDueCents: 6000, paymentStatus: "unpaid" },
  ]);
  assert.deepEqual(sales, before);
});

test("legacy paid status is not added on top of provider collections or changed during reads", () => {
  const legacy = { id: 1, productKey: "sachet-water-30pk", totalAmount: 6000, paymentStatus: "paid", paymentMethod: "cash" };
  assert.equal(projectWaterSales([legacy])[0].amountPaidCents, 6000);
  assert.equal(projectWaterSales([legacy], [collection(1, 6000)])[0].amountPaidCents, 6000);
  assert.equal(projectWaterSales([{ ...legacy, paymentStatus: "pending" }])[0].amountPaidCents, 0);
  const corrected = projectWaterSales([{ ...legacy, totalAmount: 9000 }], [collection(1, 6000)])[0];
  assert.equal(corrected.balanceDueCents, 3000);
});
