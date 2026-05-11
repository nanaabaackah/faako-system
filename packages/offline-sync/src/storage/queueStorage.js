import { OFFLINE_CONFLICT_STATUSES } from "../constants/conflictStatuses.js";
import { SYNC_STATES } from "../constants/syncStates.js";
import { createRetryMetadata } from "../retry/retryMetadata.js";
import { withOfflineStore } from "./indexedDb.js";

const nowIso = () => new Date().toISOString();

export const createQueueItem = (item = {}) => {
  const timestamp = item.createdAt || nowIso();
  return {
    id: item.id || `offline-${timestamp}-${Math.random().toString(16).slice(2, 10)}`,
    actionType: item.actionType || "",
    sourceApp: item.sourceApp || "",
    organizationId: item.organizationId || "",
    actorId: item.actorId || "",
    payload: item.payload && typeof item.payload === "object" ? { ...item.payload } : {},
    status: item.status || SYNC_STATES.PENDING,
    conflictStatus: item.conflictStatus || OFFLINE_CONFLICT_STATUSES.NONE,
    retry: createRetryMetadata(item.retry),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp,
    lastAttemptAt: item.lastAttemptAt || "",
  };
};

const requestToPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline queue request failed."));
  });

export const createIndexedDbQueueStorage = (options = {}) => ({
  async put(item) {
    const queueItem = createQueueItem(item);
    await withOfflineStore("readwrite", (store) => {
      store.put({ ...queueItem, updatedAt: nowIso() });
    }, options);
    return queueItem;
  },

  async get(id) {
    return withOfflineStore("readonly", (store) => requestToPromise(store.get(id)), options);
  },

  async list() {
    return withOfflineStore("readonly", (store) => requestToPromise(store.getAll()), options);
  },

  async remove(id) {
    await withOfflineStore("readwrite", (store) => {
      store.delete(id);
    }, options);
  },

  async clear() {
    await withOfflineStore("readwrite", (store) => {
      store.clear();
    }, options);
  },

  async updateStatus(id, status, patch = {}) {
    const current = await this.get(id);
    if (!current) return undefined;
    const next = {
      ...current,
      ...patch,
      status,
      updatedAt: nowIso(),
    };
    await this.put(next);
    return next;
  },
});

export const createMemoryQueueStorage = (initialItems = []) => {
  const records = new Map(initialItems.map((item) => {
    const queueItem = createQueueItem(item);
    return [queueItem.id, queueItem];
  }));

  return {
    async put(item) {
      const queueItem = createQueueItem(item);
      records.set(queueItem.id, { ...queueItem, updatedAt: nowIso() });
      return records.get(queueItem.id);
    },
    async get(id) {
      return records.get(id);
    },
    async list() {
      return Array.from(records.values());
    },
    async remove(id) {
      records.delete(id);
    },
    async clear() {
      records.clear();
    },
    async updateStatus(id, status, patch = {}) {
      const current = records.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch, status, updatedAt: nowIso() };
      records.set(id, next);
      return next;
    },
  };
};
