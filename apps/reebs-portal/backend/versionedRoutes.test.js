import assert from "node:assert/strict";
import test from "node:test";
import { REEBS_V1_HANDLER_ALIASES, resolveReebsV1Handler } from "./versionedRoutes.js";

test("stable v1 routes resolve to existing compatibility handlers", () => {
  assert.equal(resolveReebsV1Handler("/api/v1/auth/login"), "login");
  assert.equal(resolveReebsV1Handler("/api/v1/bookings"), "bookings");
  assert.equal(resolveReebsV1Handler("/api/v1/checkout/quote"), "checkoutQuote");
  assert.equal(resolveReebsV1Handler("/api/v1/checkout/orders"), "createOrder");
  assert.equal(
    resolveReebsV1Handler("/api/v1/commercial-config/public"),
    "publicCommercialConfig"
  );
  assert.equal(resolveReebsV1Handler("/api/v1/commercial-config"), "commercial-config");
  assert.equal(resolveReebsV1Handler("/api/v1/portal-settings"), "portal-settings");
  assert.equal(resolveReebsV1Handler("/api/v1/water"), null);
  assert.equal(Object.isFrozen(REEBS_V1_HANDLER_ALIASES), true);
});
