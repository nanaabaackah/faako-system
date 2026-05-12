import { OFFLINE_CONFLICT_STATUSES } from "../constants/conflictStatuses.js";
import { SYNC_STATES } from "../constants/syncStates.js";
import { createRetryMetadata } from "../retry/retryMetadata.js";

const nowIso = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const resolveQueueItem = async (storage, itemOrId) => {
  if (!storage) return null;
  if (itemOrId && typeof itemOrId === "object") return itemOrId;
  if (!itemOrId || typeof storage.get !== "function") return null;
  return storage.get(itemOrId);
};

const patchQueueItem = async (storage, itemOrId, patch = {}) => {
  const item = await resolveQueueItem(storage, itemOrId);
  if (!item?.id) return undefined;
  if (typeof storage.patch === "function") return storage.patch(item.id, patch);
  if (typeof storage.updateStatus === "function") {
    return storage.updateStatus(item.id, patch.status || item.status, patch);
  }
  return undefined;
};

export const getQueueItemLastError = (item = {}) =>
  item.retry?.lastError || item.review?.lastError || item.lastError || "";

export const buildConflictMetadata = ({
  status = OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
  reason = "",
  code = "",
  detectedAt = new Date(),
  resolvedAt = "",
  resolution = "",
} = {}) => ({
  status,
  reason: String(reason || ""),
  code: String(code || ""),
  detectedAt: detectedAt ? nowIso(detectedAt) : "",
  resolvedAt: resolvedAt ? nowIso(resolvedAt) : "",
  resolution: String(resolution || ""),
});

export const markQueuedActionRetrying = async (storage, itemOrId, options = {}) => {
  const item = await resolveQueueItem(storage, itemOrId);
  if (!item?.id) return undefined;
  const now = nowIso(options.now);
  return patchQueueItem(storage, item, {
    status: SYNC_STATES.RETRYING,
    conflictStatus: OFFLINE_CONFLICT_STATUSES.NONE,
    retry: createRetryMetadata({
      ...item.retry,
      nextAttemptAt: "",
      lastError: options.lastError || "",
    }),
    review: {
      retryRequestedAt: now,
      lastError: options.lastError || "",
      note: options.note || "Retry requested. Existing app sync paths must validate this action server-side.",
    },
  });
};

export const retryQueuedAction = async (storage, itemOrId, options = {}) => {
  const item = await resolveQueueItem(storage, itemOrId);
  if (!item?.id) return undefined;
  const now = nowIso(options.now);
  return patchQueueItem(storage, item, {
    status: options.status || SYNC_STATES.PENDING,
    conflictStatus: OFFLINE_CONFLICT_STATUSES.NONE,
    retry: createRetryMetadata({
      ...item.retry,
      nextAttemptAt: "",
      lastError: options.lastError || "",
    }),
    review: {
      retryRequestedAt: now,
      lastError: options.lastError || "",
      note: options.note || "Retry requested. Server validation is still required before this action can complete.",
    },
  });
};

export const cancelQueuedAction = async (storage, itemOrId, options = {}) => {
  const now = nowIso(options.now);
  return patchQueueItem(storage, itemOrId, {
    status: SYNC_STATES.CANCELLED,
    conflictStatus: OFFLINE_CONFLICT_STATUSES.NONE,
    review: {
      cancelledAt: now,
      cancelReason: options.reason || "Cancelled during offline sync review.",
      lastError: "",
    },
  });
};

export const markQueuedActionResolved = async (storage, itemOrId, options = {}) => {
  const now = nowIso(options.now);
  return patchQueueItem(storage, itemOrId, {
    status: SYNC_STATES.RESOLVED,
    conflictStatus: OFFLINE_CONFLICT_STATUSES.RESOLVED,
    review: {
      resolvedAt: now,
      resolution: options.resolution || "Marked resolved during offline sync review.",
      lastError: "",
    },
  });
};
