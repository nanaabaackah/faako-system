import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_ACTIVITY_ACTIONS,
  buildProjectActivityWhere,
  getTaskActivityActions,
  recordProjectActivity,
  serializeProjectActivity,
} from "./projectActivity.js";
import { createProjectActivityHandlers } from "./projectActivity.routes.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("project activity queries remain scoped to the project organization", () => {
  const where = buildProjectActivityWhere({ projectId: 4, organizationId: 2 });
  assert.equal(where.organizationId, 2);
  assert.deepEqual(where.OR[0], { targetType: "Project", targetId: "4" });
  assert.deepEqual(where.OR[1].metadata, { path: ["projectId"], equals: 4 });
  assert.ok(where.action.in.includes(PROJECT_ACTIVITY_ACTIONS.TASK_COMPLETED));
});

test("project activity records actor, project, and task references through audit logs", async () => {
  let createArgs = null;
  const prisma = {
    auditLog: {
      create: async (args) => {
        createArgs = args;
        return { id: 1, ...args.data };
      },
    },
  };
  await recordProjectActivity({
    prisma,
    req: { user: { userId: 7, fullName: "Nana" }, ip: "127.0.0.1", headers: {} },
    action: PROJECT_ACTIVITY_ACTIONS.TASK_CREATED,
    organizationId: 2,
    project: { id: 4, title: "Portal" },
    task: { id: 9, title: "Ship portal" },
    summary: "Created task Ship portal.",
  });

  assert.equal(createArgs.data.organizationId, 2);
  assert.equal(createArgs.data.userId, 7);
  assert.equal(createArgs.data.targetType, "ProjectTask");
  assert.equal(createArgs.data.metadata.projectId, 4);
  assert.equal(createArgs.data.metadata.taskId, 9);
  assert.equal(createArgs.data.actorLabel, "Nana");
});

test("task activity classifies completion, reopening, assignment, and normal updates", () => {
  assert.deepEqual(
    getTaskActivityActions({
      previousTask: { status: "IN_PROGRESS", assigneeUserId: null },
      updatedTask: { status: "DONE", assigneeUserId: 7 },
      changedFields: ["title"],
    }),
    [
      PROJECT_ACTIVITY_ACTIONS.TASK_COMPLETED,
      PROJECT_ACTIVITY_ACTIONS.TASK_ASSIGNED,
      PROJECT_ACTIVITY_ACTIONS.TASK_UPDATED,
    ]
  );
  assert.deepEqual(
    getTaskActivityActions({
      previousTask: { status: "DONE", assigneeUserId: 7 },
      updatedTask: { status: "TODO", assigneeUserId: 7 },
    }),
    [PROJECT_ACTIVITY_ACTIONS.TASK_REOPENED]
  );
});

test("project activity serialization exposes limited timeline fields", () => {
  const serialized = serializeProjectActivity({
    id: 3,
    action: "TASK_ASSIGNED",
    summary: "Assigned Ship portal to Nana.",
    userId: 7,
    actorLabel: "Nana",
    metadata: { projectId: 4, taskId: 9, taskTitle: "Ship portal", assigneeUserId: 7 },
    createdAt: new Date("2026-07-17T12:00:00.000Z"),
  });
  assert.deepEqual(serialized.task, { id: 9, title: "Ship portal" });
  assert.deepEqual(serialized.actor, { userId: 7, label: "Nana" });
  assert.equal(serialized.projectId, 4);
});

test("project activity endpoint resolves the scoped parent before reading recent events", async () => {
  const calls = { project: [], activity: [] };
  const prisma = {
    project: {
      findFirst: async (args) => {
        calls.project.push(args);
        return { id: 4, organizationId: 2 };
      },
    },
    auditLog: {
      findMany: async (args) => {
        calls.activity.push(args);
        return [];
      },
    },
  };
  const handlers = createProjectActivityHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.list(
    { params: { projectId: "4" }, user: { organizationId: 2 } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.project[0].where, { id: 4, organizationId: 2 });
  assert.equal(calls.activity[0].where.organizationId, 2);
  assert.equal(calls.activity[0].take, 50);
  assert.deepEqual(calls.activity[0].orderBy, { createdAt: "desc" });
});

test("project activity endpoint blocks cross-organization project access", async () => {
  const prisma = {
    project: { findFirst: async () => null },
    auditLog: { findMany: async () => assert.fail("activity should not be queried") },
  };
  const handlers = createProjectActivityHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.list(
    { params: { projectId: "4" }, user: { organizationId: 2 } },
    res
  );
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Project not found.");
});
