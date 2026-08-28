import assert from "node:assert/strict";
import test from "node:test";
import {
  REEBS_NAVIGATION_GROUP_BY_KEY,
  REEBS_NAVIGATION_GROUPS,
  getReebsNavigationOrder,
} from "./adminNavigationHierarchy.js";

test("portal navigation follows the Phase 2 business hierarchy", () => {
  assert.deepEqual(REEBS_NAVIGATION_GROUPS, [
    "Overview",
    "Sales & Rentals",
    "Operations",
    "Finance",
    "People & Growth",
    "Water Business",
    "Administration",
  ]);
  assert.equal(REEBS_NAVIGATION_GROUP_BY_KEY.documents, "Operations");
  assert.equal(REEBS_NAVIGATION_GROUP_BY_KEY.customers, "Sales & Rentals");
  assert.equal(REEBS_NAVIGATION_GROUP_BY_KEY.water, "Water Business");
});

test("Water remains separate and core task order is intentional", () => {
  const coreDomains = ["home", "bookings", "rentals", "orders", "inventory", "accounting"];
  assert.equal(coreDomains.some((key) => REEBS_NAVIGATION_GROUP_BY_KEY[key] === "Water Business"), false);
  assert.ok(getReebsNavigationOrder("bookings") < getReebsNavigationOrder("rentals"));
  assert.ok(getReebsNavigationOrder("rentals") < getReebsNavigationOrder("orders"));
  assert.ok(getReebsNavigationOrder("inventory") < getReebsNavigationOrder("documents"));
});
