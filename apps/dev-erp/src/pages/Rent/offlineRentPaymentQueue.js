import {
  OFFLINE_CONFLICT_STATUSES,
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
} from "@faako/offline-sync";

export const DEV_ERP_PAYMENT_QUEUE_SOURCE_APP = "dev-erp";
export const DEV_ERP_PAYMENT_QUEUE_TARGET_TYPE = "rent-payment";

export const RENT_PAYMENT_QUEUE_VISIBLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.SYNCED,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const RENT_PAYMENT_QUEUE_ACTIONABLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const createRentPaymentIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `rent-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isRentPaymentReviewError = (errorMessage = "") => {
  const normalized = String(errorMessage || "").toLowerCase();
  return [
    "already",
    "auth",
    "balance",
    "duplicate",
    "forbidden",
    "invalid",
    "not found",
    "permission",
    "tenant",
    "unauthorized",
  ].some((needle) => normalized.includes(needle));
};

export const getRentPaymentFailureState = (errorMessage = "") =>
  isRentPaymentReviewError(errorMessage)
    ? {
        status: SYNC_STATES.NEEDS_REVIEW,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.DETECTED,
      }
    : {
        status: SYNC_STATES.FAILED,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
      };

export const isQueuedRentPaymentForScope = (
  item,
  { organizationId, actorId, tenantId } = {}
) => {
  if (item?.actionType !== OFFLINE_QUEUE_ACTION_TYPES.RECORD_PAYMENT) return false;
  if (item?.sourceApp !== DEV_ERP_PAYMENT_QUEUE_SOURCE_APP) return false;
  if (String(item?.payload?.targetType || "") !== DEV_ERP_PAYMENT_QUEUE_TARGET_TYPE) return false;
  if (organizationId && String(item?.organizationId || "") !== String(organizationId)) return false;
  if (actorId && String(item?.actorId || "") !== String(actorId)) return false;
  if (tenantId && String(item?.payload?.targetId || "") !== String(tenantId)) return false;
  return true;
};

export const buildQueuedRentPayment = ({
  organizationId,
  actorId,
  tenant,
  payment,
  queuedAt = new Date().toISOString(),
}) => {
  const idempotencyKey = createRentPaymentIdempotencyKey();
  return {
    actionType: OFFLINE_QUEUE_ACTION_TYPES.RECORD_PAYMENT,
    sourceApp: DEV_ERP_PAYMENT_QUEUE_SOURCE_APP,
    organizationId: String(organizationId || ""),
    actorId: String(actorId || ""),
    status: SYNC_STATES.PENDING,
    payload: {
      idempotencyKey,
      queuedAt,
      targetType: DEV_ERP_PAYMENT_QUEUE_TARGET_TYPE,
      targetId: Number(payment?.tenantId || tenant?.id),
      payment: {
        ...payment,
        tenantId: Number(payment?.tenantId || tenant?.id),
      },
      metadata: {
        tenantName: tenant?.tenantName || "",
        currency: tenant?.currency || "",
        paidAt: payment?.paidAt || "",
      },
    },
  };
};

export const getQueuedRentPaymentNotice = (queueItems = []) => {
  const visible = queueItems.filter((item) => RENT_PAYMENT_QUEUE_VISIBLE_STATUSES.has(item.status));
  const actionable = visible.filter((item) => RENT_PAYMENT_QUEUE_ACTIONABLE_STATUSES.has(item.status));
  const needsReview = actionable.find((item) => item.status === SYNC_STATES.NEEDS_REVIEW);
  if (needsReview) {
    return {
      status: SYNC_STATES.NEEDS_REVIEW,
      tone: "error",
      title: "Needs review",
      count: actionable.length,
      message:
        needsReview.retry?.lastError ||
        "A queued rent payment needs review before it can sync.",
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
        "A queued rent payment could not sync. Review it before retrying.",
    };
  }

  const syncing = actionable.find((item) => item.status === SYNC_STATES.SYNCING);
  if (syncing) {
    return {
      status: SYNC_STATES.SYNCING,
      tone: "info",
      title: "Syncing",
      count: actionable.length,
      message: "Submitting queued rent payment to the server for validation.",
    };
  }

  if (actionable.length) {
    return {
      status: SYNC_STATES.PENDING,
      tone: "info",
      title: "Pending sync",
      count: actionable.length,
      message: `${actionable.length} rent payment${actionable.length === 1 ? "" : "s"} pending sync.`,
    };
  }

  const synced = visible.find((item) => item.status === SYNC_STATES.SYNCED);
  if (synced) {
    return {
      status: SYNC_STATES.SYNCED,
      tone: "success",
      title: "Synced",
      count: 0,
      message: "Queued rent payment synced.",
    };
  }

  return null;
};
