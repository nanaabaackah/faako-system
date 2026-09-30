import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardPermissions,
  createAttentionItem,
  getDashboardWindow,
  sortAttentionItems,
} from "./dashboardPolicy.js";

test("dashboard windows use UTC boundaries and known keys", () => {
  const now = new Date("2026-08-30T15:30:00.000Z");
  assert.equal(getDashboardWindow("today", now).start.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.equal(getDashboardWindow("thisMonth", now).start.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(getDashboardWindow("unknown", now).key, "30d");
});

test("attention items exclude zero counts and sort by explicit severity", () => {
  const items = sortAttentionItems([
    createAttentionItem({ id: "low", severity: "warning", count: 3, label: "Low" }),
    createAttentionItem({ id: "none", severity: "critical", count: 0, label: "None" }),
    createAttentionItem({ id: "late", severity: "critical", count: 1, label: "Late" }),
  ]);
  assert.deepEqual(items.map((item) => item.id), ["late", "low"]);
});

test("dashboard permissions remain capability based", () => {
  const allowed = new Set(["orders:read", "customers:write"]);
  const result = buildDashboardPermissions(
    { role: "staff" },
    (_user, permission) => allowed.has(permission)
  );
  assert.equal(result.canReadOrders, true);
  assert.equal(result.canReadFinancials, false);
  assert.equal(result.canWriteCustomers, true);
  assert.equal(result.canViewSystemHealthDetail, false);
});

test("Water-only capability does not become Core dashboard access", () => {
  const result = buildDashboardPermissions(
    { role: "water" },
    (_user, permission) => permission === "water:read"
  );
  assert.equal(result.canReadWater, true);
  assert.equal(result.canReadOrders, false);
  assert.equal(result.canReadBookings, false);
  assert.equal(result.canReadInventory, false);
  assert.equal(result.canReadFinancials, false);
});
