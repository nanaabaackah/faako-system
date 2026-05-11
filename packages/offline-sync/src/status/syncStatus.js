import { SYNC_STATES } from "../constants/syncStates.js";

export const getAggregateSyncStatus = ({
  online = true,
  syncing = false,
  pendingCount = 0,
  failedCount = 0,
  conflictCount = 0,
} = {}) => {
  if (conflictCount > 0) return SYNC_STATES.NEEDS_REVIEW;
  if (failedCount > 0) return SYNC_STATES.FAILED;
  if (syncing) return SYNC_STATES.SYNCING;
  if (!online) return pendingCount > 0 ? SYNC_STATES.PENDING : SYNC_STATES.OFFLINE;
  if (pendingCount > 0) return SYNC_STATES.PENDING;
  return SYNC_STATES.ONLINE;
};

export const buildSyncStatusSummary = (options = {}) => ({
  online: options.online !== false,
  status: getAggregateSyncStatus(options),
  pendingCount: Math.max(Number(options.pendingCount || 0), 0),
  failedCount: Math.max(Number(options.failedCount || 0), 0),
  conflictCount: Math.max(Number(options.conflictCount || 0), 0),
  lastSyncedAt: options.lastSyncedAt || "",
});
