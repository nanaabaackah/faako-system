import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
  buildScopedDraftKey,
  buildSyncStatusSummary,
  clearLocalDraft,
  createMemoryQueueStorage,
  createQueueItem,
  createRetryMetadata,
  listLocalDrafts,
  readLocalDraft,
  getAggregateSyncStatus,
  incrementRetryMetadata,
  shouldRetryQueueItem,
  writeLocalDraft,
} from "../src/index.js";

const createStorage = () => {
  const records = new Map();
  return {
    get length() {
      return records.size;
    },
    getItem(key) {
      return records.has(key) ? records.get(key) : null;
    },
    setItem(key, value) {
      records.set(key, String(value));
    },
    removeItem(key) {
      records.delete(key);
    },
    key(index) {
      return Array.from(records.keys())[index] || null;
    },
  };
};

test("queue items default to pending and preserve app context", () => {
  const item = createQueueItem({
    actionType: OFFLINE_QUEUE_ACTION_TYPES.CREATE_POS_ORDER,
    sourceApp: "reebs-portal",
    organizationId: "org_1",
    actorId: "user_1",
    payload: { draft: true },
  });

  assert.equal(item.status, SYNC_STATES.PENDING);
  assert.equal(item.sourceApp, "reebs-portal");
  assert.equal(item.organizationId, "org_1");
  assert.deepEqual(item.payload, { draft: true });
});

test("memory queue storage supports inert local queue operations", async () => {
  const storage = createMemoryQueueStorage();
  const item = await storage.put({
    id: "offline-1",
    actionType: OFFLINE_QUEUE_ACTION_TYPES.CREATE_CUSTOMER,
  });
  assert.equal(item.id, "offline-1");
  assert.equal((await storage.list()).length, 1);
  const updated = await storage.updateStatus("offline-1", SYNC_STATES.NEEDS_REVIEW);
  assert.equal(updated.status, SYNC_STATES.NEEDS_REVIEW);
  await storage.remove("offline-1");
  assert.equal((await storage.list()).length, 0);
});

test("retry metadata increments safely with exponential delay", () => {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const retry = incrementRetryMetadata(createRetryMetadata({ maxAttempts: 2 }), {
    now,
    baseDelayMs: 1000,
    lastError: "Network unavailable",
  });

  assert.equal(retry.attempts, 1);
  assert.equal(retry.firstAttemptAt, now.toISOString());
  assert.equal(retry.lastError, "Network unavailable");
  assert.equal(shouldRetryQueueItem({ retry }, { now }), false);
  assert.equal(shouldRetryQueueItem({ retry }, { now: new Date(retry.nextAttemptAt) }), true);
});

test("aggregate status keeps conflicts and failures visible", () => {
  assert.equal(getAggregateSyncStatus({ online: true, conflictCount: 1 }), SYNC_STATES.NEEDS_REVIEW);
  assert.equal(getAggregateSyncStatus({ online: true, failedCount: 1 }), SYNC_STATES.FAILED);
  assert.equal(getAggregateSyncStatus({ online: false, pendingCount: 0 }), SYNC_STATES.OFFLINE);
  assert.equal(buildSyncStatusSummary({ online: true, pendingCount: 2 }).status, SYNC_STATES.PENDING);
});

test("local drafts are scoped and never marked for production sync", () => {
  const storage = createStorage();
  const key = buildScopedDraftKey({
    sourceApp: "reebs-portal",
    organizationId: 12,
    actorId: 34,
    draftType: "manual-payment",
    recordId: "order-56",
  });

  const saved = writeLocalDraft(
    key,
    { amount: "45.00", method: "cash" },
    {
      storage,
      metadata: {
        sourceApp: "reebs-portal",
        organizationId: 12,
        actorId: 34,
        draftType: "manual-payment",
        recordId: "order-56",
      },
    }
  );

  assert.equal(saved.metadata.syncEnabled, false);
  assert.deepEqual(readLocalDraft(key, { storage }).data, { amount: "45.00", method: "cash" });
  assert.equal(listLocalDrafts({ storage }).length, 1);
  clearLocalDraft(key, { storage });
  assert.equal(readLocalDraft(key, { storage }), null);
});
