import assert from "node:assert/strict";
import test from "node:test";
import { calculateWaterCostBasis } from "./waterFinancials.js";

test("Water cost basis uses a recorded restock cost for COGS and inventory", () => {
  assert.deepEqual(
    calculateWaterCostBasis({
      restocks: [{ quantity: 20, unitCost: 2450 }],
      sales: [{ quantity: 6, date: "2026-08-02", unitCostAtSaleCents: 2450 }],
      unitsSold: 6,
      stockOnHand: 14,
    }),
    {
      restockSpend: 49000,
      currentUnitCost: 2450,
      costOfGoodsSold: 14700,
      inventoryValue: 34300,
      knownCostOfGoodsSold: 14700,
      missingCostSaleCount: 0,
      missingCostRestockCount: 0,
      profitabilityAvailable: true,
    }
  );
});

test("explicitly restated sale snapshots change Water profit inputs", () => {
  const before = calculateWaterCostBasis({
    restocks: [{ quantity: 10, unitCost: 2200 }],
    sales: [{ quantity: 4, date: "2026-08-02", unitCostAtSaleCents: 2200 }],
    unitsSold: 4,
    stockOnHand: 6,
  });
  const after = calculateWaterCostBasis({
    restocks: [{ quantity: 10, unitCost: 2400 }],
    sales: [{ quantity: 4, date: "2026-08-02", unitCostAtSaleCents: 2400 }],
    unitsSold: 4,
    stockOnHand: 6,
  });

  assert.equal(before.costOfGoodsSold, 8800);
  assert.equal(after.costOfGoodsSold, 9600);
  assert.equal(after.restockSpend, 24000);
  assert.equal(after.inventoryValue, 14400);
});

test("all-time Water COGS follows each historical restock period", () => {
  assert.deepEqual(
    calculateWaterCostBasis({
      restocks: [
        { id: 1, quantity: 10, unitCost: 2000, date: "2026-01-01" },
        { id: 2, quantity: 30, unitCost: 2400, date: "2026-02-01" },
      ],
      sales: [
        { quantity: 2, date: "2026-01-10", unitCostAtSaleCents: 2000 },
        { quantity: 6, date: "2026-02-10", unitCostAtSaleCents: 2400 },
      ],
      unitsSold: 8,
      stockOnHand: 32,
    }),
    {
      restockSpend: 92000,
      currentUnitCost: 2400,
      costOfGoodsSold: 18400,
      inventoryValue: 76800,
      knownCostOfGoodsSold: 18400,
      missingCostSaleCount: 0,
      missingCostRestockCount: 0,
      profitabilityAvailable: true,
    }
  );
});

test("costing honors a persisted sale snapshot until an explicit restatement updates it", () => {
  const sales = [
    {
      id: 10,
      quantity: 3,
      date: "2026-08-10T12:00:00.000Z",
      unitCostAtSaleCents: 2200,
    },
  ];
  const original = calculateWaterCostBasis({
    restocks: [
      { id: 1, quantity: 10, unitCost: 2200, date: "2026-08-01T08:00:00.000Z" },
    ],
    sales,
    stockOnHand: 7,
  });
  const corrected = calculateWaterCostBasis({
    restocks: [
      { id: 1, quantity: 10, unitCost: 2600, date: "2026-08-01T08:00:00.000Z" },
    ],
    sales,
    stockOnHand: 7,
  });

  assert.equal(original.costOfGoodsSold, 6600);
  assert.equal(corrected.costOfGoodsSold, 6600);
  assert.equal(corrected.inventoryValue, 18200);
});

test("a later Water restock price does not rewrite earlier sale COGS", () => {
  const result = calculateWaterCostBasis({
    restocks: [
      { id: 1, quantity: 10, unitCost: 2000, date: "2026-01-01" },
      { id: 2, quantity: 10, unitCost: 3000, date: "2026-02-01" },
    ],
    sales: [{ quantity: 3, date: "2026-01-15", unitCostAtSaleCents: 2000 }],
    unitsSold: 3,
    stockOnHand: 17,
  });

  assert.equal(result.costOfGoodsSold, 6000);
  assert.equal(result.currentUnitCost, 3000);
});

test("a sale before the first recorded restock never uses a compatibility cost", () => {
  const result = calculateWaterCostBasis({
    restocks: [{ quantity: 10, unitCost: 3000, date: "2026-02-01" }],
    sales: [{ quantity: 2, date: "2026-01-15" }],
    unitsSold: 2,
    stockOnHand: 8,
    fallbackUnitCost: 2200,
  });

  assert.equal(result.costOfGoodsSold, null);
  assert.equal(result.profitabilityAvailable, false);
  assert.equal(result.missingCostSaleCount, 1);
  assert.equal(result.inventoryValue, 24000);
});

test("undated legacy sale costs are not inferred even when dated restocks exist", () => {
  const result = calculateWaterCostBasis({
    restocks: [
      { id: 1, quantity: 10, unitCost: 2000, date: "2026-02-01" },
      { id: 2, quantity: 10, unitCost: 2500, date: "2026-02-01" },
    ],
    sales: [{ quantity: 2, date: "2026-02-01" }],
    unitsSold: 2,
    stockOnHand: 18,
  });

  assert.equal(result.costOfGoodsSold, null);
  assert.equal(result.currentUnitCost, 2500);
});

test("unknown purchase costs do not invent cash position inputs or stock valuation", () => {
  const result = calculateWaterCostBasis({ restocks: [{ quantity: 5 }], stockOnHand: 5 });
  assert.equal(result.restockSpend, null);
  assert.equal(result.inventoryValue, null);
  assert.equal(result.currentUnitCost, null);
  assert.equal(result.missingCostRestockCount, 1);
});

test("modern snapshots take precedence over the supported legacy cost field", () => {
  const result = calculateWaterCostBasis({ sales: [
    { quantity: 2, unitCostAtSaleCents: 2300, unitCostAtTransaction: 2200 },
    { quantity: 1, unitCostAtTransaction: 2400 },
  ] });
  assert.equal(result.costOfGoodsSold, 7000);
  assert.equal(result.profitabilityAvailable, true);
});
