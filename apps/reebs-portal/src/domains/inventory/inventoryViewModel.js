const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getQuantity = (item) =>
  toFiniteNumber(item?.quantity ?? item?.stock, 0);

export const getReorderLevel = (item) =>
  toFiniteNumber(item?.reorderLevel ?? item?.reorder_level ?? item?.reorderlevel, 2);

export const getReorderQuantity = (item) =>
  toFiniteNumber(item?.reorderQuantity ?? item?.reorder_quantity ?? item?.reorderquantity, 0);

export const getItemType = (item) =>
  String(item?.itemType || item?.inventoryItemType || "STANDARD").trim().toUpperCase() || "STANDARD";

export const isVariantParentItem = (item) => getItemType(item) === "VARIANT_PARENT";

export const getItemVariants = (item) => (Array.isArray(item?.variants) ? item.variants : []);

export const getVariantAvailableQty = (variant) =>
  Number.isFinite(Number(variant?.availableQty))
    ? Math.max(0, Number(variant.availableQty))
    : Math.max(0, Number(variant?.stockQty ?? 0) - Number(variant?.reservedQty ?? 0));

export const isInactiveVariant = (variant) =>
  String(variant?.status || "active").trim().toLowerCase() === "inactive";

export const getVariantParentStock = (variants) =>
  (Array.isArray(variants) ? variants : []).reduce((sum, variant) => {
    if (isInactiveVariant(variant)) return sum;
    return sum + Math.max(0, Number(variant?.stockQty) || 0);
  }, 0);

export const getReservedQuantity = (item) =>
  Math.max(0, toFiniteNumber(item?.reservedQuantity, 0));

export const getInUseQuantity = (item) =>
  Math.max(0, toFiniteNumber(item?.inUseQuantity, 0));

export const getAvailableQuantity = (item) => {
  if (String(item?.availabilityMode || "").toUpperCase() === "DATE_BASED") return null;
  if (item?.availableQuantity != null) {
    return Math.max(0, toFiniteNumber(item.availableQuantity, 0));
  }
  return Math.max(0, getQuantity(item) - getReservedQuantity(item));
};

export const getStockStatus = (item) => {
  const explicit = String(item?.stockStatus || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (item?.status === false) return "inactive";
  const quantity = getQuantity(item);
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= getReorderLevel(item)) return "low_stock";
  return "available";
};

export const isLowStockItem = (item, quantityOverride) => {
  if (String(item?.sourceCategoryCode || "").trim().toUpperCase() === "RENTAL") return false;
  const quantity = quantityOverride == null ? getQuantity(item) : toFiniteNumber(quantityOverride, 0);
  return quantity > 0 && quantity <= getReorderLevel(item);
};

export const formatStockStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "out_of_stock": return "Out of stock";
    case "low_stock": return "Low stock";
    case "maintenance": return "Maintenance";
    case "inactive": return "Inactive";
    default: return "Available";
  }
};
