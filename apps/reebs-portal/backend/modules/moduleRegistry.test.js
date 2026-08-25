import assert from "node:assert/strict";
import test from "node:test";
import { backendModules } from "./index.js";

test("backend module registry contains the architecture foundation domains", () => {
  const domains = new Set(backendModules.map((module) => module.domain));
  for (const expected of [
    "dashboard", "bookings", "rentals", "orders", "customers", "inventory",
    "delivery", "invoicing", "accounting", "expenses", "hr", "maintenance",
    "marketing", "documents", "audit", "analytics", "water", "settings",
  ]) {
    assert.equal(domains.has(expected), true, `missing ${expected} module`);
  }
});

test("Water remains outside core analytics by default", () => {
  const water = backendModules.find((module) => module.domain === "water");
  const analytics = backendModules.find((module) => module.domain === "analytics");
  assert.equal(water.standaloneBusinessDomain, true);
  assert.equal(water.includedInCoreMetricsByDefault, false);
  assert.deepEqual(analytics.excludesDomains, ["water"]);
});
