import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "./accessControl.js";
import {
  buildConsolidatedFinancialResponse,
  buildCoreOrderRecognitionFilter,
  buildPersistedOrderGrandTotalSql,
  getFinancialScopeDecision,
  isRecognizedCoreOrder,
  resolveOrderItemCostBasis,
  summarizeRecognizedCoreOrders,
} from "./financialPolicy.js";

test("persisted order grand total recognizes delivery exactly once", () => {
  const result = summarizeRecognizedCoreOrders([
    {
      status: "paid",
      grandTotalCents: 12_000,
      total_amount: 12_000,
      deliveryFeeCents: 2_000,
      items: [
        {
          quantity: 2,
          unitCostCents: 3_000,
          product: { sourceCategoryCode: "RETAIL", purchasePriceGhs: 9_999 },
        },
      ],
    },
  ]);

  assert.equal(result.revenueCents, 12_000);
  assert.equal(result.deliveryFeeBreakdownCents, 2_000);
  assert.notEqual(result.revenueCents, 14_000);
  assert.equal(result.cogsCents, 6_000);
});

test("cancelled, refunded and Water-contaminated orders are excluded from core finance", () => {
  const coreLine = {
    quantity: 1,
    unitCostCents: 1_000,
    product: { sourceCategoryCode: "RETAIL" },
  };
  const orders = [
    { status: "completed", grandTotalCents: 5_000, items: [coreLine] },
    { status: "cancelled", grandTotalCents: 9_000, items: [coreLine] },
    { status: "CANCELED", grandTotalCents: 8_000, items: [coreLine] },
    { status: "refunded", grandTotalCents: 7_000, items: [coreLine] },
    {
      status: "paid",
      grandTotalCents: 6_000,
      items: [
        coreLine,
        {
          quantity: 1,
          unitCostCents: 2_200,
          product: { sourceCategoryCode: "water" },
        },
      ],
    },
  ];

  const result = summarizeRecognizedCoreOrders(orders);

  assert.equal(isRecognizedCoreOrder(orders[0]), true);
  assert.equal(isRecognizedCoreOrder(orders[1]), false);
  assert.equal(isRecognizedCoreOrder(orders[4]), false);
  assert.deepEqual(result, {
    orders: 1,
    units: 1,
    revenueCents: 5_000,
    cogsCents: 1_000,
    deliveryFeeBreakdownCents: 0,
    excludedCancelledOrRefunded: 3,
    excludedWaterContaminated: 1,
  });
});

test("historic OrderItem cost snapshots are stable when the catalogue cost changes", () => {
  const original = summarizeRecognizedCoreOrders([
    {
      status: "completed",
      grandTotalCents: 10_000,
      items: [
        {
          quantity: 3,
          unitCostCents: 1_250,
          product: { sourceCategoryCode: "RETAIL", purchasePriceGhs: 1_500 },
        },
      ],
    },
  ]);
  const afterCatalogueEdit = summarizeRecognizedCoreOrders([
    {
      status: "completed",
      grandTotalCents: 10_000,
      items: [
        {
          quantity: 3,
          unitCostCents: 1_250,
          product: { sourceCategoryCode: "RETAIL", purchasePriceGhs: 9_000 },
        },
      ],
    },
  ]);

  assert.equal(original.cogsCents, 3_750);
  assert.equal(afterCatalogueEdit.cogsCents, 3_750);
  assert.deepEqual(
    resolveOrderItemCostBasis({ unitCostCents: 0, purchasePriceGhs: 8_000 }),
    { unitCostCents: 0, source: "order-item-snapshot" }
  );
  assert.deepEqual(
    resolveOrderItemCostBasis({ unitCostCents: null, purchasePriceGhs: 8_000 }),
    { unitCostCents: 8_000, source: "legacy-current-product-cost" }
  );
});

test("consolidated totals equal the visible Core, Water and Shared segments", () => {
  const response = buildConsolidatedFinancialResponse({
    reebsCore: {
      revenue: 100,
      cogs: 40,
      grossProfit: 60,
      operatingExpenses: 10,
      netProfit: 50,
    },
    water: {
      revenue: 30,
      cogs: 12,
      grossProfit: 18,
      operatingExpenses: 3,
      netProfit: 15,
    },
    shared: {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 2,
      netProfit: -2,
      allocationApplied: false,
    },
    metadata: { window: "thisMonth" },
  });

  assert.equal(response.scope, "consolidated");
  assert.equal(response.businessUnit, "CONSOLIDATED");
  assert.equal(response.components.reebsCore.scope, "reebs-core");
  assert.equal(response.components.water.scope, "water");
  assert.equal(response.components.shared.scope, "shared");
  assert.equal(response.components.shared.allocationApplied, false);
  assert.deepEqual(response.summary, {
    revenue: 130,
    cogs: 52,
    grossProfit: 78,
    operatingExpenses: 15,
    netProfit: 63,
  });

  for (const field of Object.keys(response.summary)) {
    assert.equal(
      response.summary[field],
      response.components.reebsCore[field]
        + response.components.water[field]
        + response.components.shared[field]
    );
  }
});

test("consolidated reporting is explicit and permission gated", () => {
  assert.deepEqual(getFinancialScopeDecision(), {
    allowed: true,
    scope: "reebs-core",
  });
  assert.deepEqual(
    getFinancialScopeDecision({ requestedScope: "consolidated" }),
    {
      allowed: false,
      scope: "consolidated",
      statusCode: 403,
      error: "Consolidated financial reporting permission is required.",
    }
  );
  assert.deepEqual(
    getFinancialScopeDecision({
      requestedScope: "consolidated",
      canViewConsolidated: true,
    }),
    { allowed: true, scope: "consolidated" }
  );
  assert.equal(
    getFinancialScopeDecision({ requestedScope: "water" }).statusCode,
    400
  );

  assert.equal(hasPermission({ role: "owner" }, "financials:consolidated"), true);
  assert.equal(hasPermission({ role: "admin" }, "financials:consolidated"), true);
  assert.equal(hasPermission({ role: "manager" }, "financials:consolidated"), false);
  assert.equal(hasPermission({ role: "water" }, "financials:consolidated"), false);
});

test("finance SQL builders mirror the tested persisted-total and exclusion policy", () => {
  assert.equal(
    buildPersistedOrderGrandTotalSql("o"),
    'COALESCE(o."grandTotalCents", o.total_amount)'
  );
  const filter = buildCoreOrderRecognitionFilter("o");
  assert.match(filter, /NOT IN \('cancelled', 'canceled', 'refunded'\)/);
  assert.match(filter, /sourceCategoryCode[^]*= 'WATER'/);
  assert.match(filter, /scoped_oi\."organizationId" = o\."organizationId"/);
  assert.throws(() => buildPersistedOrderGrandTotalSql("o; DROP TABLE"), {
    message: "A safe SQL table alias is required.",
  });
});
