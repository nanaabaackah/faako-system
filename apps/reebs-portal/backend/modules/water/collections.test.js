import test from "node:test";
import assert from "node:assert/strict";
import { loadWaterCollections, projectWaterSales } from "./collections.js";

test("Water collections require matching tenant, product, Water application and payment record", async () => {
  const client = { async query(sql, values) {
    assert.deepEqual(values, [7, "sachet-water-30pk"]);
    for (const clause of [
      'a."organizationId" = $1', 'w."productKey" = $2', 'w."archivedAt" IS NULL',
      'p."organizationId" = a."organizationId"', 'w."organizationId" = a."organizationId"',
      'a."businessUnit" = \'WATER\'', 'p."businessUnit" = \'WATER\'',
      'a."payableType" = \'WATER_ORDER\'', "a.status = 'APPLIED'", "p.status = 'PAID'",
    ]) assert.ok(sql.includes(clause), clause);
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
    return { rows: [{ saleId: 8, amountPaidCents: "3000", applicationCount: 1 }] };
  } };
  assert.equal((await loadWaterCollections(client, 7, "sachet-water-30pk"))[0].saleId, 8);
});

test("partial, complete and reversed applications are authoritative without mutating sale history", () => {
  const sales = [1, 2, 3].map((id) => ({ id, totalAmount: 6000, quantity: 2, paymentStatus: "paid", paidAt: "2026-09-01" }));
  const before = structuredClone(sales);
  const projected = projectWaterSales(sales, [
    { saleId: 1, amountPaidCents: "2000" }, { saleId: 2, amountPaidCents: "6000" },
    { saleId: 3, amountPaidCents: "0" },
  ]);
  assert.deepEqual(projected.map(({ amountPaidCents, balanceDueCents, paymentStatus }) => ({ amountPaidCents, balanceDueCents, paymentStatus })), [
    { amountPaidCents: 2000, balanceDueCents: 4000, paymentStatus: "pending" },
    { amountPaidCents: 6000, balanceDueCents: 0, paymentStatus: "paid" },
    { amountPaidCents: 0, balanceDueCents: 6000, paymentStatus: "unpaid" },
  ]);
  assert.deepEqual(sales, before);
});

test("legacy paid status is not added on top of provider collections or changed during reads", () => {
  const legacy = { id: 1, totalAmount: 6000, paymentStatus: "paid", paymentMethod: "cash" };
  assert.equal(projectWaterSales([legacy])[0].amountPaidCents, 6000);
  assert.equal(projectWaterSales([legacy], [{ saleId: 1, amountPaidCents: 6000 }])[0].amountPaidCents, 6000);
  assert.equal(projectWaterSales([{ ...legacy, paymentStatus: "pending" }])[0].amountPaidCents, 0);
  const corrected = projectWaterSales([{ ...legacy, totalAmount: 9000 }], [{ saleId: 1, amountPaidCents: 6000 }])[0];
  assert.equal(corrected.balanceDueCents, 3000);
});
