import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildWaterSummary,
  didWaterSalePricingBasisChange,
  resolveSaleDiscount,
  resolveWaterPriceDecision,
  resolveWaterCommercialTimestamp,
  resolveWaterRestockUnitCost,
  restateWaterSaleCostSnapshots,
} from "./water.js";

test("Water restock cost accepts GHS input and stores integer pesewas", () => {
  assert.equal(resolveWaterRestockUnitCost({ unitCost: "24.50" }), 2450);
  assert.equal(resolveWaterRestockUnitCost({ unitCost: "22.555" }), 2256);
});

test("Water restock edit retains its recorded cost when cost is omitted", () => {
  assert.equal(resolveWaterRestockUnitCost({}, 2375), 2375);
});

test("a new Water restock fails closed when its cost is omitted", () => {
  assert.equal(resolveWaterRestockUnitCost({}), null);
});

test("Water restock cost rejects zero, negative and invalid values", () => {
  assert.equal(resolveWaterRestockUnitCost({ unitCost: "0" }), null);
  assert.equal(resolveWaterRestockUnitCost({ unitCost: "-2" }), null);
  assert.equal(resolveWaterRestockUnitCost({ unitCost: "not money" }), null);
});

test("Water summary applies each recorded restock cost to its own sales period", () => {
  const summary = buildWaterSummary({
    restocks: [
      { id: 1, quantity: 10, unitCost: 2000, date: "2026-01-01" },
      { id: 2, quantity: 30, unitCost: 2400, date: "2026-02-01" },
    ],
    sales: [
      { quantity: 2, totalAmount: 6000, paymentMethod: "cash", paymentStatus: "paid", date: "2026-01-10" },
      { quantity: 6, totalAmount: 18000, paymentMethod: "cash", paymentStatus: "paid", date: "2026-02-10" },
    ],
    expenses: [{ amount: 1000 }],
    adjustments: [],
  });

  assert.equal(summary.stockOnHand, 32);
  assert.equal(summary.restockSpend, 92000);
  assert.equal(summary.costOfGoodsSold, 18400);
  assert.equal(summary.grossProfit, 5600);
  assert.equal(summary.netProfit, 4600);
  assert.equal(summary.inventoryValue, 76800);
});

test("editing an old restock price corrects profit without changing Water stock", () => {
  const input = {
    sales: [{ quantity: 3, totalAmount: 9000, date: "2026-01-10" }],
    expenses: [],
    adjustments: [],
  };
  const before = buildWaterSummary({
    ...input,
    restocks: [{ quantity: 10, unitCost: 2000, date: "2026-01-01" }],
  });
  const after = buildWaterSummary({
    ...input,
    restocks: [{ quantity: 10, unitCost: 2300, date: "2026-01-01" }],
  });

  assert.equal(before.stockOnHand, after.stockOnHand);
  assert.equal(before.stockOnHand, 7);
  assert.equal(after.costOfGoodsSold - before.costOfGoodsSold, 900);
  assert.equal(before.grossProfit - after.grossProfit, 900);
});

test("the explicit restock correction workflow restates snapshotted Water sale costs", () => {
  const source = readFileSync(new URL("./water.js", import.meta.url), "utf8");
  assert.match(source, /WATER_RESTOCK_COST_BASIS_CORRECTED/);
  assert.match(source, /SET "unitCostAtSaleCents" = resolved_cost\."unitCost"/);
  assert.match(source, /restock\."productKey" = sale\."productKey"/);
  assert.match(source, /sale\."productKey" = \$2/);
  assert.match(source, /restatedSaleCostCount/);
  assert.equal((source.match(/await restateWaterSaleCostSnapshots\(/g) || []).length, 3);
});

test("Water cost restatement is product scoped and reports changed snapshots", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return calls.length === 1
        ? { rows: [{ count: 0 }] }
        : { rowCount: 3, rows: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    },
  };

  const count = await restateWaterSaleCostSnapshots(client, {
    organizationId: 9,
    productKey: "gwater-15pk",
    userId: 4,
    userName: "Water Admin",
  });

  assert.equal(count, 3);
  assert.deepEqual(calls[0].values, [9, "gwater-15pk"]);
  assert.deepEqual(calls[1].values, [9, "gwater-15pk", 4, "Water Admin"]);
  assert.match(calls[1].sql, /restock\."productKey" = sale\."productKey"/);
});

test("Water restock changes fail closed when they would orphan a snapshotted sale", async () => {
  const client = {
    query: async () => ({ rows: [{ count: 1 }] }),
  };

  await assert.rejects(
    () => restateWaterSaleCostSnapshots(client, {
      organizationId: 9,
      productKey: "gwater-15pk",
    }),
    (error) => error?.statusCode === 409 && error?.code === "WATER_COST_BASIS_REQUIRED"
  );
});

test("Water sale pricing uses the server standard unless an authorized override is explicit", () => {
  assert.deepEqual(
    resolveWaterPriceDecision({ standardPriceCents: 2700 }),
    {
      unitPrice: 2700,
      standardUnitPrice: 2700,
      isOverride: false,
      overrideReason: null,
    }
  );
  assert.equal(
    resolveWaterPriceDecision({
      standardPriceCents: 2700,
      submittedPriceCents: 2500,
      hasSubmittedPrice: true,
      canOverride: false,
    }).statusCode,
    403
  );
  assert.match(
    resolveWaterPriceDecision({
      standardPriceCents: 2700,
      submittedPriceCents: 2500,
      hasSubmittedPrice: true,
      canOverride: true,
    }).error,
    /reason/i
  );
  assert.deepEqual(
    resolveWaterPriceDecision({
      standardPriceCents: 2700,
      submittedPriceCents: 2500,
      hasSubmittedPrice: true,
      canOverride: true,
      overrideReason: "Approved customer recovery",
    }),
    {
      unitPrice: 2500,
      standardUnitPrice: 2700,
      isOverride: true,
      overrideReason: "Approved customer recovery",
    }
  );
});

test("Water sale pricing is re-resolved when quantity, channel, or sale date changes", () => {
  const existing = {
    quantity: 9,
    saleChannel: "retail",
    date: "2026-08-20T00:00:00.000Z",
  };
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing }), false);
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing, quantity: 10 }), true);
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing, saleChannel: "company" }), true);
  assert.equal(
    didWaterSalePricingBasisChange(existing, { ...existing, date: "2026-08-21T00:00:00.000Z" }),
    true
  );
});

test("a date-only Water sale made today resolves commercial terms at transaction time", () => {
  const now = "2026-08-20T14:25:00.000Z";
  assert.equal(resolveWaterCommercialTimestamp("2026-08-20T00:00:00.000Z", now), now);
  assert.equal(
    resolveWaterCommercialTimestamp("2026-08-19T00:00:00.000Z", now),
    "2026-08-19T00:00:00.000Z"
  );
  assert.equal(
    resolveWaterCommercialTimestamp("2026-08-20T09:00:00.000Z", now),
    "2026-08-20T09:00:00.000Z"
  );
});

test("Water discount configuration is enforced for percent and fixed discounts", () => {
  assert.match(resolveSaleDiscount("percent", "11", 10000, 1000).error, /configured/i);
  assert.match(resolveSaleDiscount("amount", "11", 10000, 1000).error, /configured/i);
  assert.deepEqual(resolveSaleDiscount("percent", "10", 10000, 1000), {
    discountType: "percent",
    discountValue: 1000,
    discountAmount: 1000,
  });
});
