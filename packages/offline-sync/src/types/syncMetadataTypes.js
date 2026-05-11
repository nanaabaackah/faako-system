export const SYNC_RETRY_METADATA_VERSION = "sync-retry-metadata.v1";

export const SYNC_RETRY_METADATA_SHAPE = Object.freeze({
  attempts: "Number of sync attempts.",
  maxAttempts: "Maximum attempts before human review is required.",
  firstAttemptAt: "Timestamp of first attempt.",
  lastAttemptAt: "Timestamp of most recent attempt.",
  nextAttemptAt: "Timestamp when retry can be attempted again.",
  lastError: "Last safe error summary.",
});

export const SYNC_STATUS_SUMMARY_SHAPE = Object.freeze({
  online: "Current browser online state.",
  status: "Current aggregate sync state.",
  pendingCount: "Number of pending queue items.",
  failedCount: "Number of failed queue items.",
  conflictCount: "Number of conflict or needs-review queue items.",
  lastSyncedAt: "Last successful sync timestamp, when known.",
});
