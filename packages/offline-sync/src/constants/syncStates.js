export const SYNC_STATES = Object.freeze({
  ONLINE: "online",
  OFFLINE: "offline",
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed",
  CONFLICT: "conflict",
  NEEDS_REVIEW: "needs_review",
  RETRYING: "retrying",
  CANCELLED: "cancelled",
  RESOLVED: "resolved",
});

export const SYNC_STATE_LABELS = Object.freeze({
  [SYNC_STATES.ONLINE]: "Online",
  [SYNC_STATES.OFFLINE]: "Offline",
  [SYNC_STATES.PENDING]: "Pending sync",
  [SYNC_STATES.SYNCING]: "Syncing",
  [SYNC_STATES.SYNCED]: "Synced",
  [SYNC_STATES.FAILED]: "Sync failed",
  [SYNC_STATES.CONFLICT]: "Conflict",
  [SYNC_STATES.NEEDS_REVIEW]: "Needs review",
  [SYNC_STATES.RETRYING]: "Retrying",
  [SYNC_STATES.CANCELLED]: "Cancelled",
  [SYNC_STATES.RESOLVED]: "Resolved",
});
