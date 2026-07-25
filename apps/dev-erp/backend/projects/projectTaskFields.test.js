import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectTaskAccessWhere,
  buildProjectTaskListWhere,
  normalizeProjectTaskPriority,
  normalizeProjectTaskStatus,
  normalizeProjectTaskText,
  parseProjectTaskDates,
  parseProjectTaskId,
  resolveProjectTaskArchiveUpdate,
  resolveProjectTaskCompletion,
  serializeProjectTask,
} from "./projectTaskFields.js";

test("project task identifiers, text, status, and priority are normalized", () => {
  assert.equal(parseProjectTaskId("12"), 12);
  assert.equal(parseProjectTaskId(0), null);
  assert.equal(normalizeProjectTaskText("  Ship portal  ", { nullable: false }), "Ship portal");
  assert.equal(normalizeProjectTaskStatus("in_progress"), "IN_PROGRESS");
  assert.equal(normalizeProjectTaskStatus("waiting"), null);
  assert.equal(normalizeProjectTaskStatus(null), null);
  assert.equal(normalizeProjectTaskPriority("urgent"), "URGENT");
  assert.equal(normalizeProjectTaskPriority("critical"), null);
  assert.equal(normalizeProjectTaskPriority(null), null);
});

test("project task access and active lists remain organization and project scoped", () => {
  assert.deepEqual(
    buildProjectTaskAccessWhere({ taskId: 9, projectId: 4, organizationId: 2 }),
    { id: 9, projectId: 4, organizationId: 2 }
  );
  assert.deepEqual(
    buildProjectTaskListWhere({ projectId: 4, organizationId: 2 }),
    { projectId: 4, organizationId: 2, archivedAt: null }
  );
  assert.deepEqual(
    buildProjectTaskListWhere({ projectId: 4, organizationId: 2, includeArchived: true }),
    { projectId: 4, organizationId: 2 }
  );
});

test("project task dates reject invalid ranges", () => {
  const valid = parseProjectTaskDates({ startDate: "2026-07-01", dueDate: "2026-07-02" });
  assert.equal(valid.startDate.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(valid.dueDate.toISOString(), "2026-07-02T00:00:00.000Z");
  assert.match(
    parseProjectTaskDates({ startDate: "2026-07-03", dueDate: "2026-07-02" }).error,
    /cannot be later/
  );
  assert.match(parseProjectTaskDates({ startDate: "invalid" }).error, /valid date/);
});

test("project task completion is set, preserved, and cleared by status", () => {
  const completedAt = new Date("2026-07-10T10:00:00.000Z");
  const now = new Date("2026-07-16T10:00:00.000Z");
  assert.equal(resolveProjectTaskCompletion({ status: "DONE", now }), now);
  assert.equal(
    resolveProjectTaskCompletion({ status: "DONE", currentCompletedAt: completedAt, now }),
    completedAt
  );
  assert.equal(
    resolveProjectTaskCompletion({ status: "IN_PROGRESS", currentCompletedAt: completedAt, now }),
    null
  );
});

test("project task archive updates preserve an existing timestamp", () => {
  const archivedAt = new Date("2026-07-10T10:00:00.000Z");
  const result = resolveProjectTaskArchiveUpdate({
    archived: true,
    currentArchivedAt: archivedAt,
    now: new Date("2026-07-16T10:00:00.000Z"),
  });
  assert.equal(result.archivedAt, archivedAt);
  assert.equal(resolveProjectTaskArchiveUpdate({ archived: false }).archivedAt, null);
});

test("project task serialization includes safe assignee and timestamp values", () => {
  const serialized = serializeProjectTask({
    id: 9,
    organizationId: 2,
    projectId: 4,
    title: "Ship portal",
    description: null,
    status: "DONE",
    priority: "HIGH",
    assigneeUserId: 7,
    assigneeUser: { id: 7, fullName: "Nana", email: "nana@example.com" },
    startDate: null,
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    completedAt: new Date("2026-07-16T10:00:00.000Z"),
    archivedAt: null,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-16T10:00:00.000Z"),
  });
  assert.equal(serialized.assigneeUser.fullName, "Nana");
  assert.equal(serialized.dueDate, "2026-07-20T00:00:00.000Z");
  assert.equal(serialized.completedAt, "2026-07-16T10:00:00.000Z");
});
