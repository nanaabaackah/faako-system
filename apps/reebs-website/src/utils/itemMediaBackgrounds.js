const SHOP_BG_ASSETS = [
  "/imgs/shopbg/img_1.png",
  "/imgs/shopbg/img_2.png",
  "/imgs/shopbg/img_3.png",
  "/imgs/shopbg/img_4.png",
  "/imgs/shopbg/img_5.png",
  "/imgs/shopbg/img_6.png",
  "/imgs/shopbg/img_7.png",
];

const SHOP_CATEGORY_BG_MAP = {
  "party supplies": "/imgs/shopbg/img_1.png",
  "kids toys": "/imgs/shopbg/img_2.png",
  toys: "/imgs/shopbg/img_2.png",
  "household supplies": "/imgs/shopbg/img_3.png",
  "home supplies": "/imgs/shopbg/img_3.png",
  stationery: "/imgs/shopbg/img_4.png",
  "event supplies": "/imgs/shopbg/img_5.png",
  "gift items": "/imgs/shopbg/img_6.png",
  other: "/imgs/shopbg/img_7.png",
  test: "/imgs/shopbg/img_7.png",
};

const RENTAL_CATEGORY_BG_MAP = {
  "bouncy castles": "/imgs/rentalbg/img_1.png",
  "kids rentals": "/imgs/rentalbg/img_2.png",
  "indoor games": "/imgs/rentalbg/img_3.png",
  setup: "/imgs/rentalbg/img_4.png",
};

const hashString = (value = "") => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const normalizeCategoryKey = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getSourceCode = (item = {}) =>
  (item.sourceCategoryCode || item.sourcecategorycode || "")
    .toString()
    .trim()
    .toLowerCase();

const getSku = (item = {}) =>
  (item.sku || "")
    .toString()
    .trim()
    .toUpperCase();

const getItemName = (item = {}) =>
  item.name || item.productName || "";

const getItemCategory = (item = {}) =>
  item.specificCategory ||
  item.specificcategory ||
  item.type ||
  item.category ||
  item.productCategory ||
  "";

const PLACEHOLDER_IMAGE = "/imgs/ui/placeholder.png";
const UNSAFE_MEDIA_SCHEME = /^(?:data|javascript|vbscript|file):/i;
const HAS_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const HAS_UNSAFE_URL_CHARACTERS = /["'<>\\]/;
const ABSOLUTE_URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export const sanitizeCatalogMediaUrl = (value, fallback = PLACEHOLDER_IMAGE) => {
  const raw = value?.toString().trim() || "";
  if (!raw) return fallback;
  if (HAS_CONTROL_CHARACTERS.test(raw) || HAS_UNSAFE_URL_CHARACTERS.test(raw)) {
    return fallback;
  }
  if (UNSAFE_MEDIA_SCHEME.test(raw)) {
    return fallback;
  }
  if (ABSOLUTE_URL_SCHEME.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
      return parsed.toString();
    } catch {
      return fallback;
    }
  }
  if (/^(?:\/|\.\.\/|\.\/)/.test(raw)) {
    return raw;
  }
  return fallback;
};

export const toCatalogCssImageValue = (value, fallback = PLACEHOLDER_IMAGE) => {
  const safeUrl = sanitizeCatalogMediaUrl(value, fallback);
  return safeUrl ? `url("${safeUrl}")` : "none";
};

export const createCatalogCssImageStyle = (
  value,
  cssVariableName = "--item-category-bg",
  fallback = PLACEHOLDER_IMAGE
) => ({
  [cssVariableName]: toCatalogCssImageValue(value, fallback),
});

export const getCatalogItemImage = (item = {}) =>
  sanitizeCatalogMediaUrl(
    item.image ||
      item.imageUrl ||
      item.image_url ||
      item.productImage,
    PLACEHOLDER_IMAGE
  );

const hasCatalogMachineMeta = (item = {}) =>
  [item.power, item.footprint, item.output].some((value) => value !== undefined && value !== null && `${value}`.trim());

export const isCatalogMachineItem = (item = {}) => {
  const name = normalizeCategoryKey(getItemName(item));
  const category = normalizeCategoryKey(getItemCategory(item));

  if (!name && !category) return false;
  if (name.includes("machine")) return true;
  if (category.includes("machine")) return true;
  if (hasCatalogMachineMeta(item)) return true;

  return (
    name.includes("popcorn") ||
    name.includes("cotton candy") ||
    name.includes("snow cone") ||
    name.includes("snowcone") ||
    category.includes("popcorn") ||
    category.includes("cotton candy") ||
    category.includes("snow cone") ||
    category.includes("snowcone")
  );
};

const getShopCategoryKey = (item = {}) => {
  const key = normalizeCategoryKey(getItemCategory(item));
  if (!key) return "";

  if (["kids toys", "kid toys", "kids toy", "kid toy"].includes(key)) {
    return "kids toys";
  }
  if (["party supplies", "party supply"].includes(key)) {
    return "party supplies";
  }
  if (
    [
      "household supplies",
      "household supply",
      "household items",
      "household item",
      "home supplies",
      "home supply",
      "home items",
      "home item",
    ].includes(key)
  ) {
    return "household supplies";
  }
  if (["gift items", "gift item"].includes(key)) {
    return "gift items";
  }

  return key;
};

const getRentalCategoryKey = (item = {}) => {
  const category = normalizeCategoryKey(getItemCategory(item));
  const name = normalizeCategoryKey(getItemName(item));

  if (
    category.includes("bouncy") ||
    name.includes("bouncy") ||
    name.includes("bounce house") ||
    name.includes("castle")
  ) {
    return "bouncy castles";
  }
  if (
    category.includes("indoor") ||
    category.includes("board game") ||
    category.includes("jenga") ||
    name.includes("indoor game") ||
    name.includes("board game") ||
    name.includes("jenga")
  ) {
    return "indoor games";
  }
  if (category.includes("machine") || category.includes("setup")) {
    return "setup";
  }
  if (
    category.includes("kids") ||
    category.includes("kid") ||
    category.includes("rental") ||
    name.includes("popcorn") ||
    name.includes("snow cone") ||
    name.includes("snowcone") ||
    name.includes("cotton candy")
  ) {
    return "kids rentals";
  }

  return "";
};

const isRentalLikeItem = (item = {}) => {
  const source = getSourceCode(item);
  if (source) return source === "rental";
  if (getSku(item).startsWith("REN")) return true;
  return Boolean(getRentalCategoryKey(item));
};

const toDisplayTitleCase = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());

export const getCatalogItemDisplayName = (item = {}, fallback = "Item") => {
  const raw = `${getItemName(item) || ""}`.trim();
  if (!raw) return fallback;

  const machineAdjusted =
    isCatalogMachineItem(item) && !normalizeCategoryKey(raw).includes("machine")
      ? `${raw} Machine`
      : raw;

  return isRentalLikeItem(item) ? machineAdjusted : toDisplayTitleCase(machineAdjusted);
};

export const getCatalogItemBackground = (item = {}) => {
  const image = getCatalogItemImage(item);

  if (isRentalLikeItem(item)) {
    const rentalCategoryKey = getRentalCategoryKey(item);
    return RENTAL_CATEGORY_BG_MAP[rentalCategoryKey] || image;
  }

  const shopCategoryKey = getShopCategoryKey(item);
  if (!shopCategoryKey) return image;
  if (SHOP_CATEGORY_BG_MAP[shopCategoryKey]) {
    return SHOP_CATEGORY_BG_MAP[shopCategoryKey];
  }

  const fallbackIndex =
    hashString(shopCategoryKey || getItemName(item) || "other") % SHOP_BG_ASSETS.length;
  return SHOP_BG_ASSETS[fallbackIndex];
};

export const getCatalogItemBackgroundStyle = (
  item = {},
  cssVariableName = "--item-category-bg"
) => createCatalogCssImageStyle(getCatalogItemBackground(item), cssVariableName);
