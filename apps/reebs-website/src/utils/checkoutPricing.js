import {
  getCartItemBillingQuantity,
  getCartItemPrice,
} from "./cart.js";

const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const priceToCents = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

export const normalizeCheckoutDeliveryDistance = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10) / 10;
};

export const getCheckoutQuoteItemKey = (item = {}) => {
  const productId = positiveInteger(item.productId ?? item.inventoryItemId ?? item.id);
  const variantId = positiveInteger(item.variantId);
  return productId ? `${productId}:${variantId || ""}` : "";
};

/**
 * Builds the public checkout command shape. expectedUnitPriceCents is only a
 * stale-cart guard; the API always reloads and applies the authoritative price.
 */
export const createCheckoutCommandItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const productId = positiveInteger(item.productId ?? item.id);
      const variantId = positiveInteger(item.variantId);
      const expectedUnitPriceCents = priceToCents(getCartItemPrice(item));

      return {
        productId,
        ...(variantId ? { variantId } : {}),
        quantity: getCartItemBillingQuantity(item),
        ...(expectedUnitPriceCents !== null ? { expectedUnitPriceCents } : {}),
      };
    })
    .filter((item) => item.productId);

export const findCheckoutQuotePriceChanges = (commandItems = [], quoteItems = []) => {
  const expectedByItem = new Map(
    (Array.isArray(commandItems) ? commandItems : [])
      .map((item) => [getCheckoutQuoteItemKey(item), item])
      .filter(([key]) => key)
  );

  return (Array.isArray(quoteItems) ? quoteItems : []).flatMap((item) => {
    const expected = expectedByItem.get(getCheckoutQuoteItemKey(item));
    const expectedUnitPriceCents = Number(expected?.expectedUnitPriceCents);
    const authoritativeUnitPriceCents = Number(item?.unitPriceCents);
    if (
      !Number.isFinite(expectedUnitPriceCents)
      || !Number.isFinite(authoritativeUnitPriceCents)
      || expectedUnitPriceCents === authoritativeUnitPriceCents
    ) {
      return [];
    }

    return [{
      productId: Number(item.productId),
      variantId: positiveInteger(item.variantId),
      name: String(item.name || item.itemName || "Shop item"),
      expectedUnitPriceCents,
      authoritativeUnitPriceCents,
    }];
  });
};
