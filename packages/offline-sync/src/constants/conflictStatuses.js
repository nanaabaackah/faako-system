export const OFFLINE_CONFLICT_STATUSES = Object.freeze({
  NONE: "none",
  DETECTED: "detected",
  RESOLVED: "resolved",
  NEEDS_REVIEW: "needs_review",
});

export const OFFLINE_CONFLICT_STATUS_LABELS = Object.freeze({
  [OFFLINE_CONFLICT_STATUSES.NONE]: "No conflict",
  [OFFLINE_CONFLICT_STATUSES.DETECTED]: "Conflict detected",
  [OFFLINE_CONFLICT_STATUSES.RESOLVED]: "Resolved",
  [OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW]: "Needs review",
});
