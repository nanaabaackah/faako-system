const getInventorySourceCategoryCode = (item = {}) =>
  String(
    item.sourceCategoryCode
      || item.sourcecategorycode
      || item.source_category_code
      || "",
  )
    .trim()
    .toUpperCase();

export const isWaterInventoryProduct = (item = {}) =>
  getInventorySourceCategoryCode(item) === "WATER";

export const isCoreOrderProduct = (item = {}) => {
  const sourceCategoryCode = getInventorySourceCategoryCode(item);
  return sourceCategoryCode !== "RENTAL" && sourceCategoryCode !== "WATER";
};

export const isCoreCommercialProduct = (item = {}) =>
  !isWaterInventoryProduct(item);

