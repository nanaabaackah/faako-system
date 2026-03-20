import {
  getCatalogItemBackground,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";

const asHomeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toHomeTitleCase = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getHomeItemStatus = (item = {}) => {
  if (typeof item?.status === "string") return item.status.toLowerCase();
  if (item?.status === false || item?.isActive === false) return "unavailable";
  return "available";
};

export const formatHeroStatValue = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "...";
  if (value >= 1000) {
    const compact =
      value >= 10000
        ? Math.round(value / 1000)
        : Math.round((value / 1000) * 10) / 10;
    return `${String(compact).replace(/\.0$/, "")}k+`;
  }
  return `${value}+`;
};

export const getHomeRentalCategory = (rental = {}) => {
  const category = `${rental.specificCategory || rental.specificcategory || rental.category || ""}`.toLowerCase();
  const name = `${rental.name || ""}`.toLowerCase();

  if (category.includes("bouncy")) return "bouncy castles";
  if (category.includes("indoor") || category.includes("board game") || category.includes("jenga")) {
    return "indoor games";
  }
  if (category.includes("machine") || category.includes("setup")) return "setup";
  if (category.includes("kids") || category.includes("kid") || category.includes("rental")) {
    return "kids rentals";
  }
  if (
    name.includes("popcorn") ||
    name.includes("snow cone") ||
    name.includes("snowcone") ||
    name.includes("cotton candy")
  ) {
    return "kids rentals";
  }

  return "";
};

export const getHomeRentalImage = (rental = {}) => getCatalogItemImage(rental);

export const getHomeRentalBackground = (rental = {}) =>
  getCatalogItemBackground(rental);

export const getHomeRentalPopularityScore = (rental = {}) => {
  const name = `${rental.name || ""}`.toLowerCase();
  const category = getHomeRentalCategory(rental);
  const quantity = Math.max(0, asHomeNumber(rental.quantity ?? rental.stock, 0));
  const image = getHomeRentalImage(rental);
  let score = 0;

  if (name.includes("bouncy") || name.includes("castle")) score += 100;
  if (name.includes("trampoline")) score += 86;
  if (name.includes("popcorn")) score += 84;
  if (name.includes("cotton candy")) score += 82;
  if (name.includes("snow cone") || name.includes("snowcone")) score += 78;
  if (name.includes("face paint") || name.includes("face painting")) score += 66;

  if (category === "kids rentals") score += 42;
  if (category === "bouncy castles") score += 32;
  if (category === "setup") score += 22;
  if (category === "indoor games") score += 16;

  score += Math.min(quantity, 40);
  if (image.includes("placeholder")) score -= 40;
  if ((rental.status ?? rental.isActive) === false) score -= 1000;

  return score;
};

export const getHomeShopQuantity = (item = {}) =>
  Math.max(0, asHomeNumber(item.quantity ?? item.stock, 0));

export const getHomeShopImage = (item = {}) => getCatalogItemImage(item);

export const getHomeShopCategory = (item = {}) =>
  toHomeTitleCase(
    item.specificCategory || item.specificcategory || item.type || item.category || "Shop item"
  );

export const getHomeShopBackground = (item = {}) => getCatalogItemBackground(item);

export const getHomeShopPrice = (item = {}) => {
  const rawPrice =
    item.price ??
    (typeof item.priceCents === "number" ? item.priceCents / 100 : undefined);
  const parsed = Number(rawPrice);
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasHomeShopImage = (item = {}) =>
  !getHomeShopImage(item).toString().trim().toLowerCase().includes("placeholder");

export const isHomeShopSoldOut = (item = {}) =>
  getHomeItemStatus(item) === "unavailable" || getHomeShopQuantity(item) <= 0;

export const getHomeShopPopularityScore = (item = {}) => {
  let score = getHomeShopQuantity(item);
  if (hasHomeShopImage(item)) score += 18;
  if (!isHomeShopSoldOut(item)) score += 28;
  if (getHomeShopPrice(item)) score += 6;
  return score;
};
