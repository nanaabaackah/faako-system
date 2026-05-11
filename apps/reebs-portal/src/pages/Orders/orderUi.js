import {
  formatCurrencyFromCents as formatSharedCurrencyFromCents,
  formatCurrencyMajor as formatSharedCurrencyMajor,
  getPaymentMethodLabel as getSharedPaymentMethodLabel,
} from "@faako/finance";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const FULFILLMENT_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "picked_up", label: "Picked Up" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const ORDER_VIEW_OPTIONS = [
  { key: "list", label: "List" },
  { key: "cards", label: "Board" },
  { key: "ledger", label: "Ledger" },
];

export const ORDER_STATUS_FILTER_VALUES = new Set([
  "all",
  "draft",
  "open",
  "completed",
  "cancelled",
  "refunded",
]);

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

export const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overpaid", label: "Overpaid" },
  { value: "refund_pending", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
];

export const FULFILLMENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All fulfillment" },
  ...FULFILLMENT_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
];

export const ORDER_SOURCE_ALL_OPTION = { value: "all", label: "All sources" };

export const ORDER_SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest total" },
  { value: "balance", label: "Balance due" },
  { value: "customer", label: "Customer A-Z" },
];

export const toCents = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

export const majorToCents = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallback;
};

const asRecord = (value) => (value && typeof value === "object" ? value : {});

export const getOrderTotalCents = (order = {}) => {
  const source = asRecord(order);
  if (source.grandTotalCents != null) return toCents(source.grandTotalCents);
  if (source.totalCents != null) return toCents(source.totalCents);
  if (source.total_amount != null) return toCents(source.total_amount);
  if (source.total != null) return majorToCents(source.total);
  return 0;
};

export const getOrderAmountPaidCents = (order = {}) => {
  const source = asRecord(order);
  if (source.amountPaidCents != null) return toCents(source.amountPaidCents);
  if (Array.isArray(source.payments)) {
    return source.payments.reduce((sum, payment) => {
      const paymentRecord = asRecord(payment);
      const status = String(paymentRecord.status || "successful").toLowerCase();
      if (!["successful", "confirmed", "paid"].includes(status)) return sum;
      return sum + toCents(paymentRecord.amountCents);
    }, 0);
  }
  return 0;
};

export const getOrderBalanceCents = (order = {}) => {
  const source = asRecord(order);
  if (source.balanceDueCents != null) return toCents(source.balanceDueCents);
  return Math.max(getOrderTotalCents(source) - getOrderAmountPaidCents(source), 0);
};

export const formatCurrencyFromCents = (value, currency = "GHS") => {
  return formatSharedCurrencyFromCents(toCents(value), currency, { locale: "en-GH" });
};

export const formatCurrencyMajor = (value, currency = "GHS") =>
  formatSharedCurrencyMajor(value, currency, { locale: "en-GH" });

export const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const normalizeStatusKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

export const formatStatusLabel = (value, fallback = "-") => {
  const normalized = normalizeStatusKey(value);
  if (!normalized) return fallback;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getOrderLifecycleStatusValue = (order = {}) => {
  const source = asRecord(order);
  const orderStatus = normalizeStatusKey(source.status);
  const paymentStatus = normalizeStatusKey(source.paymentStatus);

  if (paymentStatus === "refunded" || orderStatus === "refunded") return "refunded";
  if (["cancelled", "canceled"].includes(orderStatus)) return "cancelled";
  if (orderStatus === "draft") return "draft";
  if (["completed", "fulfilled", "delivered"].includes(orderStatus)) return "completed";
  return "open";
};

export const getOrderLifecycleStatusLabel = (order = {}) =>
  formatStatusLabel(getOrderLifecycleStatusValue(order), "Open");

export const matchesOrderLifecycleStatusFilter = (order = {}, filterValue = "all") => {
  const normalized = normalizeStatusKey(filterValue) || "all";
  if (normalized === "all") return true;
  if (!ORDER_STATUS_FILTER_VALUES.has(normalized)) return true;
  return getOrderLifecycleStatusValue(order) === normalized;
};

export const getOrdersStatusClass = (value) => {
  const normalized = normalizeStatusKey(value);
  if (["cancelled", "canceled", "refunded"].includes(normalized)) return "Canceled";
  if (
    [
      "paid",
      "overpaid",
      "completed",
      "complete",
      "fulfilled",
      "delivered",
      "picked_up",
      "ready_for_pickup",
    ].includes(normalized)
  ) {
    return "completed";
  }
  return "pending";
};

export const getStatusTone = (value) => {
  const normalized = normalizeStatusKey(value);
  if (["cancelled", "canceled", "refunded"].includes(normalized)) return "danger";
  if (["paid", "overpaid", "completed", "fulfilled", "delivered", "picked_up"].includes(normalized)) {
    return "success";
  }
  if (["partial", "partially_paid", "pending_payment", "refund_pending"].includes(normalized)) {
    return "warning";
  }
  return "info";
};

export const getPaymentMethodLabel = (value) => {
  const normalized = normalizeStatusKey(value);
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === normalized)?.label ||
    getSharedPaymentMethodLabel(value, formatStatusLabel(value))
  );
};
