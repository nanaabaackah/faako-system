import assert from "node:assert/strict";
import test from "node:test";
import { canWriteWaterAction, presentWaterDashboard } from "./dashboardAccess.js";

test("only owners/admins manage Water operations; Water staff retain all sale actions", () => {
  for (const action of ["sale", "update_sale", "delete_sale"]) {
    assert.equal(canWriteWaterAction("water", action), true);
    assert.equal(canWriteWaterAction("staff", action), false);
    assert.equal(canWriteWaterAction("manager", action), false);
  }
  for (const action of ["restock", "update_restock", "delete_restock", "expense", "adjustment"]) {
    assert.equal(canWriteWaterAction("owner", action), true);
    assert.equal(canWriteWaterAction("admin", action), true);
    assert.equal(canWriteWaterAction("water", action), false);
    assert.equal(canWriteWaterAction(undefined, action), false);
  }
});

test("operational projection allowlists data without mutating the private calculation ledger", () => {
  const dashboard = {
    scope: "water", businessUnit: "WATER", privateFutureField: "internal",
    product: { key: "water", purchaseCost: 2400, pricing: {
      retailSingle: 3000, purchaseCost: 2400, effectiveRecords: [{ createdByName: "Internal actor" }],
    } },
    summary: { stockOnHand: 8, netProfit: 800, currentUnitCost: 2400 },
    restocks: [{ id: 1, quantity: 10, unitCost: 2400, notes: "supplier pricing" }],
    sales: [{ id: 2, quantity: 2, totalAmount: 6000, unitCostAtSaleCents: 2400,
      unitCostAtTransaction: 2400, updatedAt: "2026-09-24", privateFutureField: "internal" }],
    expenses: [{ id: 3, amount: 400 }], adjustments: [],
  };
  const before = structuredClone(dashboard);
  const operational = presentWaterDashboard(dashboard, "water");
  assert.equal(operational.permissions.canViewCost, false);
  assert.deepEqual(operational.product, { key: "water", pricing: { retailSingle: 3000 } });
  assert.deepEqual(operational.summary, { stockOnHand: 8 });
  assert.deepEqual(operational.restocks, [{ id: 1, quantity: 10 }]);
  assert.deepEqual(operational.sales, [{ id: 2, quantity: 2, totalAmount: 6000, updatedAt: "2026-09-24" }]);
  assert.deepEqual(operational.expenses, []);
  assert.equal(Object.hasOwn(operational, "privateFutureField"), false);
  assert.deepEqual(dashboard, before);
  for (const role of ["admin", "owner"]) {
    assert.deepEqual(presentWaterDashboard(dashboard, role).summary, dashboard.summary);
  }
  for (const role of ["manager", "staff", undefined]) {
    const result = presentWaterDashboard(dashboard, role);
    assert.equal(result.permissions.canViewCost, false);
    assert.equal(result.permissions.canManagePricing, false);
    assert.equal(Object.hasOwn(result.product, "purchaseCost"), false);
  }
});
