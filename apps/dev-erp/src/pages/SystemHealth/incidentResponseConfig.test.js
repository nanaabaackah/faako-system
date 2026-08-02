import test from "node:test";
import assert from "node:assert/strict";
import { filterIncidents, summarizeIncidents } from "./incidentResponseConfig.js";

const incidents = [
  { id: 1, title: "API down", status: "OPEN", severity: "CRITICAL", service: { name: "Dev API" }, resolutionBreachedAt: new Date() },
  { id: 2, title: "Worker delayed", status: "ACKNOWLEDGED", severity: "WARNING", service: { name: "Queue" } },
  { id: 3, title: "Database recovered", status: "RESOLVED", severity: "CRITICAL", service: { name: "Database" } },
];

test("incident filters combine search, lifecycle status, and severity", () => {
  assert.deepEqual(filterIncidents(incidents, { search: "queue", status: "ACKNOWLEDGED", severity: "WARNING" }).map(({ id }) => id), [2]);
  assert.deepEqual(filterIncidents(incidents, { search: "", status: "all", severity: "CRITICAL" }).map(({ id }) => id), [1, 3]);
});

test("incident summary distinguishes active, unacknowledged, critical, and breached", () => {
  assert.deepEqual(summarizeIncidents(incidents), { active: 2, unacknowledged: 1, critical: 1, breached: 1 });
});
