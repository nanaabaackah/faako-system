const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const toPositiveNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") return null;

  const normalized = value.replace(/,/g, "");
  const matches = normalized.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;

  const parsed = Number(matches[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getRentalPrice = (item = {}) => {
  const rawPrice =
    item.price ??
    item.priceRange ??
    (typeof item.priceCents === "number" ? item.priceCents / 100 : null);

  return toPositiveNumber(rawPrice);
};

const getRentalQuantity = (item = {}) =>
  Math.max(0, Number(item.quantity ?? item.stock ?? 0) || 0);

const getRentalCategory = (item = {}) =>
  item.category || item.inventoryCategory || item.specificCategory || item.specificcategory || "Rental";

export const getRentalCartItem = (item = {}) => {
  const price = getRentalPrice(item);
  if (!price) return null;

  const originalId = String(item.productId ?? item.id ?? slugify(item.name || "rental")).trim();
  const productCode =
    String(item.inventoryProductCode ?? item.productGroupCode ?? item.productCode ?? item.sourceCategoryCode ?? item.sourcecategorycode ?? "rental")
      .trim()
      .toLowerCase() || "rental";
  const nameKey = slugify(item.name || "");
  const variantSuffix = nameKey && nameKey !== originalId ? `-${nameKey}` : "";
  const quantity = getRentalQuantity(item);

  return {
    ...item,
    id: `rental-${productCode}-${originalId}${variantSuffix}`,
    productId: item.productId ?? item.id ?? null,
    sourceCategoryCode: item.sourceCategoryCode || item.sourcecategorycode || item.inventoryProductCode || item.productGroupCode || "RENTAL",
    inventoryProductCode: item.inventoryProductCode || item.productGroupCode || item.productCode || item.sourceCategoryCode || item.sourcecategorycode || "RENTAL",
    specificCategory: getRentalCategory(item),
    category: getRentalCategory(item),
    type: getRentalCategory(item),
    price,
    quantity,
    stock: quantity,
  };
};
