import {
  OFFLINE_CONFLICT_STATUSES,
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
} from "@faako/offline-sync";

export const REEBS_INVENTORY_QUEUE_SOURCE_APP = "reebs-portal";
export const REEBS_INVENTORY_QUEUE_TARGET_TYPE = "inventory-item";

export const INVENTORY_ADJUSTMENT_QUEUE_VISIBLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.SYNCED,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const INVENTORY_ADJUSTMENT_QUEUE_ACTIONABLE_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.NEEDS_REVIEW,
  SYNC_STATES.FAILED,
]);

export const createInventoryAdjustmentIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `inventory-adjustment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isInventoryAdjustmentReviewError = (errorMessage = "") => {
  const normalized = String(errorMessage || "").toLowerCase();
  // TODO(offline-inventory-conflicts): replace text matching with server conflict codes when sync APIs expose them.
  return [
    "auth",
    "booked",
    "deleted",
    "duplicate",
    "forbidden",
    "insufficient",
    "invalid",
    "not found",
    "permission",
    "product",
    "rental",
    "stock",
    "unauthorized",
    "validation",
    "variant",
  ].some((needle) => normalized.includes(needle));
};

export const getInventoryAdjustmentFailureState = (errorMessage = "") =>
  isInventoryAdjustmentReviewError(errorMessage)
    ? {
        status: SYNC_STATES.NEEDS_REVIEW,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.DETECTED,
      }
    : {
        status: SYNC_STATES.FAILED,
        conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
      };

export const isQueuedInventoryAdjustmentForScope = (
  item,
  { organizationId, actorId, itemId } = {}
) => {
  if (item?.actionType !== OFFLINE_QUEUE_ACTION_TYPES.ADJUST_STOCK) return false;
  if (item?.sourceApp !== REEBS_INVENTORY_QUEUE_SOURCE_APP) return false;
  if (String(item?.payload?.targetType || "") !== REEBS_INVENTORY_QUEUE_TARGET_TYPE) return false;
  if (organizationId && String(item?.organizationId || "") !== String(organizationId)) return false;
  if (actorId && String(item?.actorId || "") !== String(actorId)) return false;
  if (itemId && String(item?.payload?.targetId || "") !== String(itemId)) return false;
  return true;
};

export const buildQueuedInventoryAdjustment = ({
  organizationId,
  actorId,
  item,
  adjustment,
  source = "inventory-adjustment-form",
  queuedAt = new Date().toISOString(),
}) => {
  const idempotencyKey = createInventoryAdjustmentIdempotencyKey();
  const productId = Number(adjustment?.productId || item?.id);
  const variantId = adjustment?.variantId ? Number(adjustment.variantId) : undefined;
  const quantity = Number(adjustment?.quantity || 0);
  const type = adjustment?.type === "StockOut" ? "StockOut" : "StockIn";

  return {
    actionType: OFFLINE_QUEUE_ACTION_TYPES.ADJUST_STOCK,
    sourceApp: REEBS_INVENTORY_QUEUE_SOURCE_APP,
    organizationId: String(organizationId || ""),
    actorId: String(actorId || ""),
    status: SYNC_STATES.PENDING,
    payload: {
      idempotencyKey,
      queuedAt,
      targetType: REEBS_INVENTORY_QUEUE_TARGET_TYPE,
      targetId: productId,
      source,
      endpoint: {
        path: "/api/stock",
        method: "POST",
      },
      adjustment: {
        productId,
        ...(variantId ? { variantId } : {}),
        type,
        quantity,
        soldMonth: type === "StockOut" ? adjustment?.soldMonth || null : null,
        notes: adjustment?.notes || undefined,
        reference: adjustment?.reference || undefined,
        userId: adjustment?.userId || actorId || undefined,
        userName: adjustment?.userName || undefined,
        userEmail: adjustment?.userEmail || undefined,
      },
      metadata: {
        itemName: item?.name || "",
        sku: item?.sku || "",
        currentQuantity: Number(item?.quantity ?? item?.stock ?? 0),
        variantId: variantId || null,
        adjustmentType: type,
        adjustmentAmount: quantity,
      },
    },
  };
};

export const getQueuedInventoryAdjustmentNotice = (queueItems = []) => {
  const visible = queueItems.filter((item) =>
    INVENTORY_ADJUSTMENT_QUEUE_VISIBLE_STATUSES.has(item.status)
  );
  const actionable = visible.filter((item) =>
    INVENTORY_ADJUSTMENT_QUEUE_ACTIONABLE_STATUSES.has(item.status)
  );
  const needsReview = actionable.find((item) => item.status === SYNC_STATES.NEEDS_REVIEW);
  if (needsReview) {
    return {
      status: SYNC_STATES.NEEDS_REVIEW,
      tone: "error",
      title: "Needs review",
      count: actionable.length,
      message:
        needsReview.retry?.lastError ||
        "A queued inventory adjustment needs review before it can sync.",
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
        "A queued inventory adjustment could not sync. Review it before retrying.",
    };
  }

  const syncing = actionable.find((item) => item.status === SYNC_STATES.SYNCING);
  if (syncing) {
    return {
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      count: actionable.length,
      message: "Submitting queued inventory adjustment to the server for validation.",
    };
  }

  if (actionable.length) {
    return {
      status: SYNC_STATES.PENDING,
      tone: "info",
      title: "Pending sync",
      count: actionable.length,
      message: `${actionable.length} inventory adjustment${actionable.length === 1 ? "" : "s"} pending sync.`,
    };
  }

  const synced = visible.find((item) => item.status === SYNC_STATES.SYNCED);
  if (synced) {
    return {
      status: SYNC_STATES.SYNCED,
      tone: "success",
      title: "Synced",
      count: 0,
      message: "Queued inventory adjustment synced.",
    };
  }

  return null;
};
