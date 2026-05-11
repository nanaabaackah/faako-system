export const FINANCE_STATUSES = Object.freeze({
  UNPAID: "unpaid",
  PART_PAID: "part_paid",
  PAID: "paid",
  OVERPAID: "overpaid",
});

export const FINANCE_STATUS_LABELS = Object.freeze({
  [FINANCE_STATUSES.UNPAID]: "Unpaid",
  [FINANCE_STATUSES.PART_PAID]: "Part paid",
  [FINANCE_STATUSES.PAID]: "Paid",
  [FINANCE_STATUSES.OVERPAID]: "Overpaid",
});
