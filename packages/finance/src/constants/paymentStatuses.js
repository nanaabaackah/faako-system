export const PAYMENT_STATUSES = Object.freeze({
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUSES.PENDING]: "Pending",
  [PAYMENT_STATUSES.PARTIAL]: "Partial",
  [PAYMENT_STATUSES.PAID]: "Paid",
  [PAYMENT_STATUSES.FAILED]: "Failed",
  [PAYMENT_STATUSES.REFUNDED]: "Refunded",
  [PAYMENT_STATUSES.CANCELLED]: "Cancelled",
});
