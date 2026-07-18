import assert from "node:assert/strict";
import test from "node:test";

import { createTrelloHandlers } from "./trello.routes.js";

const statusMappings = Object.fromEntries([
  ["BACKLOG", "list-backlog"], ["TODO", "list-todo"], ["IN_PROGRESS", "list-progress"],
  ["REVIEW", "list-review"], ["BLOCKED", "list-blocked"], ["DONE", "list-done"],
].map(([status, listId]) => [status, { listId }]));

const lists = Object.entries(statusMappings).map(([status, mapping]) => ({
  id: mapping.listId,
  name: status,
}));

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("Trello connection save validates the board, encrypts credentials, and stores webhook identifiers", async () => {
  let upsertArgs = null;
  const webhookRequests = [];
  const prisma = {
    project: { findFirst: async () => ({ id: 4, organizationId: 2 }) },
    trelloConnection: {
      findUnique: async () => null,
      upsert: async (args) => {
        upsertArgs = args;
        return { id: 3, ...args.create, status: "ACTIVE", webhookId: null, webhookCallbackUrl: null };
      },
      update: async ({ data }) => ({ id: 3, ...upsertArgs.create, ...data, status: "ACTIVE" }),
    },
  };
  const handlers = createTrelloHandlers({
    prisma,
    isGlobalAdmin: () => false,
    secretCrypto: {
      encrypt: (value) => `encrypted:${value}`,
      decrypt: (value) => value.replace(/^encrypted:/, ""),
    },
    trelloClient: {
      discoverBoard: async () => ({
        board: { id: "board-1", name: "Delivery", url: "https://trello.com/b/board-1" },
        lists,
      }),
      request: async (path, options) => {
        webhookRequests.push({ path, options });
        return { id: "webhook-1" };
      },
    },
    trelloSync: { syncTask: async () => ({ synced: true }) },
    webhookBaseUrl: "https://api.example.com/api/webhooks/trello",
  });
  const res = createResponse();
  await handlers.save({
    params: { projectId: "4" },
    user: { userId: 7, organizationId: 2, roleName: "Admin" },
    body: { apiKey: "key", apiToken: "token", appSecret: "secret", boardId: "board-1", statusMappings },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(upsertArgs.create.apiKeyEncrypted, "encrypted:key");
  assert.equal(upsertArgs.create.apiTokenEncrypted, "encrypted:token");
  assert.equal(upsertArgs.create.appSecretEncrypted, "encrypted:secret");
  assert.equal(webhookRequests[0].path, "webhooks");
  assert.equal(webhookRequests[0].options.body.callbackURL, "https://api.example.com/api/webhooks/trello/3");
  assert.equal(res.body.connection.webhookId, "webhook-1");
  assert.equal(JSON.stringify(res.body).includes("encrypted:token"), false);
});

test("Trello connection configuration remains administrator-only", async () => {
  const handlers = createTrelloHandlers({
    prisma: {},
    isGlobalAdmin: () => false,
  });
  const res = createResponse();
  await handlers.save({ user: { roleName: "Member" }, body: {}, params: {} }, res);
  assert.equal(res.statusCode, 403);
});
