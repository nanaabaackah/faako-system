import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPortalPayments, canAccessPortalRoute } from "./adminAccess.js";

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
