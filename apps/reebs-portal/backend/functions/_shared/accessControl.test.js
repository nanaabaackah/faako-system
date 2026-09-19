import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSeedActionsAllowed,
  hasPermission,
  normalizeRole,
} from "./accessControl.js";

test("normalizeRole maps retired aliases onto supported roles", () => {
  assert.equal(normalizeRole("Viewer"), "staff");
  assert.equal(normalizeRole("custodian"), "staff");
  assert.equal(normalizeRole("sales"), "staff");
});

test("hasPermission only grants scoped access to supported roles", () => {
  assert.equal(hasPermission({ role: "manager" }, "financials:read"), true);
  assert.equal(hasPermission({ role: "driver" }, "financials:read"), false);
  assert.equal(hasPermission({ role: "driver" }, "deliveries:write"), true);
  assert.equal(hasPermission({ role: "manager" }, "bookings:price_override"), true);
  assert.equal(hasPermission({ role: "staff" }, "bookings:price_override"), false);
});

test("core management access does not implicitly grant Water Business access", () => {
  assert.equal(hasPermission({ role: "manager" }, "water:read"), false);
  assert.equal(hasPermission({ role: "manager" }, "water:write"), false);
  assert.equal(hasPermission({ role: "water" }, "water:read"), true);
  assert.equal(hasPermission({ role: "water" }, "financials:read"), false);
});

test("assertSeedActionsAllowed blocks production even when SEED_ENABLED is true", () => {
  assert.throws(
    () =>
      assertSeedActionsAllowed({
        NODE_ENV: "production",
        SEED_ENABLED: "true",
      }),
    {
      message: "Seed actions are disabled in deployed environments.",
    }
  );
});

test("assertSeedActionsAllowed treats staging as a deployed environment", () => {
  assert.throws(
    () =>
      assertSeedActionsAllowed({
        APP_ENV: "staging",
        NODE_ENV: "production",
        SEED_ENABLED: "true",
      }),
    {
      message: "Seed actions are disabled in deployed environments.",
    }
  );
});

test("assertSeedActionsAllowed requires SEED_ENABLED outside production", () => {
  assert.throws(
    () =>
      assertSeedActionsAllowed({
        NODE_ENV: "development",
        SEED_ENABLED: "false",
      }),
    {
      message: "Seed actions are disabled. Set SEED_ENABLED=true to enable.",
    }
  );
});
