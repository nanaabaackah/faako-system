import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdvancedAnalyticsResponse,
  buildFallbackAnalytics,
<<<<<<< Updated upstream
=======
  buildSharedAnalyticsRequest,
  loadAnalyticsSnapshot,
>>>>>>> Stashed changes
  normalizeAnalyticsServiceUrl,
} from "./advancedAnalytics.js";

const createSnapshotClient = ({ products = [], customers = [], coreCustomerActivity = [] } = {}) => {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (queries.length === 1) return { rows: [] };
      if (queries.length === 2) return { rows: [] };
      if (queries.length === 3) {
        const excludesWater = /UPPER\(COALESCE\(p\."sourceCategoryCode", ''\)\) <> 'WATER'/.test(sql);
        const visibleProducts = excludesWater
          ? products.filter((product) => String(product.sourceCategoryCode || "").toUpperCase() !== "WATER")
          : products;
        return {
          rows: visibleProducts.map((product) => ({
            productId: product.id,
            name: product.name,
            stock: product.stock,
            reorderLevel: product.reorderLevel,
            unitsOut90d: product.unitsOut90d,
          })),
        };
      }

      const interactionCounts = new Map();
      for (const customerId of coreCustomerActivity) {
        interactionCounts.set(customerId, (interactionCounts.get(customerId) || 0) + 1);
      }
      const countsActivityOnly = /FROM activity/.test(sql) && !/FROM "customer"/.test(sql);
      const customerCounts = countsActivityOnly
        ? [...interactionCounts.values()]
        : customers.map((customer) => interactionCounts.get(customer.id) || 0);
      return {
        rows: [{
          total: customerCounts.length,
          repeat: customerCounts.filter((count) => count > 1).length,
        }],
      };
    },
  };
};

test("fallback analytics returns safe advanced dashboard insights", () => {
  const result = buildFallbackAnalytics({
    historyDays: 180,
    revenueSeries: Array.from({ length: 60 }, (_, index) => ({
      orderRevenueCents: 10_000 + index * 100,
      bookingRevenueCents: 5_000,
    })),
    weekdayDemand: [
      { weekday: "Saturday", bookings: 18 },
      { weekday: "Sunday", bookings: 4 },
    ],
    inventory: [
      { productId: 1, name: "Balloons", stock: 2, reorderLevel: 3, unitsOut90d: 90 },
    ],
    customers: { total: 20, repeat: 8 },
  });

  assert.equal(result.source, "node-fallback");
  assert.equal(result.version, "2026-08-reebs-core-recognition-v2");
  assert.equal(result.demand.peakWeekday, "Saturday");
  assert.equal(result.customer.repeatRate, 40);
  assert.equal(result.inventoryRisks[0].severity, "critical");
  assert.ok(result.forecast.next30RevenueCents > 0);
});

test("fallback analytics handles an empty snapshot", () => {
  const result = buildFallbackAnalytics({});
  assert.equal(result.forecast.next30RevenueCents, 0);
  assert.equal(result.demand.peakWeekday, "No pattern yet");
  assert.deepEqual(result.inventoryRisks, []);
});

test("analytics service URL accepts a Railway hostname without a scheme", () => {
  assert.equal(
    normalizeAnalyticsServiceUrl("reebs-service-production.up.railway.app/"),
    "https://reebs-service-production.up.railway.app"
  );
  assert.equal(
    normalizeAnalyticsServiceUrl("https://analytics.example.com/base/"),
    "https://analytics.example.com/base"
  );
  assert.equal(normalizeAnalyticsServiceUrl("file:///tmp/service"), "");
});
<<<<<<< Updated upstream
=======

test("shared analytics request binds REEBS application and tenant context", () => {
  const request = buildSharedAnalyticsRequest({
    organizationId: 42,
    generatedAt: "2026-08-04T12:00:00.000Z",
    historyDays: 90,
    revenueSeries: [{ date: "2026-08-01", orderRevenueCents: 1000 }],
  });

  assert.equal(request.context.applicationId, "reebs");
  assert.equal(request.context.tenantId, "42");
  assert.equal(request.context.businessUnit, "REEBS_CORE");
  assert.equal(request.data.scope, "reebs-core");
  assert.equal(request.data.businessUnit, "REEBS_CORE");
  assert.equal(request.period.startAt, "2026-08-01T00:00:00.000Z");
  assert.equal(request.sourceTimestamp, "2026-08-04T12:00:00.000Z");
});

test("advanced analytics response is explicitly scoped to REEBS core", () => {
  const response = buildAdvancedAnalyticsResponse({
    result: { source: "node-fallback", forecast: { next30RevenueCents: 1000 } },
    snapshot: { organizationId: 42, generatedAt: "2026-08-04T12:00:00.000Z" },
    serviceMessage: "Built-in forecast",
  });

  assert.equal(response.scope, "reebs-core");
  assert.equal(response.businessUnit, "REEBS_CORE");
  assert.equal(response.organizationId, 42);
  assert.equal(response.service.mode, "fallback");
});

test("Water-linked products and Water-only customers cannot change the core analytics snapshot", async () => {
  const coreProduct = {
    id: 1,
    name: "Balloons",
    sourceCategoryCode: "SHOP",
    stock: 4,
    reorderLevel: 2,
    unitsOut90d: 12,
  };
  const waterProduct = {
    id: 2,
    name: "Water 15 pack",
    sourceCategoryCode: "water",
    stock: 100,
    reorderLevel: 20,
    unitsOut90d: 200,
  };
  const coreCustomer = { id: 10 };
  const waterOnlyCustomer = { id: 20 };
  const coreClient = createSnapshotClient({
    products: [coreProduct],
    customers: [coreCustomer],
    coreCustomerActivity: [coreCustomer.id, coreCustomer.id],
  });
  const mixedClient = createSnapshotClient({
    products: [coreProduct, waterProduct],
    customers: [coreCustomer, waterOnlyCustomer],
    coreCustomerActivity: [coreCustomer.id, coreCustomer.id],
  });

  const coreSnapshot = await loadAnalyticsSnapshot(coreClient, 42);
  const mixedSnapshot = await loadAnalyticsSnapshot(mixedClient, 42);

  assert.deepEqual(mixedSnapshot.inventory, coreSnapshot.inventory);
  assert.deepEqual(mixedSnapshot.customers, coreSnapshot.customers);
  assert.match(mixedClient.queries[0], /o\."orderDate"/);
  assert.match(mixedClient.queries[0], /"eventDate"::date/);
  assert.match(mixedClient.queries[0], /IN \('confirmed', 'completed'\)/);
  assert.match(mixedClient.queries[0], /= 'WATER'/);
  assert.doesNotMatch(mixedClient.queries[0], /SELECT "createdAt"::date/);
  assert.match(mixedClient.queries[2], /sourceCategoryCode/);
  assert.match(mixedClient.queries[2], /<> 'WATER'/);
  assert.match(mixedClient.queries[3], /FROM activity/);
  assert.match(mixedClient.queries[3], /= 'WATER'/);
  assert.match(mixedClient.queries[3], /IN \('confirmed', 'completed'\)/);
  assert.doesNotMatch(mixedClient.queries[3], /FROM "customer"/);
});
>>>>>>> Stashed changes
