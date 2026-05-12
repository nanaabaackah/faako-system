import { OFFLINE_CONFLICT_STATUSES } from "../constants/conflictStatuses.js";
import { OFFLINE_QUEUE_ACTION_LABELS } from "../constants/queueActionTypes.js";
import { SYNC_STATES } from "../constants/syncStates.js";
import { getQueueItemLastError } from "../storage/queueActions.js";

export const REVIEWABLE_SYNC_STATES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.FAILED,
  SYNC_STATES.CONFLICT,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.RETRYING,
]);

export const CLOSED_SYNC_STATES = new Set([
  SYNC_STATES.SYNCED,
  SYNC_STATES.CANCELLED,
  SYNC_STATES.RESOLVED,
]);

export const filterQueueItemsByScope = (
  items = [],
  { sourceApp = "", organizationId = "", actorId = "", requireScope = false } = {}
) => {
  if (requireScope && (!sourceApp || !organizationId || !actorId)) return [];
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (sourceApp && String(item?.sourceApp || "") !== String(sourceApp)) return false;
    if (organizationId && String(item?.organizationId || "") !== String(organizationId)) return false;
    if (actorId && String(item?.actorId || "") !== String(actorId)) return false;
    return true;
  });
};

export const isQueueItemConflictLike = (item = {}) =>
  item.status === SYNC_STATES.CONFLICT ||
  item.status === SYNC_STATES.NEEDS_REVIEW ||
  item.conflictStatus === OFFLINE_CONFLICT_STATUSES.DETECTED ||
  item.conflictStatus === OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW;

export const getQueueActionLabel = (item = {}) =>
  OFFLINE_QUEUE_ACTION_LABELS[item.actionType] ||
  String(item.actionType || "Queued action").replace(/_/g, " ").toLowerCase();

export const getQueueItemDisplayMeta = (item = {}) => {
  const metadata = item.payload?.metadata && typeof item.payload.metadata === "object"
    ? item.payload.metadata
    : {};
  return {
    title:
      metadata.orderNumber ||
      metadata.itemName ||
      metadata.customerName ||
      metadata.tenantName ||
      getQueueActionLabel(item),
    targetType: item.payload?.targetType || "",
    targetId: item.payload?.targetId || "",
    source: item.payload?.source || "",
    queuedAt: item.payload?.queuedAt || item.createdAt || "",
    lastError: getQueueItemLastError(item),
  };
};

export const buildQueueSummaryCounts = (items = [], options = {}) => {
  const scopedItems = filterQueueItemsByScope(items, options);
  const counts = {
    total: scopedItems.length,
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    needsReview: 0,
    retrying: 0,
    synced: 0,
    cancelled: 0,
    resolved: 0,
    reviewable: 0,
    closed: 0,
  };

  scopedItems.forEach((item) => {
    if (item.status === SYNC_STATES.PENDING) counts.pending += 1;
    if (item.status === SYNC_STATES.SYNCING) counts.syncing += 1;
    if (item.status === SYNC_STATES.FAILED) counts.failed += 1;
    if (item.status === SYNC_STATES.CONFLICT) counts.conflict += 1;
    if (item.status === SYNC_STATES.NEEDS_REVIEW) counts.needsReview += 1;
    if (item.status === SYNC_STATES.RETRYING) counts.retrying += 1;
    if (item.status === SYNC_STATES.SYNCED) counts.synced += 1;
    if (item.status === SYNC_STATES.CANCELLED) counts.cancelled += 1;
    if (item.status === SYNC_STATES.RESOLVED) counts.resolved += 1;
    if (REVIEWABLE_SYNC_STATES.has(item.status)) counts.reviewable += 1;
    if (CLOSED_SYNC_STATES.has(item.status)) counts.closed += 1;
    if (isQueueItemConflictLike(item) && item.status !== SYNC_STATES.CONFLICT) {
      counts.conflict += 1;
    }
  });

  return counts;
};

export const buildQueueSummary = (items = [], options = {}) => {
  const scopedItems = filterQueueItemsByScope(items, options);
  const counts = buildQueueSummaryCounts(scopedItems);
  const reviewItems = scopedItems
    .filter((item) => REVIEWABLE_SYNC_STATES.has(item.status))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));

  return {
    items: scopedItems,
    reviewItems,
    counts,
    hasReviewItems: reviewItems.length > 0,
    lastError: reviewItems.map(getQueueItemLastError).find(Boolean) || "",
  };
};
