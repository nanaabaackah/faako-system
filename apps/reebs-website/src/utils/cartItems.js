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
  item.specificCategory || item.specificcategory || item.category || "Rental";

export const getRentalCartItem = (item = {}) => {
  const price = getRentalPrice(item);
  if (!price) return null;

  const originalId = String(item.productId ?? item.id ?? slugify(item.name || "rental")).trim();
  const source =
    String(item.sourceCategoryCode ?? item.sourcecategorycode ?? "rental")
      .trim()
      .toLowerCase() || "rental";
  const nameKey = slugify(item.name || "");
  const variantSuffix = nameKey && nameKey !== originalId ? `-${nameKey}` : "";
  const quantity = getRentalQuantity(item);

  return {
    ...item,
    id: `rental-${source}-${originalId}${variantSuffix}`,
    productId: item.productId ?? item.id ?? null,
    sourceCategoryCode: item.sourceCategoryCode || item.sourcecategorycode || "RENTAL",
    specificCategory: getRentalCategory(item),
    type: getRentalCategory(item),
    price,
    quantity,
    stock: quantity,
  };
};
