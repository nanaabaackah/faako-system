import { normalizeGhanaPhone } from "../customers/contactPolicy.js";

const BOOKING_STATUSES = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const BOOKING_STATUS_VALUES = new Set(Object.values(BOOKING_STATUSES));

const BOOKING_TRANSITIONS = Object.freeze({
  [BOOKING_STATUSES.PENDING]: Object.freeze([
    BOOKING_STATUSES.CONFIRMED,
    BOOKING_STATUSES.CANCELLED,
  ]),
  [BOOKING_STATUSES.CONFIRMED]: Object.freeze([
    BOOKING_STATUSES.COMPLETED,
    BOOKING_STATUSES.CANCELLED,
  ]),
  [BOOKING_STATUSES.COMPLETED]: Object.freeze([]),
  [BOOKING_STATUSES.CANCELLED]: Object.freeze([]),
});

const normalizeBookingStatus = (value, fallback = BOOKING_STATUSES.PENDING) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "canceled") return BOOKING_STATUSES.CANCELLED;
  return BOOKING_STATUS_VALUES.has(normalized) ? normalized : fallback;
};

const getAllowedBookingTransitions = (status) =>
  BOOKING_TRANSITIONS[normalizeBookingStatus(status)] || [];

const canTransitionBooking = (currentStatus, nextStatus) => {
  const current = normalizeBookingStatus(currentStatus);
  const next = normalizeBookingStatus(nextStatus, "");
  if (!next) return false;
  if (current === next) return true;
  return getAllowedBookingTransitions(current).includes(next);
};

const isBookingReservationActive = (status) =>
  [BOOKING_STATUSES.PENDING, BOOKING_STATUSES.CONFIRMED].includes(
    normalizeBookingStatus(status)
  );

const isBookingLocked = (status) =>
  [BOOKING_STATUSES.COMPLETED, BOOKING_STATUSES.CANCELLED].includes(
    normalizeBookingStatus(status)
  );

const buildBookingReference = ({ id, createdAt = new Date() }) => {
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) return "";
  const date = new Date(createdAt);
  const year = Number.isNaN(date.getTime()) ? new Date().getUTCFullYear() : date.getUTCFullYear();
  return `RB-${year}-${String(bookingId).padStart(6, "0")}`;
};

const normalizeDateOnly = (value) => {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? ""
    : normalized;
};

const validateBookingDateRange = (startValue, endValue = startValue) => {
  const startDate = normalizeDateOnly(startValue);
  const endDate = normalizeDateOnly(endValue || startValue);
  if (!startDate || !endDate) {
    return { valid: false, code: "INVALID_BOOKING_DATE", startDate, endDate };
  }
  if (endDate < startDate) {
    return { valid: false, code: "INVALID_BOOKING_DATE_RANGE", startDate, endDate };
  }
  return { valid: true, startDate, endDate };
};

export {
  BOOKING_STATUSES,
  BOOKING_STATUS_VALUES,
  BOOKING_TRANSITIONS,
  buildBookingReference,
  canTransitionBooking,
  getAllowedBookingTransitions,
  isBookingLocked,
  isBookingReservationActive,
  normalizeBookingStatus,
  normalizeDateOnly,
  normalizeGhanaPhone,
  validateBookingDateRange,
};
