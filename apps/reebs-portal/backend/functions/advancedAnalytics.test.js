import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackAnalytics,
  normalizeAnalyticsServiceUrl,
  resolveAnalyticsServiceUrl,
} from "./advancedAnalytics.js";

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

test("production analytics uses the deployed forecasting service by default", () => {
  assert.equal(
    resolveAnalyticsServiceUrl({ APP_ENV: "production" }),
    "https://reebs-service-production.up.railway.app"
  );
  assert.equal(resolveAnalyticsServiceUrl({ APP_ENV: "development" }), "");
});
