import test from "node:test";
import assert from "node:assert/strict";
import { decideIncidentTransition } from "./monitoring.incidents.js";

test("incident does not open before threshold or for unknown configuration", () => {
  assert.equal(decideIncidentTransition({ result: { status: "DOWN" }, recentChecks: [{ status: "DOWN" }], failureThreshold: 2 }).action, "none");
  assert.equal(decideIncidentTransition({ result: { status: "UNKNOWN" }, recentChecks: [{ status: "UNKNOWN" }] }).action, "none");
});

test("incident opens once, increments without duplicates, and resolves after recovery", () => {
  const open = decideIncidentTransition({ result: { status: "DOWN" }, recentChecks: [{ status: "DOWN" }, { status: "DOWN" }], failureThreshold: 2, critical: true });
  assert.deepEqual(open, { action: "open", failureCount: 2, severity: "CRITICAL" });
  const active = { id: 1, failureCount: 2 };
  assert.equal(decideIncidentTransition({ result: { status: "DOWN" }, recentChecks: [{ status: "DOWN" }, { status: "DOWN" }], activeIncident: active }).action, "increment");
  assert.equal(decideIncidentTransition({ result: { status: "HEALTHY" }, recentChecks: [{ status: "HEALTHY" }, { status: "HEALTHY" }], activeIncident: active, recoveryThreshold: 2 }).action, "resolve");
});
