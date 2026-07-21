import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectTaskForm,
  buildProjectTaskPayload,
  getProjectTaskStatusLabel,
  validateProjectTaskForm,
} from "./projectTaskForm.js";

test("task form initializes defaults and reloads saved task values", () => {
  assert.deepEqual(buildProjectTaskForm(), {
    title: "",
    description: "",
    status: "BACKLOG",
    priority: "MEDIUM",
    assigneeUserId: "",
    startDate: "",
    dueDate: "",
  });
  const form = buildProjectTaskForm({
    title: "Ship portal",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assigneeUserId: 7,
    startDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-20T00:00:00.000Z",
  });
  assert.equal(form.assigneeUserId, "7");
  assert.equal(form.startDate, "2026-07-01");
  assert.equal(form.dueDate, "2026-07-20");
});

test("task form validates required titles and date order", () => {
  assert.match(validateProjectTaskForm(buildProjectTaskForm()), /required/);
  assert.match(
    validateProjectTaskForm({
      ...buildProjectTaskForm(),
      title: "Ship portal",
      startDate: "2026-07-21",
      dueDate: "2026-07-20",
    }),
    /cannot be after/
  );
});

test("task form builds typed payloads and readable status labels", () => {
  const payload = buildProjectTaskPayload({
    ...buildProjectTaskForm(),
    title: " Ship portal ",
    assigneeUserId: "7",
    dueDate: "2026-07-20",
  });
  assert.equal(payload.title, "Ship portal");
  assert.equal(payload.assigneeUserId, 7);
  assert.equal(payload.startDate, null);
  assert.equal(getProjectTaskStatusLabel("IN_PROGRESS"), "In progress");
});
