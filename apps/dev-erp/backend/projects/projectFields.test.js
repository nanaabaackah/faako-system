import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectAccessWhere,
  buildProjectArchiveVisibilityWhere,
  buildProjectSearchWhere,
  isProjectDateRangeValid,
  normalizeProjectHealth,
  parseProjectDate,
  parseProjectProgressPercent,
  resolveProjectArchiveUpdate,
  serializeProject,
} from "./projectFields.js";

test("project progress accepts integer boundaries and defaults when omitted", () => {
  assert.equal(parseProjectProgressPercent(undefined), 0);
  assert.equal(parseProjectProgressPercent(0), 0);
  assert.equal(parseProjectProgressPercent("42"), 42);
  assert.equal(parseProjectProgressPercent(100), 100);
});

test("project progress rejects non-integers and values outside 0 to 100", () => {
  for (const value of [null, "", false, -1, 1.5, 101, "not-a-number"]) {
    assert.equal(parseProjectProgressPercent(value), null);
  }
});

test("project health accepts supported values and defaults when omitted", () => {
  assert.equal(normalizeProjectHealth(undefined), "ON_TRACK");
  assert.equal(normalizeProjectHealth("at_risk"), "AT_RISK");
  assert.equal(normalizeProjectHealth("BLOCKED"), "BLOCKED");
  assert.equal(normalizeProjectHealth("delayed"), null);
  assert.equal(normalizeProjectHealth(null), null);
});

test("project dates accept valid values and null but reject invalid values", () => {
  assert.equal(parseProjectDate(null).date, null);
  assert.equal(parseProjectDate("").date, null);
  assert.equal(parseProjectDate("2026-07-16").date.toISOString(), "2026-07-16T00:00:00.000Z");
  assert.match(parseProjectDate("not-a-date").error, /valid date/);
  assert.match(parseProjectDate("2026-02-30").error, /valid date/);
  assert.match(parseProjectDate(123).error, /valid date/);
});

test("project date ranges do not allow startDate after dueDate", () => {
  const startDate = new Date("2026-07-16T00:00:00.000Z");
  assert.equal(
    isProjectDateRangeValid({ startDate, dueDate: new Date("2026-07-16T00:00:00.000Z") }),
    true
  );
  assert.equal(
    isProjectDateRangeValid({ startDate, dueDate: new Date("2026-07-15T00:00:00.000Z") }),
    false
  );
  assert.equal(isProjectDateRangeValid({ startDate: null, dueDate: null }), true);
});

test("project access remains scoped to the user's organization", () => {
  assert.deepEqual(
    buildProjectAccessWhere({ projectId: 12, organizationId: 7 }),
    { id: 12, organizationId: 7 }
  );
  assert.deepEqual(
    buildProjectAccessWhere({ projectId: 12, organizationId: 7, globalAccess: true }),
    { id: 12 }
  );
});

test("project search matches titles and client names case-insensitively", () => {
  assert.deepEqual(buildProjectSearchWhere("  portal  "), {
    OR: [
      { title: { contains: "portal", mode: "insensitive" } },
      { clientName: { contains: "portal", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(buildProjectSearchWhere(""), {});
});

test("active project queries exclude archived records unless explicitly requested", () => {
  assert.deepEqual(buildProjectArchiveVisibilityWhere(), { archivedAt: null });
  assert.deepEqual(buildProjectArchiveVisibilityWhere(false), { archivedAt: null });
  assert.deepEqual(buildProjectArchiveVisibilityWhere(true), {});
});

test("project archive updates are idempotent and reversible", () => {
  const originalArchivedAt = new Date("2026-07-10T12:00:00.000Z");
  const now = new Date("2026-07-16T12:00:00.000Z");

  assert.deepEqual(
    resolveProjectArchiveUpdate({ archived: true, currentArchivedAt: null, now }),
    { provided: true, archivedAt: now }
  );
  assert.deepEqual(
    resolveProjectArchiveUpdate({ archived: true, currentArchivedAt: originalArchivedAt, now }),
    { provided: true, archivedAt: originalArchivedAt }
  );
  assert.deepEqual(
    resolveProjectArchiveUpdate({ archived: false, currentArchivedAt: originalArchivedAt, now }),
    { provided: true, archivedAt: null }
  );
});

test("project archive updates reject ambiguous or invalid values", () => {
  assert.match(resolveProjectArchiveUpdate({ archived: "false" }).error, /true or false/);
  assert.match(resolveProjectArchiveUpdate({ archivedAt: "not-a-date" }).error, /valid date/);
  assert.deepEqual(resolveProjectArchiveUpdate({}), { provided: false });
});

test("project serialization returns foundation fields and safe defaults", () => {
  const serialized = serializeProject({
    id: 1,
    organizationId: 7,
    ownerUserId: null,
    title: "Website refresh",
    clientName: null,
    projectType: "EXTERNAL",
    stage: "ACTIVE",
    priority: "HIGH",
    currency: null,
    budgetAmount: null,
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
    description: null,
    externalRef: null,
    archivedAt: null,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-02T12:00:00.000Z"),
  });

  assert.equal(serialized.startDate, "2026-07-01T00:00:00.000Z");
  assert.equal(serialized.dueDate, "2026-08-01T00:00:00.000Z");
  assert.equal(serialized.progressPercent, 0);
  assert.equal(serialized.health, "ON_TRACK");

  const explicitValues = serializeProject({
    ...serialized,
    startDate: null,
    dueDate: null,
    progressPercent: 65,
    health: "AT_RISK",
    createdAt: null,
    updatedAt: null,
  });
  assert.equal(explicitValues.progressPercent, 65);
  assert.equal(explicitValues.health, "AT_RISK");
});
