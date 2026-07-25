import assert from "node:assert/strict";
import test from "node:test";

import { createProjectTaskHandlers } from "./projectTasks.routes.js";
import { PROJECT_ACTIVITY_ACTIONS } from "./projectActivity.js";

const project = { id: 4, organizationId: 2, archivedAt: null };
const timestamp = new Date("2026-07-16T10:00:00.000Z");
const baseTask = {
  id: 9,
  organizationId: 2,
  projectId: 4,
  title: "Ship portal",
  description: null,
  status: "IN_PROGRESS",
  priority: "HIGH",
  assigneeUserId: null,
  assigneeUser: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
  archivedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};

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

const createPrisma = (overrides = {}) => {
  const calls = { projects: [], users: [], assignees: [], lists: [], details: [], creates: [], updates: [] };
  const defaults = {
    project: {
      findFirst: async (args) => {
        calls.projects.push(args);
        return project;
      },
    },
    user: {
      findFirst: async (args) => {
        calls.users.push(args);
        return { id: args.where.id };
      },
      findMany: async (args) => {
        calls.assignees.push(args);
        return [{ id: 1, fullName: "Nana", email: "nana@example.com" }];
      },
    },
    projectTask: {
      findMany: async (args) => {
        calls.lists.push(args);
        return [baseTask];
      },
      findFirst: async (args) => {
        calls.details.push(args);
        return baseTask;
      },
      create: async (args) => {
        calls.creates.push(args);
        return { ...baseTask, ...args.data, id: 10 };
      },
      update: async (args) => {
        calls.updates.push(args);
        return { ...baseTask, ...args.data };
      },
    },
  };
  const prisma = {
    ...defaults,
    ...overrides,
    project: { ...defaults.project, ...overrides.project },
    user: { ...defaults.user, ...overrides.user },
    projectTask: { ...defaults.projectTask, ...overrides.projectTask },
  };
  return { prisma, calls };
};

const createRequest = ({ params = {}, query = {}, body = {}, user = {} } = {}) => ({
  params,
  query,
  body,
  user: { userId: 1, organizationId: 2, roleName: "Admin", ...user },
});

test("task list resolves the parent project and excludes archived tasks", async () => {
  const { prisma, calls } = createPrisma();
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.list(createRequest({ params: { projectId: "4" } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tasks.length, 1);
  assert.deepEqual(calls.projects[0].where, { id: 4, organizationId: 2 });
  assert.deepEqual(calls.lists[0].where, {
    projectId: 4,
    organizationId: 2,
    archivedAt: null,
  });
});

test("task assignees are limited to active users in the project organization", async () => {
  const { prisma, calls } = createPrisma();
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.assignees(createRequest({ params: { projectId: "4" } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.assignees.length, 1);
  assert.deepEqual(calls.assignees[0].where, { organizationId: 2, status: "ACTIVE" });
});

test("task creation validates the assignee organization and completes DONE tasks", async () => {
  const { prisma, calls } = createPrisma();
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.create(
    createRequest({
      params: { projectId: "4" },
      body: {
        title: "  Launch portal  ",
        status: "DONE",
        priority: "URGENT",
        assigneeUserId: 7,
        startDate: "2026-07-01",
        dueDate: "2026-07-16",
      },
    }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls.users[0].where, { id: 7, organizationId: 2 });
  assert.equal(calls.creates[0].data.organizationId, 2);
  assert.equal(calls.creates[0].data.projectId, 4);
  assert.equal(calls.creates[0].data.title, "Launch portal");
  assert.equal(calls.creates[0].data.assigneeUserId, 7);
  assert.equal(calls.creates[0].data.completedAt instanceof Date, true);
});

test("task creation rejects an assignee outside the project organization", async () => {
  const { prisma, calls } = createPrisma({
    user: { findFirst: async () => null },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.create(
    createRequest({
      params: { projectId: "4" },
      body: { title: "Launch portal", assigneeUserId: 99 },
    }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /task organization/);
  assert.equal(calls.creates.length, 0);
});

test("task access returns not found when the parent project is outside scope", async () => {
  const { prisma, calls } = createPrisma({
    project: { findFirst: async () => null },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.detail(
    createRequest({ params: { projectId: "4", taskId: "9" } }),
    res
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Project not found.");
  assert.equal(calls.details.length, 0);
});

test("reopening a completed task clears completedAt through the status operation", async () => {
  const completedAt = new Date("2026-07-15T10:00:00.000Z");
  const { prisma, calls } = createPrisma({
    projectTask: {
      findFirst: async () => ({ ...baseTask, status: "DONE", completedAt }),
    },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.updateStatus(
    createRequest({
      params: { projectId: "4", taskId: "9" },
      body: { status: "TODO" },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.updates[0].data, { status: "TODO", completedAt: null });
  assert.equal(res.body.completedAt, null);
});

test("normal task updates validate and persist editable fields", async () => {
  const { prisma, calls } = createPrisma();
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.update(
    createRequest({
      params: { projectId: "4", taskId: "9" },
      body: {
        title: "  Updated task  ",
        description: "Delivery details",
        priority: "URGENT",
        assigneeUserId: 7,
        startDate: "2026-07-17",
        dueDate: "2026-07-20",
      },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].data.title, "Updated task");
  assert.equal(calls.updates[0].data.priority, "URGENT");
  assert.equal(calls.updates[0].data.assigneeUserId, 7);
  assert.equal(calls.updates[0].data.startDate.toISOString(), "2026-07-17T00:00:00.000Z");
  assert.equal(calls.updates[0].data.dueDate.toISOString(), "2026-07-20T00:00:00.000Z");
});

test("archived tasks reject normal updates but remain available to archive operations", async () => {
  const { prisma, calls } = createPrisma({
    projectTask: { findFirst: async () => ({ ...baseTask, archivedAt: timestamp }) },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.update(
    createRequest({
      params: { projectId: "4", taskId: "9" },
      body: { title: "Should not save" },
    }),
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Archived tasks/);
  assert.equal(calls.updates.length, 0);
});

test("archiving a task is idempotent and preserves the original timestamp", async () => {
  const archivedAt = new Date("2026-07-15T10:00:00.000Z");
  const { prisma, calls } = createPrisma({
    projectTask: {
      findFirst: async () => ({ ...baseTask, archivedAt }),
    },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.archive(
    createRequest({ params: { projectId: "4", taskId: "9" }, body: { archived: true } }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].data.archivedAt, archivedAt);
  assert.equal(res.body.archivedAt, "2026-07-15T10:00:00.000Z");
});

test("writes are rejected for archived projects", async () => {
  const { prisma, calls } = createPrisma({
    project: { findFirst: async () => ({ ...project, archivedAt: timestamp }) },
  });
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.create(
    createRequest({ params: { projectId: "4" }, body: { title: "New task" } }),
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Archived projects/);
  assert.equal(calls.creates.length, 0);
});

test("task status changes record the specific scoped activity after saving", async () => {
  const activity = [];
  const { prisma } = createPrisma();
  const handlers = createProjectTaskHandlers({
    prisma,
    isGlobalAdmin: () => false,
    recordActivity: async (entry) => activity.push(entry),
  });
  const res = createResponse();
  await handlers.updateStatus(
    createRequest({
      params: { projectId: "4", taskId: "9" },
      body: { status: "DONE" },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].action, PROJECT_ACTIVITY_ACTIONS.TASK_COMPLETED);
  assert.equal(activity[0].organizationId, 2);
  assert.equal(activity[0].project.id, 4);
  assert.equal(activity[0].task.id, 9);
});
