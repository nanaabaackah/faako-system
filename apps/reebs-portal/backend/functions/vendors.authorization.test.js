import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessVendorsMethod,
  requiredVendorsPermission,
} from "./vendors.js";

test("vendors endpoint maps reads and mutations to shared permission identifiers", () => {
  assert.equal(requiredVendorsPermission("GET"), "vendors:read");
  assert.equal(requiredVendorsPermission("POST"), "vendors:write");
  assert.equal(requiredVendorsPermission("PUT"), "vendors:write");
  assert.equal(requiredVendorsPermission("PATCH"), "vendors:write");
});

test("vendors endpoint preserves established owner, admin, and manager access", () => {
  for (const role of ["owner", "admin", "manager"]) {
    assert.equal(canAccessVendorsMethod({ role }, "GET"), true);
    assert.equal(canAccessVendorsMethod({ role }, "POST"), true);
  }
});

test("vendors endpoint denies roles without vendor permissions", () => {
  for (const role of ["staff", "driver", "warehouse", "water"]) {
    assert.equal(canAccessVendorsMethod({ role }, "GET"), false);
    assert.equal(canAccessVendorsMethod({ role }, "POST"), false);
  }
});
