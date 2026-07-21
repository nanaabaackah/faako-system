import assert from "node:assert/strict";
import test from "node:test";
import { buildHealthIncidents, getHealthSummaryState } from "./systemHealthDiagnostics.js";

test("buildHealthIncidents explains an HTTP server failure", () => {
  const incidents = buildHealthIncidents([
    {
      id: "api",
      label: "Orders API",
      kind: "api",
      status: "offline",
      checks: [{ label: "Health", status: "offline", httpStatus: 503, responseTimeMs: 91 }],
    },
  ]);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].severity, "critical");
  assert.match(incidents[0].likelyCause, /HTTP 503/);
  assert.equal(incidents[0].actions.length, 3);
  assert.match(incidents[0].evidence[0].label, /91ms/);
});

test("buildHealthIncidents turns missing URLs into monitoring coverage work", () => {
  const [incident] = buildHealthIncidents([
    { id: "internal", label: "Internal tool", status: "not_configured", checks: [] },
  ]);

  assert.equal(incident.severity, "coverage");
  assert.match(incident.likelyCause, /no deployed base URL/i);
});

test("getHealthSummaryState prioritizes critical incidents", () => {
  const summary = getHealthSummaryState([
    { severity: "coverage" },
    { severity: "warning" },
    { severity: "critical" },
  ]);

  assert.equal(summary.tone, "danger");
  assert.equal(summary.critical, 1);
  assert.equal(summary.warning, 1);
  assert.equal(summary.coverage, 1);
});
