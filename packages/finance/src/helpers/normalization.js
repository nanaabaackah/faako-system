import { FINANCE_STATUSES, FINANCE_STATUS_LABELS } from "../constants/financeStatuses.js";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../constants/paymentMethods.js";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "../constants/paymentStatuses.js";
import { RECEIPT_STATUSES, RECEIPT_STATUS_LABELS } from "../constants/receiptStatuses.js";

export const normalizeFinanceToken = (value, fallback = "") => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return normalized || fallback;
};

const titleizeToken = (value, fallback = "-") => {
  const normalized = normalizeFinanceToken(value);
  if (!normalized) return fallback;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const PAYMENT_METHOD_ALIASES = Object.freeze({
  cash: PAYMENT_METHODS.CASH,
  mobile: PAYMENT_METHODS.MOBILE_MONEY,
  mobilemoney: PAYMENT_METHODS.MOBILE_MONEY,
  mobile_money: PAYMENT_METHODS.MOBILE_MONEY,
  momo: PAYMENT_METHODS.MOBILE_MONEY,
  mtn: PAYMENT_METHODS.MTN_MOMO,
  mtn_momo: PAYMENT_METHODS.MTN_MOMO,
  mtn_mobile_money: PAYMENT_METHODS.MTN_MOMO,
  telecel: PAYMENT_METHODS.TELECEL_CASH,
  telecel_cash: PAYMENT_METHODS.TELECEL_CASH,
  vodafone_cash: PAYMENT_METHODS.TELECEL_CASH,
  airteltigo: PAYMENT_METHODS.AIRTELTIGO_MONEY,
  airteltigo_money: PAYMENT_METHODS.AIRTELTIGO_MONEY,
  at_money: PAYMENT_METHODS.AIRTELTIGO_MONEY,
  bank: PAYMENT_METHODS.BANK_TRANSFER,
  bank_transfer: PAYMENT_METHODS.BANK_TRANSFER,
  transfer: PAYMENT_METHODS.BANK_TRANSFER,
  card: PAYMENT_METHODS.CARD,
  credit_card: PAYMENT_METHODS.CARD,
  debit_card: PAYMENT_METHODS.CARD,
  other: PAYMENT_METHODS.OTHER,
});

const PAYMENT_STATUS_ALIASES = Object.freeze({
  pending: PAYMENT_STATUSES.PENDING,
  pending_payment: PAYMENT_STATUSES.PENDING,
  processing: PAYMENT_STATUSES.PENDING,
  partial: PAYMENT_STATUSES.PARTIAL,
  part_paid: PAYMENT_STATUSES.PARTIAL,
  partially_paid: PAYMENT_STATUSES.PARTIAL,
  successful: PAYMENT_STATUSES.PAID,
  confirmed: PAYMENT_STATUSES.PAID,
  complete: PAYMENT_STATUSES.PAID,
  completed: PAYMENT_STATUSES.PAID,
  paid: PAYMENT_STATUSES.PAID,
  overpaid: PAYMENT_STATUSES.PAID,
  failed: PAYMENT_STATUSES.FAILED,
  declined: PAYMENT_STATUSES.FAILED,
  refunded: PAYMENT_STATUSES.REFUNDED,
  refund_pending: PAYMENT_STATUSES.REFUNDED,
  reversed: PAYMENT_STATUSES.REFUNDED,
  cancelled: PAYMENT_STATUSES.CANCELLED,
  canceled: PAYMENT_STATUSES.CANCELLED,
  void: PAYMENT_STATUSES.CANCELLED,
  voided: PAYMENT_STATUSES.CANCELLED,
});

const RECEIPT_STATUS_ALIASES = Object.freeze({
  generated: RECEIPT_STATUSES.GENERATED,
  issued: RECEIPT_STATUSES.GENERATED,
  synced: RECEIPT_STATUSES.GENERATED,
  pending: RECEIPT_STATUSES.PENDING_SYNC,
  pending_sync: RECEIPT_STATUSES.PENDING_SYNC,
  offline_pending: RECEIPT_STATUSES.PENDING_SYNC,
  void: RECEIPT_STATUSES.VOID,
  voided: RECEIPT_STATUSES.VOID,
  cancelled: RECEIPT_STATUSES.CANCELLED,
  canceled: RECEIPT_STATUSES.CANCELLED,
});

const FINANCE_STATUS_ALIASES = Object.freeze({
  unpaid: FINANCE_STATUSES.UNPAID,
  pending: FINANCE_STATUSES.UNPAID,
  pending_payment: FINANCE_STATUSES.UNPAID,
  partial: FINANCE_STATUSES.PART_PAID,
  part_paid: FINANCE_STATUSES.PART_PAID,
  partially_paid: FINANCE_STATUSES.PART_PAID,
  paid: FINANCE_STATUSES.PAID,
  successful: FINANCE_STATUSES.PAID,
  confirmed: FINANCE_STATUSES.PAID,
  complete: FINANCE_STATUSES.PAID,
  completed: FINANCE_STATUSES.PAID,
  overpaid: FINANCE_STATUSES.OVERPAID,
});

export const normalizePaymentMethod = (value, fallback = PAYMENT_METHODS.OTHER) => {
  const normalized = normalizeFinanceToken(value);
  if (!normalized) return fallback;
  return PAYMENT_METHOD_ALIASES[normalized] || fallback;
};

export const getPaymentMethodLabel = (value, fallback = "Other") => {
  const normalized = normalizePaymentMethod(value, "");
  if (!normalized) return titleizeToken(value, fallback);
  return PAYMENT_METHOD_LABELS[normalized] || titleizeToken(normalized, fallback);
};

export const normalizePaymentStatus = (value, fallback = PAYMENT_STATUSES.PENDING) => {
  const normalized = normalizeFinanceToken(value);
  if (!normalized) return fallback;
  return PAYMENT_STATUS_ALIASES[normalized] || fallback;
};

export const getPaymentStatusLabel = (value, fallback = "Pending") => {
  const normalized = normalizePaymentStatus(value, "");
  if (!normalized) return titleizeToken(value, fallback);
  return PAYMENT_STATUS_LABELS[normalized] || titleizeToken(normalized, fallback);
};

export const normalizeReceiptStatus = (value, fallback = RECEIPT_STATUSES.GENERATED) => {
  const normalized = normalizeFinanceToken(value);
  if (!normalized) return fallback;
  return RECEIPT_STATUS_ALIASES[normalized] || fallback;
};

export const getReceiptStatusLabel = (value, fallback = "Generated") => {
  const normalized = normalizeReceiptStatus(value, "");
  if (!normalized) return titleizeToken(value, fallback);
  return RECEIPT_STATUS_LABELS[normalized] || titleizeToken(normalized, fallback);
};

export const normalizeFinanceStatus = (value, fallback = FINANCE_STATUSES.UNPAID) => {
  const normalized = normalizeFinanceToken(value);
  if (!normalized) return fallback;
  return FINANCE_STATUS_ALIASES[normalized] || fallback;
};

export const getFinanceStatusLabel = (value, fallback = "Unpaid") => {
  const normalized = normalizeFinanceStatus(value, "");
  if (!normalized) return titleizeToken(value, fallback);
  return FINANCE_STATUS_LABELS[normalized] || titleizeToken(normalized, fallback);
};

export const isSuccessfulPaymentStatus = (value) =>
  normalizePaymentStatus(value, "") === PAYMENT_STATUSES.PAID;
