import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_PRODUCT_FILTER,
  buildCoreBookingFilter,
  buildCoreOrderFilter,
  fetchDashboardOverview,
} from "./dashboardRepository.js";

test("core product scope explicitly excludes Water category and configuration", () => {
  assert.match(CORE_PRODUCT_FILTER, /sourceCategoryCode/);
  assert.match(CORE_PRODUCT_FILTER, /<> 'WATER'/);
  assert.match(CORE_PRODUCT_FILTER, /waterProductConfig/);
});

test("activity uses the selected period and failed widgets cannot masquerade as zero or all-clear", async () => {
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-02T00:00:00Z") };
  const failures = [];
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push(sql);
    if (sql.includes("information_schema")) return { rows: [] };
    if (sql.includes("AS open_orders")) throw new Error("Private SQL diagnostic");
    if (sql.includes("FROM \"orderEvent\"")) {
      assert.deepEqual(params, [7, window.start.toISOString(), window.end.toISOString()]);
      assert.match(sql, /oe\."createdAt" >= \$2 AND oe\."createdAt" < \$3/);
      assert.match(sql, /LIMIT 8/);
    }
    return { rows: [] };
  } };
  const result = await fetchDashboardOverview({ client, organizationId: 7, window,
    permissions: { canReadOrders: true }, onWidgetError: (widget) => failures.push(widget) });
  assert.deepEqual(result.unavailable, ["orders"]);
  assert.deepEqual(failures, ["orders"]);
  assert.equal(result.summary.orders, null);
  assert.equal(result.summary.payments, null);
  assert.equal(calls.some((sql) => sql.includes('FROM "paymentRecord"')), false);
  assert.doesNotMatch(JSON.stringify(result), /Private SQL/);
});

test("core order scope uses business unit when deployed and still excludes Water items", () => {
  const columns = { order: new Set(["businessUnit"]) };
  const filter = buildCoreOrderFilter(columns, "orders_alias");
  assert.match(filter, /REEBS_CORE/);
  assert.match(filter, /waterProductConfig/);
  assert.match(filter, /orders_alias/);
});

test("operational-only dashboard responses exclude financial values at the server boundary", async () => {
  const client = { query: async (sql) => ({ rows: sql.includes("AS open_orders")
    ? [{ open_orders: 2, outstanding_cents: 99000, reconciliation_count: 3 }] : [] }) };
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-02T00:00:00Z") };
  const result = await fetchDashboardOverview({ client, organizationId: 7, window,
    permissions: { canReadOrders: true, canReadFinancials: false } });
  assert.equal(result.summary.orders.open, 2);
  assert.equal(Object.hasOwn(result.summary.orders, "outstandingCents"), false);
  assert.equal(Object.hasOwn(result.summary.orders, "reconciliationCount"), false);
  assert.equal(result.summary.payments, null);
  const authorized = await fetchDashboardOverview({ client, organizationId: 7, window,
    permissions: { canReadOrders: true, canReadFinancials: true } });
  assert.equal(authorized.summary.orders.outstandingCents, 99000);
});

test("core booking scope excludes bookings containing Water-configured products", () => {
  const filter = buildCoreBookingFilter("booking_alias");
  assert.match(filter, /bookingItem/);
  assert.match(filter, /waterProductConfig/);
  assert.match(filter, /booking_alias/);
});
