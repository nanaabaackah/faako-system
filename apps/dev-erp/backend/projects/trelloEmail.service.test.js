import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrelloEmailCard,
  createTrelloEmailSyncService,
} from "./trelloEmail.service.js";

test("buildTrelloEmailCard creates a Trello-safe task email", () => {
  const card = buildTrelloEmailCard({
    id: 42,
    title: "Ship monitoring bars",
    description: "Show one horizontal signal per API and database.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: new Date("2026-07-30T00:00:00.000Z"),
    project: { title: "Dev ERP" },
    assigneeUser: { fullName: "Nana" },
  });

  assert.equal(card.subject, "Ship monitoring bars");
  assert.match(card.text, /Project: Dev ERP/);
  assert.match(card.text, /Status: IN PROGRESS/);
  assert.match(card.text, /Due date: 2026-07-30/);
  assert.match(card.text, /Dev ERP task: #42/);
});

test("email sync sends a task once and records delivery", async () => {
  const updates = [];
  const sent = [];
  const task = {
    id: 42,
    title: "Email this task",
    status: "BACKLOG",
    priority: "MEDIUM",
    archivedAt: null,
    trelloSyncStatus: "NOT_LINKED",
    project: { id: 7, title: "Dev ERP" },
    assigneeUser: null,
  };
  const service = createTrelloEmailSyncService({
    configured: true,
    sendEmailToBoard: async (message) => sent.push(message),
    prisma: {
      projectTask: {
        findUnique: async () => task,
        update: async ({ data }) => {
          updates.push(data);
          return { ...task, ...data };
        },
      },
    },
  });

  const result = await service.syncTask(42);

  assert.equal(result.synced, true);
  assert.equal(sent.length, 1);
  assert.equal(updates[0].trelloSyncStatus, "SYNCED");
  assert.equal(updates[0].trelloLastSyncSource, "DEV_ERP");
});

test("email sync does not create duplicate Trello cards", async () => {
  const service = createTrelloEmailSyncService({
    configured: true,
    sendEmailToBoard: async () => assert.fail("email should not be sent"),
    prisma: {
      projectTask: {
        findUnique: async () => ({
          id: 42,
          archivedAt: null,
          trelloSyncStatus: "SYNCED",
          project: { id: 7, title: "Dev ERP" },
          assigneeUser: null,
        }),
      },
    },
  });

  const result = await service.syncTask(42);

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "already_delivered");
});
