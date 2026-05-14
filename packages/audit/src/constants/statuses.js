export const AUDIT_STATUSES = Object.freeze({
  SUCCESS: "success",
  FAILED: "failed",
  PENDING: "pending",
  CONFLICT: "conflict",
});

export const AUDIT_STATUS_LABELS = Object.freeze({
  [AUDIT_STATUSES.SUCCESS]: "Success",
  [AUDIT_STATUSES.FAILED]: "Failed",
  [AUDIT_STATUSES.PENDING]: "Pending",
  [AUDIT_STATUSES.CONFLICT]: "Conflict",
});
