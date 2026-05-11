export const RECEIPT_STATUSES = Object.freeze({
  GENERATED: "generated",
  PENDING_SYNC: "pending_sync",
  VOID: "void",
  CANCELLED: "cancelled",
});

export const RECEIPT_STATUS_LABELS = Object.freeze({
  [RECEIPT_STATUSES.GENERATED]: "Generated",
  [RECEIPT_STATUSES.PENDING_SYNC]: "Pending sync",
  [RECEIPT_STATUSES.VOID]: "Void",
  [RECEIPT_STATUSES.CANCELLED]: "Cancelled",
});
