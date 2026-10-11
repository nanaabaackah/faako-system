import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPortalPayments,
  canAccessPortalRoute,
  canAccessWaterPortalArea,
  getPortalEntryPath,
} from "./adminAccess.js";

test("Payments navigation matches the server-authorized operational roles", () => {
  for (const role of ["owner", "admin", "manager", "staff", "sales"]) {
    assert.equal(canAccessPortalPayments(role), true, `${role} should see Payments`);
    assert.equal(canAccessPortalRoute(role, "/admin/payments"), true);
  }
  for (const role of ["warehouse", "driver", "water", "unknown"]) {
    assert.equal(canAccessPortalPayments(role), false, `${role} should not see Payments`);
    assert.equal(canAccessPortalRoute(role, "/admin/payments"), false);
  }
});

test("Customer routes retain driver read access but exclude Water-only and warehouse users", () => {
  for (const path of ["/admin/crm", "/admin/customers"]) {
    for (const role of ["owner", "admin", "manager", "staff", "driver"]) {
      assert.equal(canAccessPortalRoute(role, path), true);
    }
    for (const role of ["water", "warehouse", "unknown"]) {
      assert.equal(canAccessPortalRoute(role, path), false);
    }
  }
});

test("Water access allows Owners, REEBS Admins, existing Managers, and Water users only", () => {
  for (const role of ["owner", "admin", "manager", "water"]) {
    assert.equal(canAccessWaterPortalArea(role), true, `${role} should access Water`);
    assert.equal(canAccessPortalRoute(role, "/admin/water"), true);
  }
  for (const role of ["staff", "warehouse", "driver", "unknown"]) {
    assert.equal(canAccessWaterPortalArea(role), false, `${role} should not access Water`);
    assert.equal(canAccessPortalRoute(role, "/admin/water"), false);
  }
});

test("the standalone Water app uses its own origin and Water roles are redirected there", () => {
  assert.equal(getPortalEntryPath("water.reebspartythemes.com"), "https://water.reebspartythemes.com");
  assert.equal(getPortalEntryPath("WATER.REEBSPARTYTHEMES.COM"), "https://water.reebspartythemes.com");
  assert.equal(getPortalEntryPath("portal.reebspartythemes.com"), "/admin");
  assert.equal(getPortalEntryPath("portal.reebspartythemes.com", "water"), "https://water.reebspartythemes.com");
});
