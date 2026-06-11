import {
  OFFLINE_CONFLICT_STATUSES,
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
} from "@faako/offline-sync";

export const REEBS_BOOKING_QUEUE_SOURCE_APP = "reebs-portal";
export const REEBS_BOOKING_QUEUE_TARGET_TYPE = "booking";

export const BOOKING_QUEUE_VISIBLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.SYNCED,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const BOOKING_QUEUE_ACTIONABLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const createBookingQueueIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toOptionalNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const sanitizeQueuedBookingPayload = (booking = {}) => {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(booking, "id") && booking.id) {
    payload.id = Number(booking.id);
  }
  if (Object.prototype.hasOwnProperty.call(booking, "customerId")) {
    payload.customerId = toOptionalNumber(booking.customerId);
  }
  if (Object.prototype.hasOwnProperty.call(booking, "eventDate")) {
    payload.eventDate = booking.eventDate || "";
  }
  if (Object.prototype.hasOwnProperty.call(booking, "startTime")) {
    payload.startTime = booking.startTime || null;
  }
  if (Object.prototype.hasOwnProperty.call(booking, "endTime")) {
    payload.endTime = booking.endTime || null;
  }
  if (Object.prototype.hasOwnProperty.call(booking, "venueAddress")) {
    payload.venueAddress = booking.venueAddress || "";
  }
  if (Object.prototype.hasOwnProperty.call(booking, "status")) {
    payload.status = booking.status || "pending";
  }
  if (Object.prototype.hasOwnProperty.call(booking, "assignedUserId")) {
    payload.assignedUserId = toOptionalNumber(booking.assignedUserId);
  }
  if (Object.prototype.hasOwnProperty.call(booking, "discount")) {
    payload.discount = Number(booking.discount || 0);
  }
  if (Array.isArray(booking.items)) {
    payload.items = booking.items.map((item) => ({
      productId: Number(item.productId),
      variantId: toOptionalNumber(item.variantId),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
    }));
  }
  if (booking.userId) payload.userId = booking.userId;
  if (booking.userName) payload.userName = booking.userName;
  if (booking.userEmail) payload.userEmail = booking.userEmail;
  return payload;
};

export const isBookingQueueReviewError = (errorMessage = "") => {
  const normalized = String(errorMessage || "").toLowerCase();
  // TODO(offline-booking-conflicts): replace text matching with server conflict codes when booking sync APIs expose them.
  return [
    "already completed",
    "already cancelled",
    "auth",
    "availability",
    "available",
    "booking",
    "cancelled",
    "completed",
    "conflict",
    "customer",
    "date",
    "forbidden",
    "insufficient",
    "invalid",
    "item",
    "not found",
    "permission",
    "rental",
    "reserved",
    "unauthorized",
    "unavailable",
    "variant",
  ].some((needle) => normalized.includes(needle));
};

export const getBookingQueueFailureState = (errorMessage = "") =>
  isBookingQueueReviewError(errorMessage)
    ? {
        status: SYNC_STATES.NEEDS_REVIEW,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.DETECTED,
      }
    : {
        status: SYNC_STATES.FAILED,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
      };

export const isQueuedBookingForScope = (
  item,
  { organizationId, actorId, bookingId } = {}
) => {
  const bookingActions = new Set([
    OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING,
    OFFLINE_QUEUE_ACTION_TYPES.UPDATE_BOOKING_STATUS,
    OFFLINE_QUEUE_ACTION_TYPES.UPDATE_BOOKING_DETAILS,
  ]);

  if (!bookingActions.has(item?.actionType)) return false;
  if (item?.sourceApp !== REEBS_BOOKING_QUEUE_SOURCE_APP) return false;
  if (String(item?.payload?.targetType || "") !== REEBS_BOOKING_QUEUE_TARGET_TYPE) return false;
  if (organizationId && String(item?.organizationId || "") !== String(organizationId)) return false;
  if (actorId && String(item?.actorId || "") !== String(actorId)) return false;
  if (bookingId && String(item?.payload?.targetId || "") !== String(bookingId)) return false;
  return true;
};

export const buildQueuedBookingAction = ({
  organizationId,
  actorId,
  actionType,
  method,
  booking,
  customer,
  previousStatus = "",
  source = "booking-form",
  queuedAt = new Date().toISOString(),
}) => {
  const idempotencyKey = createBookingQueueIdempotencyKey();
  const sanitizedBooking = sanitizeQueuedBookingPayload(booking);
  const targetId = toOptionalNumber(sanitizedBooking.id);
  const customerId = toOptionalNumber(sanitizedBooking.customerId || customer?.id);

  return {
    actionType,
    sourceApp: REEBS_BOOKING_QUEUE_SOURCE_APP,
    organizationId: String(organizationId || ""),
    actorId: String(actorId || ""),
    status: SYNC_STATES.PENDING,
    payload: {
      idempotencyKey,
      queuedAt,
      targetType: REEBS_BOOKING_QUEUE_TARGET_TYPE,
      targetId,
      source,
      endpoint: {
        path: "/api/bookings",
        method: method || (targetId ? "PUT" : "POST"),
      },
      booking: sanitizedBooking,
      customer: {
        customerId,
        name: customer?.name || "",
        phone: customer?.phone || "",
        email: customer?.email || "",
      },
      metadata: {
        customerName: customer?.name || "",
        eventDate: sanitizedBooking.eventDate || "",
        startTime: sanitizedBooking.startTime || "",
        endTime: sanitizedBooking.endTime || "",
        venueAddress: sanitizedBooking.venueAddress || "",
        itemCount: Array.isArray(sanitizedBooking.items) ? sanitizedBooking.items.length : 0,
        previousStatus,
        nextStatus: sanitizedBooking.status || "",
      },
    },
  };
};

export const getQueuedBookingNotice = (queueItems = []) => {
  const visible = queueItems.filter((item) => BOOKING_QUEUE_VISIBLE_STATUSES.has(item.status));
  const actionable = visible.filter((item) => BOOKING_QUEUE_ACTIONABLE_STATUSES.has(item.status));
  const needsReview = actionable.find((item) => item.status === SYNC_STATES.NEEDS_REVIEW);
  if (needsReview) {
    return {
      status: SYNC_STATES.NEEDS_REVIEW,
      tone: "error",
      title: "Needs review",
      count: actionable.length,
      message:
        needsReview.retry?.lastError ||
        "A queued booking action needs review before it can sync.",
    };
  }

  const failed = actionable.find((item) => item.status === SYNC_STATES.FAILED);
  if (failed) {
    return {
      status: SYNC_STATES.FAILED,
      tone: "error",
      title: "Sync failed",
      count: actionable.length,
      message:
        failed.retry?.lastError ||
        "A queued booking action could not sync. Review it before retrying.",
    };
  }

  const syncing = actionable.find((item) => item.status === SYNC_STATES.SYNCING);
  if (syncing) {
    return {
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      count: actionable.length,
      message: "Submitting queued booking action. The server is validating availability, customer, status, and permissions.",
    };
  }

  if (actionable.length) {
    return {
      status: SYNC_STATES.PENDING,
      tone: "info",
      title: "Pending sync",
      count: actionable.length,
      message: `${actionable.length} booking action${actionable.length === 1 ? "" : "s"} pending sync.`,
    };
  }

  const synced = visible.find((item) => item.status === SYNC_STATES.SYNCED);
  if (synced) {
    return {
      status: SYNC_STATES.SYNCED,
      tone: "success",
      title: "Synced",
      count: 0,
      message: "Queued booking action synced.",
    };
  }

  return null;
};
