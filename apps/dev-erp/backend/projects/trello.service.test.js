import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  buildTrelloCardPayload,
  createTrelloSyncService,
  normalizeTrelloMappings,
  processTrelloWebhook,
  verifyTrelloWebhookSignature,
} from "./trello.service.js";

const mappings = Object.fromEntries([
  ["BACKLOG", "list-backlog"],
  ["TODO", "list-todo"],
  ["IN_PROGRESS", "list-progress"],
  ["REVIEW", "list-review"],
  ["BLOCKED", "list-blocked"],
  ["DONE", "list-done"],
].map(([status, listId]) => [status, { listId, listName: status }]));

const connection = {
  id: 3,
  organizationId: 2,
  status: "ACTIVE",
  statusMappings: mappings,
  apiKeyEncrypted: "key",
  apiTokenEncrypted: "token",
  appSecretEncrypted: "secret",
};

const task = {
  id: 9,
  organizationId: 2,
  projectId: 4,
  title: "Ship portal",
  description: "Delivery details",
  status: "IN_PROGRESS",
  dueDate: new Date("2026-07-20T00:00:00.000Z"),
  completedAt: null,
  archivedAt: null,
  trelloCardId: null,
  trelloCardUrl: null,
};

const secretCrypto = {
  encrypt: (value) => `encrypted:${value}`,
  decrypt: (value) => value,
};

test("Trello mappings require every task status and card payload stays limited", () => {
  assert.deepEqual(normalizeTrelloMappings(mappings), mappings);
  assert.equal(normalizeTrelloMappings({ BACKLOG: "one" }), null);
  assert.deepEqual(buildTrelloCardPayload(task, connection), {
    name: "Ship portal",
    desc: "Delivery details",
    due: "2026-07-20T00:00:00.000Z",
    dueComplete: false,
    idList: "list-progress",
  });
});

test("outbound sync creates one card, stores its reference, and reports success", async () => {
  const requests = [];
  const updates = [];
  const prisma = {
    projectTask: {
      findUnique: async () => ({ ...task, organization: { trelloConnection: connection } }),
      update: async (args) => {
        updates.push(args);
        return { ...task, ...args.data };
      },
    },
    trelloConnection: { update: async () => connection },
  };
  const service = createTrelloSyncService({
    prisma,
    secretCrypto,
    trelloClient: {
      request: async (path, options) => {
        requests.push({ path, options });
        return { id: "card-1", url: "https://trello.com/c/card-1" };
      },
    },
  });
  const result = await service.syncTask(9);

  assert.equal(result.synced, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "cards");
  assert.match(requests[0].options.clientIdentifier, /^dev-erp:3:9:/);
  assert.equal(updates[0].data.trelloCardId, "card-1");
  assert.equal(updates[0].data.trelloSyncStatus, "SYNCED");
});

test("outbound sync stores errors without throwing or removing the task", async () => {
  let updateData = null;
  const prisma = {
    projectTask: {
      findUnique: async () => ({ ...task, organization: { trelloConnection: connection } }),
      update: async ({ data }) => {
        updateData = data;
        return { ...task, ...data };
      },
    },
    trelloConnection: { update: async () => connection },
  };
  const service = createTrelloSyncService({
    prisma,
    secretCrypto,
    trelloClient: { request: async () => { throw new Error("Trello unavailable"); } },
  });
  const result = await service.syncTask(9);
  assert.equal(result.synced, false);
  assert.match(result.error, /unavailable/);
  assert.equal(updateData.trelloSyncStatus, "ERROR");
});

test("Trello webhook signatures use the exact raw body and callback URL", () => {
  const rawBody = Buffer.from('{"action":{"id":"action-1"}}');
  const callbackUrl = "https://api.example.com/api/webhooks/trello/3";
  const appSecret = "application-secret";
  const signature = crypto.createHmac("sha1", appSecret)
    .update(Buffer.concat([rawBody, Buffer.from(callbackUrl)]))
    .digest("base64");
  assert.equal(verifyTrelloWebhookSignature({ rawBody, callbackUrl, appSecret, signature }), true);
  assert.equal(verifyTrelloWebhookSignature({ rawBody, callbackUrl, appSecret, signature: "invalid" }), false);
});

test("inbound list and due changes update only linked task fields and store the event", async () => {
  const events = [];
  let taskUpdate = null;
  const prisma = {
    trelloWebhookEvent: {
      findUnique: async () => null,
      create: async ({ data }) => { events.push(data); return data; },
    },
    projectTask: {
      findFirst: async () => ({ ...task, trelloCardId: "card-1" }),
      update: async ({ data }) => { taskUpdate = data; return { ...task, ...data }; },
    },
    auditLog: { create: async ({ data }) => data },
  };
  const result = await processTrelloWebhook({
    prisma,
    connection,
    payload: {
      action: {
        id: "action-1",
        type: "updateCard",
        data: {
          card: { id: "card-1", due: "2026-07-28T12:00:00.000Z" },
          listAfter: { id: "list-review" },
        },
      },
    },
  });
  assert.equal(result.status, "PROCESSED");
  assert.equal(taskUpdate.status, "REVIEW");
  assert.equal(taskUpdate.dueDate.toISOString(), "2026-07-28T12:00:00.000Z");
  assert.equal(taskUpdate.trelloLastSyncSource, "TRELLO");
  assert.equal(events[0].status, "PROCESSED");
});

test("duplicate and Dev ERP-originated webhook actions are ignored safely", async () => {
  const prismaDuplicate = {
    trelloWebhookEvent: { findUnique: async () => ({ actionId: "action-1", status: "PROCESSED" }) },
  };
  assert.equal((await processTrelloWebhook({ prisma: prismaDuplicate, connection, payload: { action: { id: "action-1" } } })).duplicate, true);

  let ignoredEvent = null;
  const prismaLoop = {
    trelloWebhookEvent: {
      findUnique: async () => null,
      create: async ({ data }) => { ignoredEvent = data; return data; },
    },
    projectTask: { findFirst: async () => ({ ...task, trelloCardId: "card-1" }) },
  };
  const result = await processTrelloWebhook({
    prisma: prismaLoop,
    connection,
    payload: { action: { id: "action-2", type: "updateCard", data: { card: { id: "card-1" } } } },
    clientIdentifier: "dev-erp:3:9:123",
  });
  assert.equal(result.loopPrevented, true);
  assert.equal(ignoredEvent.status, "IGNORED");
});
