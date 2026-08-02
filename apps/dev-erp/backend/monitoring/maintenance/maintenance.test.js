import test from "node:test";
import assert from "node:assert/strict";
import { parseMaintenancePayload } from "./maintenance.validation.js";

test("maintenance validation requires a target and valid bounded interval", () => {
  assert.throws(() => parseMaintenancePayload({ name: "No target", startsAt: "2026-08-01T10:00:00Z", endsAt: "2026-08-01T11:00:00Z" }), /target/i);
  assert.throws(() => parseMaintenancePayload({ name: "Staging", environment: "staging", startsAt: "2026-08-01T10:00:00Z", endsAt: "2026-08-01T11:00:00Z" }), /development or production/i);
  const value = parseMaintenancePayload({ name: "API deploy", category: "api", environment: "production", startsAt: "2026-08-01T10:00:00Z", endsAt: "2026-08-01T11:00:00Z" });
  assert.equal(value.category, "API"); assert.equal(value.environment, "production");
});
