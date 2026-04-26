const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeVariantStatus = (value) =>
  String(value || "active")
    .trim()
    .toLowerCase();

const getProductLineKey = (productId, variantId = "") =>
  `${productId}:${variantId || "standard"}`;

const getItemType = (item = {}) =>
  String(item?.itemType || item?.inventoryItemType || "STANDARD").trim().toUpperCase() || "STANDARD";

const isVariantParentItem = (item = {}) => getItemType(item) === "VARIANT_PARENT";

const getItemVariants = (item = {}) => (Array.isArray(item?.variants) ? item.variants : []);

const getActiveItemVariants = (item = {}) =>
  getItemVariants(item).filter((variant) => normalizeVariantStatus(variant?.status) === "active");

const findVariantById = (item = {}, variantId) => {
  const normalizedId = Number(variantId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;
  return getItemVariants(item).find((variant) => Number(variant?.id) === normalizedId) || null;
};

const getVariantAvailableQty = (variant = {}) => {
  const explicit = Number(variant?.availableQty);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return Math.max(0, toPositiveNumber(variant?.stockQty) - toPositiveNumber(variant?.reservedQty));
};

const getBaseItemQuantity = (item = {}) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const getBaseItemPrice = (item = {}) => {
  if (typeof item?.price === "number") return item.price;
  if (typeof item?.price === "string") {
    const parsed = Number(item.price);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof item?.priceCents === "number") return item.priceCents / 100;
  if (typeof item?.priceCents === "string") {
    const parsed = Number(item.priceCents);
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  }
  return 0;
};

const getVariantUnitPrice = (item = {}, variant = null) => {
  if (
    variant
    && variant?.priceOverride !== null
    && typeof variant?.priceOverride !== "undefined"
    && variant?.priceOverride !== ""
  ) {
    const override = Number(variant.priceOverride);
    if (Number.isFinite(override)) return override;
  }
  return getBaseItemPrice(item);
};

const formatVariantLabel = (item = {}, variant = {}, { includeProductName = true } = {}) => {
  const parts = [
    includeProductName ? item?.name : "",
    variant?.variantName,
    variant?.variantNumber,
    variant?.color,
    variant?.size,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return parts.join(" / ");
};

const buildVariantOptionLabel = (item = {}, variant = {}) =>
  formatVariantLabel(item, variant, { includeProductName: false })
  || String(variant?.sku || "").trim()
  || "Variant";

const buildProductSearchText = (item = {}) =>
  [
    item?.name,
    item?.description,
    item?.sku,
    item?.barcode,
    item?.specificCategory,
    item?.sourceCategory,
    item?.sourcecategory,
    item?.sourceCategoryCode,
    ...getItemVariants(item).flatMap((variant) => [
      variant?.sku,
      variant?.variantName,
      variant?.variantNumber,
      variant?.color,
      variant?.size,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getProductAvailableQty = (item = {}, quantityByLineKey = new Map()) => {
  const productId = Number(item?.id ?? item?.productId);

  if (isVariantParentItem(item)) {
    return getActiveItemVariants(item).reduce((sum, variant) => {
      const lineKey = getProductLineKey(productId, variant?.id);
      const inUse = Math.max(0, Number(quantityByLineKey.get(lineKey)) || 0);
      return sum + Math.max(0, getVariantAvailableQty(variant) - inUse);
    }, 0);
  }

  const lineKey = getProductLineKey(productId);
  const inUse = Math.max(0, Number(quantityByLineKey.get(lineKey)) || 0);
  return Math.max(0, getBaseItemQuantity(item) - inUse);
};

const applyInventoryLineQuantityDelta = (product, lineItem, direction = -1) => {
  if (Number(product?.id) !== Number(lineItem?.productId)) return product;

  const quantity = Math.max(0, Number(lineItem?.quantity) || 0);
  const delta = quantity * direction;

  if (!lineItem?.variantId) {
    const nextStock = Math.max(getBaseItemQuantity(product) + delta, 0);
    return { ...product, quantity: nextStock, stock: nextStock };
  }

  const variants = getItemVariants(product).map((variant) => {
    if (Number(variant?.id) !== Number(lineItem.variantId)) return variant;
    const nextStock = Math.max(toPositiveNumber(variant?.stockQty) + delta, 0);
    const reservedQty = toPositiveNumber(variant?.reservedQty);
    return {
      ...variant,
      stockQty: nextStock,
      availableQty: Math.max(nextStock - reservedQty, 0),
    };
  });

  const nextStock = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stockQty) || 0), 0);
  return {
    ...product,
    variants,
    quantity: nextStock,
    stock: nextStock,
  };
};

export {
  applyInventoryLineQuantityDelta,
  buildProductSearchText,
  buildVariantOptionLabel,
  findVariantById,
  formatVariantLabel,
  getActiveItemVariants,
  getBaseItemPrice,
  getBaseItemQuantity,
  getItemType,
  getItemVariants,
  getProductAvailableQty,
  getProductLineKey,
  getVariantAvailableQty,
  getVariantUnitPrice,
  isVariantParentItem,
};
