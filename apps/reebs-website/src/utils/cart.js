export const normalizeCartKey = (value) => String(value ?? "").trim();

const PER_HEAD_RATE_PATTERN = /\b(per head|per person|per guest)\b/i;

const toCartNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export const getCartItemKey = (item = {}) =>
  normalizeCartKey(item.id ?? item.productId ?? item.slug ?? item.name);

export const normalizeCartSource = (item = {}) =>
  (item?.cartKind || item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .toString()
    .trim()
    .toLowerCase();

export const isRentalCartItem = (item = {}) => {
  const source = normalizeCartSource(item);
  if (source) return source === "rental";
  return (item?.sku || "").toString().toUpperCase().startsWith("REN");
};

export const getCartItemSectionKey = (item = {}) =>
  isRentalCartItem(item) ? "rentals" : "shop";

export const splitCartItems = (items = []) =>
  (Array.isArray(items) ? items : []).reduce(
    (groups, item) => {
      const sectionKey = getCartItemSectionKey(item);
      groups[sectionKey].push(item);
      return groups;
    },
    { rentals: [], shop: [] }
  );

export const getCartItemPrice = (item = {}) =>
  toCartNumber(item.price) ??
  (typeof item.priceCents === "number" ? item.priceCents / 100 : 0);

export const getCartItemQuantity = (item = {}) =>
  Math.max(0, Number(item.quantity ?? item.stock ?? 0) || 0);

export const isPerHeadCartItem = (item = {}) =>
  PER_HEAD_RATE_PATTERN.test(String(item?.rate || ""));

export const getCartItemRateLabel = (item = {}, fallback = null) => {
  const rate = String(item?.rate || "").trim();
  if (rate) return rate;
  if (isRentalCartItem(item)) return fallback || "per booking";
  return fallback || "each";
};

export const isCartItemStockTracked = (item = {}) =>
  !(isRentalCartItem(item) && isPerHeadCartItem(item));

export const getCartItemMaxSelectableQuantity = (item = {}) =>
  isCartItemStockTracked(item) ? getCartItemQuantity(item) : 999;

export const getCartItemBillingQuantity = (item = {}) =>
  Math.max(1, parseInt(item?.cartQuantity, 10) || 1);

export const getCartItemLineTotal = (item = {}) =>
  getCartItemPrice(item) * getCartItemBillingQuantity(item);

export const getCartItemQuantityLabel = (item = {}) =>
  isPerHeadCartItem(item) ? "Guest count" : "Quantity";

const normalizeCartCategory = (value) => {
  const raw = (value || "").toString().trim();
  const lowered = raw.toLowerCase();
  if (!raw) return null;
  if (lowered.includes("bouncy")) return "Bouncy Castles";
  if (lowered.includes("kid") && lowered.includes("rental")) return "Kids Rentals";
  if (lowered.includes("machine") || lowered.includes("setup")) return "Setup";
  if (lowered.includes("indoor") || lowered.includes("board game") || lowered.includes("jenga")) {
    return "Indoor Games";
  }
  return raw;
};

const isKidsPartyMachine = (item = {}) => {
  const name = `${item?.name || ""}`.toLowerCase();
  return (
    name.includes("popcorn") ||
    name.includes("snow cone") ||
    name.includes("snowcone") ||
    name.includes("cotton candy")
  );
};

export const getCartItemCategory = (item = {}) => {
  if (isKidsPartyMachine(item)) return "Kids Rentals";
  return normalizeCartCategory(
    item.specificCategory || item.specificcategory || item.type || item.category || null
  );
};
