import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWaterPricingPermissions,
  calculateWaterCostSummary,
  normalizeWaterPricing,
  resolveWaterUnitPrice,
} from "./waterPricing.js";

test("Water selling price resolves only from configured server values", () => {
  const pricing = normalizeWaterPricing({
    retailSinglePrice: 2700,
    retailBulkPrice: 2600,
    companyPrice: 2500,
    bulkThreshold: 10,
  });

  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 1, saleChannel: "retail" }), 2700);
  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 10, saleChannel: "retail" }), 2600);
  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 1, saleChannel: "company" }), 2500);
});

test("Water selling price fails closed when required configuration is missing", () => {
  const pricing = normalizeWaterPricing({ bulkThreshold: 10 });
  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 1, saleChannel: "retail" }), null);
  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 20, saleChannel: "retail" }), null);
  assert.equal(resolveWaterUnitPrice({ pricing, quantity: 1, saleChannel: "company" }), null);
});

test("Water profitability is unavailable when a transaction has no cost snapshot", () => {
  assert.deepEqual(
    calculateWaterCostSummary([
      { quantity: 2, unitCostAtTransaction: 2200 },
      { quantity: 1, unitCostAtTransaction: null },
    ]),
    {
      costOfGoodsSold: null,
      knownCostOfGoodsSold: 4400,
      missingCostSaleCount: 1,
      profitabilityAvailable: false,
    }
  );
});

test("Water cost and pricing permissions exclude operational Water users", () => {
  assert.equal(buildWaterPricingPermissions("water").canViewCost, false);
  assert.equal(buildWaterPricingPermissions("water").canManagePricing, false);
  assert.equal(buildWaterPricingPermissions("manager").canViewCost, true);
});

test("Water profitability uses transaction cost snapshots instead of the current product cost", () => {
  const summary = calculateWaterCostSummary([
    { quantity: 2, unitCostAtTransaction: 400 },
    { quantity: 1, unitCostAtTransaction: 500 },
  ]);

  assert.deepEqual(summary, {
    costOfGoodsSold: 1300,
    knownCostOfGoodsSold: 1300,
    missingCostSaleCount: 0,
    profitabilityAvailable: true,
  });
});

test("Water profitability remains unavailable when even one historical cost snapshot is absent", () => {
  const summary = calculateWaterCostSummary([
    { quantity: 2, unitCostAtTransaction: 400 },
    { quantity: 1, unitCostAtTransaction: null },
  ]);

  assert.equal(summary.costOfGoodsSold, null);
  assert.equal(summary.missingCostSaleCount, 1);
  assert.equal(summary.profitabilityAvailable, false);
});
