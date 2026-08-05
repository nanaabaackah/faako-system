import type {
  AdminProduct,
  InventoryItem,
  InventoryItemPatchPayload,
  InventoryManagementFilters,
  InventoryManagementSummary,
  InventoryMovement,
  InventoryMovementDraft,
  InventoryMovementPayload,
  InventoryMovementType,
  InventoryStockStatus,
  SupplierSummary,
} from "../types/inventory";
import { inventoryAdjustmentSchema } from "@faako/validation";

export const EMPTY_ALERT_SUMMARY = {
  active: [],
  recentDispatches: [],
  counts: {
    lowStock: 0,
    outOfStock: 0,
    total: 0,
  },
};

export const STOCK_STATUS_OPTIONS: Array<{ value: InventoryStockStatus; label: string }> = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "preorder", label: "Preorder" },
  { value: "unavailable", label: "Unavailable" },
  { value: "manual_review", label: "Manual review" },
];

export const MOVEMENT_TYPE_OPTIONS: Array<{
  value: InventoryMovementType;
  label: string;
  description: string;
}> = [
  { value: "RESTOCK", label: "Restock", description: "Add newly received stock" },
  { value: "DAMAGE", label: "Damage", description: "Remove damaged or lost stock" },
  { value: "ADJUSTMENT", label: "Adjustment", description: "Apply a signed stock correction" },
  {
    value: "MANUAL_CORRECTION",
    label: "Manual correction",
    description: "Set stock to a counted quantity",
  },
  { value: "RESERVED", label: "Reserved", description: "Hold stock for an order" },
  { value: "RELEASED", label: "Released", description: "Return reserved stock to availability" },
];

const STOCK_STATUS_LABELS = STOCK_STATUS_OPTIONS.reduce<Record<string, string>>(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {}
);

const MOVEMENT_TYPE_LABELS = MOVEMENT_TYPE_OPTIONS.reduce<Record<string, string>>(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {}
);

export const formatInventoryLabel = (value = "") =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

export const formatInventoryStatusLabel = (status = "") =>
  STOCK_STATUS_LABELS[status] || formatInventoryLabel(status || "unavailable");

export const formatMovementTypeLabel = (type = "") =>
  MOVEMENT_TYPE_LABELS[type] || formatInventoryLabel(type);

export const formatInventoryDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const toInventoryNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toWholeInventoryNumber = (value?: number | string | null) => {
  const parsed = toInventoryNumber(value);
  return parsed === null ? null : Math.max(0, Math.trunc(parsed));
};

export const getInventoryProductName = (item?: InventoryItem | null) =>
  item?.product?.name || formatInventoryLabel(item?.productSlug || "Unlinked product");

export const getInventoryVariantLabel = (item?: InventoryItem | null) => {
  if (!item?.variantId) return "";
  const productSlug = item.productSlug || "";
  const variantSlug = productSlug && item.variantId.startsWith(`${productSlug}-`)
    ? item.variantId.slice(productSlug.length + 1)
    : item.variantId;
  return formatInventoryLabel(variantSlug);
};

export const getInventoryProductSku = (item?: InventoryItem | null) =>
  item?.sku || item?.product?.sku || item?.productSlug || "";

export const resolveInventoryOnHandQuantity = (item: InventoryItem) => {
  const quantityOnHand = toWholeInventoryNumber(item.quantityOnHand);
  if (quantityOnHand !== null) return quantityOnHand;
  return toWholeInventoryNumber(item.product?.stockQuantity);
};

export const resolveInventoryReservedQuantity = (item: InventoryItem) =>
  toWholeInventoryNumber(item.reservedQuantity) ??
  toWholeInventoryNumber(item.product?.reservedQuantity) ??
  0;

export const resolveInventoryAvailableQuantity = (item: InventoryItem) => {
  const availableQuantity = toWholeInventoryNumber(item.availableQuantity);
  if (availableQuantity !== null) return availableQuantity;

  const onHandQuantity = resolveInventoryOnHandQuantity(item);
  if (onHandQuantity !== null) {
    return Math.max(0, onHandQuantity - resolveInventoryReservedQuantity(item));
  }

  const productAvailableQuantity = toWholeInventoryNumber(item.product?.availableQuantity);
  if (productAvailableQuantity !== null) return productAvailableQuantity;

  return null;
};

export const resolveLowStockThreshold = (item: InventoryItem) =>
  toWholeInventoryNumber(item.lowStockThreshold) ??
  toWholeInventoryNumber(item.product?.lowStockThreshold);

export const resolveReorderThreshold = (item: InventoryItem) =>
  toWholeInventoryNumber(item.reorderThreshold) ??
  toWholeInventoryNumber(item.product?.reorderThreshold);

export const getInventoryComputedStatus = (item: InventoryItem): InventoryStockStatus => {
  const availableQuantity = resolveInventoryAvailableQuantity(item);
  const rawStatus =
    item.computedStockStatus ||
    item.stockStatus ||
    item.product?.stockStatus ||
    "unavailable";
  const status = rawStatus as InventoryStockStatus;

  if (status === "preorder" || status === "manual_review") return status;
  if (availableQuantity !== null && availableQuantity <= 0) return "out_of_stock";

  if (availableQuantity !== null && status === "unavailable") {
    const threshold = resolveLowStockThreshold(item);
    return threshold !== null && availableQuantity <= threshold ? "low_stock" : "in_stock";
  }

  return status;
};

export const getInventoryStatusTone = (status: string) => {
  if (status === "out_of_stock" || status === "manual_review") return "danger" as const;
  if (status === "low_stock" || status === "preorder") return "warning" as const;
  if (status === "in_stock") return "success" as const;
  return "neutral" as const;
};

export const isInventoryAttentionItem = (item: InventoryItem) => {
  const status = getInventoryComputedStatus(item);
  return (
    status === "out_of_stock" ||
    status === "low_stock" ||
    status === "manual_review" ||
    item.isLowStock ||
    item.needsReorder
  );
};

export const matchesInventoryFilters = (
  item: InventoryItem,
  filters: InventoryManagementFilters
) => {
  const search = filters.search.trim().toLowerCase();
  const status = getInventoryComputedStatus(item);

  if (filters.status === "attention" && !isInventoryAttentionItem(item)) return false;
  if (filters.status === "unconfirmed" && resolveInventoryAvailableQuantity(item) !== null) {
    return false;
  }
  if (
    filters.status !== "all" &&
    filters.status !== "attention" &&
    filters.status !== "unconfirmed" &&
    status !== filters.status
  ) {
    return false;
  }

  if (filters.supplierId && item.supplierId !== filters.supplierId) return false;

  if (!search) return true;
  const haystack = [
    getInventoryProductName(item),
    getInventoryVariantLabel(item),
    item.productSlug,
    item.variantId,
    item.sku,
    item.product?.sku,
    item.supplier?.name,
    item.supplier?.slug,
    item.product?.categorySlug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
};

export const sortInventoryItems = (items: InventoryItem[]) =>
  [...items].sort((left, right) => {
    const statusRank = (item: InventoryItem) => {
      const status = getInventoryComputedStatus(item);
      if (status === "out_of_stock") return 0;
      if (status === "manual_review") return 1;
      if (status === "low_stock") return 2;
      if (status === "preorder") return 3;
      if (status === "unavailable") return 4;
      return 5;
    };
    const leftRank = statusRank(left);
    const rightRank = statusRank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    const nameComparison = getInventoryProductName(left).localeCompare(
      getInventoryProductName(right)
    );
    if (nameComparison !== 0) return nameComparison;
    return getInventoryVariantLabel(left).localeCompare(getInventoryVariantLabel(right));
  });

export const buildInventoryManagementSummary = (
  inventory: InventoryItem[],
  products: AdminProduct[] = []
): InventoryManagementSummary => {
  const trackedItems = inventory.filter((item) => item.inventoryTrackingEnabled).length;
  const countedItems = inventory.filter(
    (item) => item.inventoryTrackingEnabled && resolveInventoryAvailableQuantity(item) !== null
  ).length;
  const supplierLinkedItems = inventory.filter((item) => item.supplierId).length;
  const productLinkedItems = inventory.filter((item) => item.productId || item.product).length;
  const availableUnits = inventory.reduce(
    (total, item) => total + (resolveInventoryAvailableQuantity(item) ?? 0),
    0
  );
  const reservedUnits = inventory.reduce(
    (total, item) => total + resolveInventoryReservedQuantity(item),
    0
  );

  return {
    totalItems: inventory.length,
    trackedItems,
    availableUnits,
    reservedUnits,
    lowStockItems: inventory.filter(
      (item) =>
        getInventoryComputedStatus(item) === "low_stock" ||
        (getInventoryComputedStatus(item) !== "out_of_stock" &&
          (item.isLowStock || item.needsReorder))
    ).length,
    outOfStockItems: inventory.filter(
      (item) => getInventoryComputedStatus(item) === "out_of_stock"
    ).length,
    manualReviewItems: inventory.filter(
      (item) => getInventoryComputedStatus(item) === "manual_review"
    ).length,
    unconfirmedItems: inventory.filter(
      (item) => item.inventoryTrackingEnabled && resolveInventoryAvailableQuantity(item) === null
    ).length,
    supplierLinkedItems,
    productLinkedItems,
    activeProducts: products.filter((product) => product.publishingStatus === "active").length,
    draftProducts: products.filter((product) => product.publishingStatus === "draft").length,
    archivedProducts: products.filter((product) => product.publishingStatus === "archived").length,
    supplierCoveragePercent: inventory.length
      ? Math.round((supplierLinkedItems / inventory.length) * 100)
      : 0,
    countedPercent: trackedItems ? Math.round((countedItems / trackedItems) * 100) : 0,
  };
};

export const buildInventoryPatchFromDraft = (
  draft: {
    quantityOnHand: string;
    reservedQuantity: string;
    lowStockThreshold: string;
    reorderThreshold: string;
    stockStatus: InventoryStockStatus;
    supplierId: string;
    sku: string;
    notes: string;
    inventoryTrackingEnabled: boolean;
    allowBackorder: boolean;
    isPurchasable: boolean;
    lastCountedAt: string;
  }
): InventoryItemPatchPayload => {
  const parseDraftQuantity = (value: string, label: string) => {
    if (value === "") return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a whole number of zero or more.`);
    }
    return parsed;
  };

  return {
    quantityOnHand: parseDraftQuantity(draft.quantityOnHand, "Quantity on hand"),
    reservedQuantity: parseDraftQuantity(draft.reservedQuantity, "Reserved quantity"),
    lowStockThreshold: parseDraftQuantity(draft.lowStockThreshold, "Low-stock threshold"),
    reorderThreshold: parseDraftQuantity(draft.reorderThreshold, "Reorder threshold"),
    stockStatus: draft.stockStatus,
    supplierId: draft.supplierId || null,
    sku: draft.sku.trim() || null,
    notes: draft.notes.trim() || null,
    inventoryTrackingEnabled: draft.inventoryTrackingEnabled,
    allowBackorder: draft.allowBackorder,
    isPurchasable: draft.isPurchasable,
    lastCountedAt: draft.lastCountedAt ? new Date(draft.lastCountedAt).toISOString() : null,
  };
};

export const buildInventoryEditDraft = (item: InventoryItem) => ({
  quantityOnHand:
    resolveInventoryOnHandQuantity(item) === null ? "" : String(resolveInventoryOnHandQuantity(item)),
  reservedQuantity: String(resolveInventoryReservedQuantity(item)),
  lowStockThreshold:
    resolveLowStockThreshold(item) === null ? "" : String(resolveLowStockThreshold(item)),
  reorderThreshold:
    resolveReorderThreshold(item) === null ? "" : String(resolveReorderThreshold(item)),
  stockStatus: getInventoryComputedStatus(item),
  supplierId: item.supplierId || "",
  sku: item.sku || item.product?.sku || "",
  notes: item.notes || "",
  inventoryTrackingEnabled: item.inventoryTrackingEnabled !== false,
  allowBackorder: Boolean(item.allowBackorder ?? item.product?.allowBackorder),
  isPurchasable: Boolean(item.isPurchasable ?? item.product?.isPurchasable ?? true),
  lastCountedAt: item.lastCountedAt ? item.lastCountedAt.slice(0, 16) : "",
});

export const buildInventoryMovementPayload = (
  item: InventoryItem,
  draft: InventoryMovementDraft
): InventoryMovementPayload => {
  const quantityDelta = Number(draft.quantityDelta);
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error("Enter a whole-number movement quantity.");
  }

  const payload: InventoryMovementPayload = {
    inventoryItemId: item.id,
    productSlug: item.productSlug,
    variantId: item.variantId || null,
    supplierId: item.supplierId || undefined,
    movementType: draft.movementType,
    quantityDelta,
    reason: draft.reason.trim() || null,
    supplierNote: draft.supplierNote.trim() || null,
    purchaseNote: draft.purchaseNote.trim() || null,
  };

  if (draft.quantityAfter !== "") {
    const quantityAfter = toWholeInventoryNumber(draft.quantityAfter);
    if (quantityAfter === null) throw new Error("Enter a valid counted stock quantity.");
    payload.quantityAfter = quantityAfter;
  }

  const validation = inventoryAdjustmentSchema.safeParse(payload);
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message || "Inventory movement is invalid.");
  }

  return payload;
};

export const applyInventoryPatchLocally = (
  item: InventoryItem,
  patch: InventoryItemPatchPayload,
  suppliers: SupplierSummary[] = []
): InventoryItem => {
  const nextOnHand = Object.prototype.hasOwnProperty.call(patch, "quantityOnHand")
    ? patch.quantityOnHand
    : item.quantityOnHand;
  const nextReserved = Object.prototype.hasOwnProperty.call(patch, "reservedQuantity")
    ? patch.reservedQuantity ?? 0
    : item.reservedQuantity;
  const availableQuantity =
    nextOnHand === null || nextOnHand === undefined
      ? null
      : Math.max(0, Number(nextOnHand) - Number(nextReserved || 0));
  const supplier =
    patch.supplierId === undefined
      ? item.supplier
      : suppliers.find((candidate) => candidate.id === patch.supplierId) || null;

  const provisional: InventoryItem = {
    ...item,
    ...patch,
    quantityOnHand: nextOnHand,
    reservedQuantity: Number(nextReserved || 0),
    availableQuantity,
    supplierId: patch.supplierId === undefined ? item.supplierId : patch.supplierId,
    supplier,
    stockStatus: patch.stockStatus || item.stockStatus,
    updatedAt: new Date().toISOString(),
    product: item.product && !item.variantId
      ? {
          ...item.product,
          sku: patch.sku === undefined ? item.product.sku : patch.sku,
          stockQuantity: nextOnHand,
          reservedQuantity: Number(nextReserved || 0),
          availableQuantity,
          lowStockThreshold:
            patch.lowStockThreshold === undefined
              ? item.product.lowStockThreshold
              : patch.lowStockThreshold,
          reorderThreshold:
            patch.reorderThreshold === undefined
              ? item.product.reorderThreshold
              : patch.reorderThreshold,
          stockStatus: patch.stockStatus || item.product.stockStatus,
          isPurchasable:
            patch.isPurchasable === undefined
              ? item.product.isPurchasable
              : patch.isPurchasable,
          allowBackorder:
            patch.allowBackorder === undefined
              ? item.product.allowBackorder
              : patch.allowBackorder,
        }
      : item.product,
  };

  const computedStockStatus = getInventoryComputedStatus(provisional);
  return {
    ...provisional,
    computedStockStatus,
    stockStatus: patch.stockStatus || computedStockStatus,
    isLowStock:
      availableQuantity !== null &&
      resolveLowStockThreshold(provisional) !== null &&
      availableQuantity <= Number(resolveLowStockThreshold(provisional)),
    needsReorder:
      availableQuantity !== null &&
      resolveReorderThreshold(provisional) !== null &&
      availableQuantity <= Number(resolveReorderThreshold(provisional)),
  };
};

export const applyInventoryMovementLocally = (
  item: InventoryItem,
  payload: InventoryMovementPayload
): { item: InventoryItem; movement: InventoryMovement } => {
  const beforeOnHand = resolveInventoryOnHandQuantity(item) ?? 0;
  const beforeReserved = resolveInventoryReservedQuantity(item);
  const absoluteDelta = Math.abs(payload.quantityDelta);
  let quantityAfter = beforeOnHand;
  let reservedAfter = beforeReserved;
  let storedDelta = payload.quantityDelta;

  if (payload.movementType === "RESTOCK") {
    storedDelta = absoluteDelta;
    quantityAfter = beforeOnHand + absoluteDelta;
  } else if (payload.movementType === "DAMAGE") {
    storedDelta = -absoluteDelta;
    quantityAfter = beforeOnHand - absoluteDelta;
  } else if (payload.movementType === "RESERVED") {
    storedDelta = absoluteDelta;
    reservedAfter = beforeReserved + absoluteDelta;
  } else if (payload.movementType === "RELEASED") {
    storedDelta = -absoluteDelta;
    reservedAfter = beforeReserved - absoluteDelta;
  } else if (payload.quantityAfter !== undefined) {
    quantityAfter = payload.quantityAfter;
    storedDelta = quantityAfter - beforeOnHand;
  } else {
    quantityAfter = beforeOnHand + payload.quantityDelta;
  }

  if (quantityAfter < 0) throw new Error("This movement would make stock negative.");
  if (reservedAfter < 0) throw new Error("This movement would make reserved stock negative.");
  if (reservedAfter > quantityAfter) {
    throw new Error("Reserved quantity cannot exceed quantity on hand.");
  }

  const movementTime = new Date().toISOString();
  const updatedItem = applyInventoryPatchLocally(item, {
    quantityOnHand: quantityAfter,
    reservedQuantity: reservedAfter,
    stockStatus: undefined,
  });

  return {
    item: {
      ...updatedItem,
      lastRestockedAt:
        payload.movementType === "RESTOCK" ? movementTime : updatedItem.lastRestockedAt,
    },
    movement: {
      id: `queued-${movementTime}-${item.id}`,
      inventoryItemId: item.id,
      productSlug: item.productSlug,
      variantId: item.variantId || null,
      movementType: payload.movementType,
      quantityDelta: storedDelta,
      quantityBefore: beforeOnHand,
      quantityAfter,
      reservedBefore: beforeReserved,
      reservedAfter,
      supplierId: payload.supplierId || item.supplierId,
      supplier: item.supplier || null,
      reason: payload.reason || null,
      supplierNote: payload.supplierNote || null,
      purchaseNote: payload.purchaseNote || null,
      createdAt: movementTime,
      createdByName: "Queued offline",
    },
  };
};
