import test from "node:test";
import assert from "node:assert/strict";
import { INCIDENT_CAPABILITIES, INCIDENT_TRANSITIONS, createRequireIncidentCapability } from "./incident.constants.js";
import { calculateIncidentTargets, getIncidentBreaches } from "./incident.sla.js";
import { parseAssignmentPayload, parseResolutionPayload } from "./incident.validation.js";
import { buildIncidentCsv } from "./incident.export.js";

test("incident lifecycle permits only controlled transitions", () => {
  assert.equal(INCIDENT_TRANSITIONS.OPEN.has("ACKNOWLEDGED"), true);
  assert.equal(INCIDENT_TRANSITIONS.OPEN.has("CLOSED"), false);
  assert.equal(INCIDENT_TRANSITIONS.RESOLVED.has("OPEN"), true);
  assert.equal(INCIDENT_TRANSITIONS.CLOSED.has("ACKNOWLEDGED"), false);
});

test("response and resolution targets follow severity defaults and report breaches", () => {
  const targets = calculateIncidentTargets({ severity: "CRITICAL", startedAt: "2026-07-31T10:00:00Z" });
  assert.equal(targets.responseDueAt.toISOString(), "2026-07-31T10:15:00.000Z");
  assert.equal(targets.resolutionDueAt.toISOString(), "2026-07-31T12:00:00.000Z");
  assert.deepEqual(getIncidentBreaches({ status: "OPEN", responseDueAt: targets.responseDueAt, resolutionDueAt: targets.resolutionDueAt }, new Date("2026-07-31T12:01:00Z")), { response: true, resolution: true });
  assert.equal(calculateIncidentTargets({ severity: "INFO", startedAt: "2026-07-31T10:00:00Z" }).resolutionDueAt.toISOString(), "2026-08-05T10:00:00.000Z");
});

test("assignment and manual resolution validation are bounded", () => {
  assert.deepEqual(parseAssignmentPayload({ assignedUserId: 4 }), { assignedUserId: 4, assignedRoleId: null });
  assert.throws(() => parseAssignmentPayload({ assignedUserId: 4, assignedRoleId: 2 }), /either/i);
  assert.throws(() => parseResolutionPayload({ resolutionSummary: "" }), /required/i);
  assert.equal(parseResolutionPayload({ resolutionSummary: "Service restored" }).resolutionSummary, "Service restored");
});

test("incident authorization distinguishes viewing from management", () => {
  const middleware = createRequireIncidentCapability(INCIDENT_CAPABILITIES.ACKNOWLEDGE);
  let statusCode; let payload; let nextCalled = false;
  middleware({ user: { roleName: "Viewer", role: { permissions: { capabilities: ["INCIDENT_VIEW"] } } } }, { status(value) { statusCode = value; return this; }, json(value) { payload = value; } }, () => { nextCalled = true; });
  assert.equal(statusCode, 403); assert.equal(payload.requiredCapability, "INCIDENT_ACKNOWLEDGE"); assert.equal(nextCalled, false);
});

test("safe CSV export omits metadata and channel secrets", () => {
  const csv = buildIncidentCsv({ id: 8, severity: "WARNING", status: "RESOLVED", service: { name: "API", environment: "production" }, timeline: [{ createdAt: "2026-07-31T10:00:00Z", type: "NOTE_ADDED", summary: "Safe note", actorLabel: "Operator" }], metadata: { token: "secret" }, alertEvents: [{ rawPayload: "secret" }] });
  assert.equal(csv.includes("Safe note"), true);
  assert.equal(csv.includes("secret"), false);
});
