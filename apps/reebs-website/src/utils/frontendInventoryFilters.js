const normalizeText = (value) => {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
};

const APPAREL_TERMS = [
  /\bcloth(?:e|es|ing)?\b/i,
  /\bapparel\b/i,
  /\bgarment(?:s)?\b/i,
  /\bshoe(?:s)?\b/i,
  /\bsneaker(?:s)?\b/i,
  /\bsandal(?:s)?\b/i,
  /\bslipper(?:s)?\b/i,
];

const WATER_TERMS = [/\bg[\s-]?water\b/i, /\bwater\b/i];

const getItemTextForFrontendFiltering = (item = {}) =>
  [
    item.inventoryProductCode,
    item.inventoryProductName,
    item.productGroupCode,
    item.productGroupName,
    item.productCode,
    item.productName,
    item.category,
    item.inventoryCategory,
    item.sourceCategoryCode,
    item.sourcecategorycode,
    item.specificCategory,
    item.specificcategory,
    item.category,
    item.type,
    item.name,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");

const hasAnyMatch = (text, matchers) => matchers.some((matcher) => matcher.test(text));

export const isTestCategoryItem = (item = {}) => {
  const text = [
    item.inventoryProductCode,
    item.inventoryProductName,
    item.productGroupCode,
    item.productGroupName,
    item.productCode,
    item.productName,
    item.category,
    item.inventoryCategory,
    item.sourceCategoryCode,
    item.sourcecategorycode,
    item.specificCategory,
    item.specificcategory,
    item.category,
    item.type,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");

  if (!text) return false;
  return /\btest\b/i.test(text);
};

export const isFrontendHiddenProduct = (item = {}) => {
  const productCode = normalizeText(
    item.inventoryProductCode || item.productGroupCode || item.productCode || item.sourceCategoryCode || item.sourcecategorycode
  );
  if (productCode === "water" || productCode === "g-water" || productCode === "gwater") return true;

  const text = getItemTextForFrontendFiltering(item);
  if (!text) return false;

  return hasAnyMatch(text, APPAREL_TERMS) || hasAnyMatch(text, WATER_TERMS);
};

export const isOnlineShopItem = (item = {}) => {
  const productCode = normalizeText(
    item.inventoryProductCode || item.productGroupCode || item.productCode || item.sourceCategoryCode || item.sourcecategorycode
  );
  const sku = normalizeText(item.sku);
  const isRental = productCode ? productCode === "rental" : sku.startsWith("ren");
  if (isRental) return false;
  return !isFrontendHiddenProduct(item);
};
