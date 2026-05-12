import {
  OFFLINE_CONFLICT_STATUSES,
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
} from "@faako/offline-sync";

export const REEBS_PAYMENT_QUEUE_SOURCE_APP = "reebs-portal";
export const REEBS_PAYMENT_QUEUE_TARGET_TYPE = "order";

export const PAYMENT_QUEUE_VISIBLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.SYNCED,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const PAYMENT_QUEUE_ACTIONABLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const createManualPaymentIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `manual-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isManualPaymentReviewError = (errorMessage = "") => {
  const normalized = String(errorMessage || "").toLowerCase();
  // TODO(offline-payment-conflicts): replace text matching with server conflict codes when sync APIs expose them.
  return [
    "already paid",
    "auth",
    "balance",
    "closed",
    "duplicate",
    "forbidden",
    "invalid",
    "not found",
    "order",
    "permission",
    "unauthorized",
  ].some((needle) => normalized.includes(needle));
};

export const getManualPaymentFailureState = (errorMessage = "") =>
  isManualPaymentReviewError(errorMessage)
    ? {
        status: SYNC_STATES.NEEDS_REVIEW,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.DETECTED,
      }
    : {
        status: SYNC_STATES.FAILED,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
      };

export const isQueuedOrderPaymentForScope = (
  item,
  { organizationId, actorId, orderId } = {}
) => {
  if (item?.actionType !== OFFLINE_QUEUE_ACTION_TYPES.RECORD_PAYMENT) return false;
  if (item?.sourceApp !== REEBS_PAYMENT_QUEUE_SOURCE_APP) return false;
  if (String(item?.payload?.targetType || "") !== REEBS_PAYMENT_QUEUE_TARGET_TYPE) return false;
  if (organizationId && String(item?.organizationId || "") !== String(organizationId)) return false;
  if (actorId && String(item?.actorId || "") !== String(actorId)) return false;
  if (orderId && String(item?.payload?.targetId || "") !== String(orderId)) return false;
  return true;
};

export const buildQueuedOrderPayment = ({
  organizationId,
  actorId,
  order,
  payment,
  source = "order-payment-form",
  queuedAt = new Date().toISOString(),
}) => {
  const idempotencyKey = createManualPaymentIdempotencyKey();
  return {
    actionType: OFFLINE_QUEUE_ACTION_TYPES.RECORD_PAYMENT,
    sourceApp: REEBS_PAYMENT_QUEUE_SOURCE_APP,
    organizationId: String(organizationId || ""),
    actorId: String(actorId || ""),
    status: SYNC_STATES.PENDING,
    payload: {
      idempotencyKey,
      queuedAt,
      targetType: REEBS_PAYMENT_QUEUE_TARGET_TYPE,
      targetId: Number(order?.id),
      source,
      payment: {
        ...payment,
        orderId: Number(order?.id),
      },
      metadata: {
        orderNumber: order?.orderNumber || "",
        customerName: order?.customerName || "",
        balanceCents: Number(order?.balanceDueCents ?? order?.balanceCents ?? 0),
      },
    },
  };
};

export const getQueuedPaymentNotice = (queueItems = []) => {
  const visible = queueItems.filter((item) => PAYMENT_QUEUE_VISIBLE_STATUSES.has(item.status));
  const actionable = visible.filter((item) => PAYMENT_QUEUE_ACTIONABLE_STATUSES.has(item.status));
  const needsReview = actionable.find((item) => item.status === SYNC_STATES.NEEDS_REVIEW);
  if (needsReview) {
    return {
      status: SYNC_STATES.NEEDS_REVIEW,
      tone: "error",
      title: "Needs review",
      count: actionable.length,
      message:
        needsReview.retry?.lastError ||
        "A queued manual payment needs review before it can sync.",
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
        "A queued manual payment could not sync. Review it before retrying.",
    };
  }

  const syncing = actionable.find((item) => item.status === SYNC_STATES.SYNCING);
  if (syncing) {
    return {
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      count: actionable.length,
      message: "Submitting queued manual payment to the server for validation.",
    };
  }

  if (actionable.length) {
    return {
      status: SYNC_STATES.PENDING,
      tone: "info",
      title: "Pending sync",
      count: actionable.length,
      message: `${actionable.length} manual payment${actionable.length === 1 ? "" : "s"} pending sync.`,
    };
  }

  const synced = visible.find((item) => item.status === SYNC_STATES.SYNCED);
  if (synced) {
    return {
      status: SYNC_STATES.SYNCED,
      tone: "success",
      title: "Synced",
      count: 0,
      message: "Queued manual payment synced.",
    };
  }

  return null;
};
