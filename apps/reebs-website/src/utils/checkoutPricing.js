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

/** Read-only preflight. Never submits an order or automatically retries one. */
export const quoteCheckoutForConfirmation = async ({
  payload,
  reviewedFingerprint = "",
  request = fetch,
}) => {
  const response = await request("/api/checkoutQuote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const quote = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(quote?.error || "Unable to verify current shop prices. Please try again.");
  }
  const centsFields = ["subtotalCents", "discountCents", "deliveryFeeCents", "serviceFeeCents", "grandTotalCents"];
  const validMoney = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!quote || !/^v1\.[a-f0-9]{64}$/.test(quote.fingerprint || "")
    || quote.currency !== "GHS"
    || !centsFields.every((field) => validMoney(quote[field]))
    || !Array.isArray(quote.items) || quote.items.length === 0
    || quote.items.some((item) => !validMoney(item.unitPriceCents) || !validMoney(item.lineTotalCents)
      || !positiveInteger(item.quantity) || item.lineTotalCents !== item.unitPriceCents * item.quantity)
    || quote.items.reduce((sum, item) => sum + item.lineTotalCents, 0) !== quote.subtotalCents
    || quote.subtotalCents - quote.discountCents + quote.deliveryFeeCents + quote.serviceFeeCents !== quote.grandTotalCents) {
    throw new Error("The shop quote is incomplete. Please try again before confirming.");
  }
  const quantities = (items) => items.reduce((result, item) => {
    const key = getCheckoutQuoteItemKey(item);
    result.set(key, (result.get(key) || 0) + item.quantity);
    return result;
  }, new Map());
  const expected = quantities(payload.items);
  const actual = quantities(quote.items);
  if (expected.size !== actual.size || [...expected].some(([key, quantity]) => !key || actual.get(key) !== quantity)) {
    throw new Error("The shop quote does not match your cart. Refresh the cart before confirming.");
  }
  const priceChanges = findCheckoutQuotePriceChanges(payload.items, quote.items);
  const cartTotalCents = payload.items.reduce((sum, item) => sum + item.expectedUnitPriceCents * item.quantity, 0);
  const requiresReview = reviewedFingerprint !== quote.fingerprint
    && (Boolean(reviewedFingerprint) || priceChanges.length > 0 || quote.grandTotalCents !== cartTotalCents);
  return {
    quote,
    priceChanges,
    requiresReview,
    acknowledgePriceChanges: !requiresReview && priceChanges.length > 0,
  };
};
