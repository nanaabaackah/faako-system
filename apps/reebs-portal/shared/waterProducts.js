// Quantities and prices are per whole pack, never per individual bottle/sachet.
export const DEFAULT_WATER_PRODUCT_KEY = "gwater-15pk";
export const WATER_PRODUCTS = Object.freeze([
  Object.freeze({ key: DEFAULT_WATER_PRODUCT_KEY, name: "15pk Gwater", packSize: 15, unit: "pack" }),
  Object.freeze({ key: "sachet-water-30pk", name: "30pcs sachet water", packSize: 30, unit: "pack" }),
]);

export const getWaterProduct = (key = DEFAULT_WATER_PRODUCT_KEY) =>
  WATER_PRODUCTS.find((product) => product.key === key) || null;
