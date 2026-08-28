import { createHash } from "node:crypto";

const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const nonNegativeCents = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
};

const quoteItemKey = (item = {}) => {
  const productId = positiveInteger(item.productId ?? item.inventoryItemId);
  const variantId = positiveInteger(item.variantId);
  return productId ? `${productId}:${variantId || ""}` : "";
};

const canonicalQuote = ({ organizationId, quote = {} }) => ({
  version: 1,
  organizationId: positiveInteger(organizationId),
  currency: String(quote.currency || "GHS").toUpperCase(),
  items: (Array.isArray(quote.items) ? quote.items : [])
    .map((item) => ({
      productId: positiveInteger(item.productId),
      variantId: positiveInteger(item.variantId),
      quantity: positiveInteger(item.quantity),
      unitPriceCents: nonNegativeCents(item.unitPriceCents),
      lineTotalCents: nonNegativeCents(item.lineTotalCents),
    }))
    .sort((left, right) => quoteItemKey(left).localeCompare(quoteItemKey(right))),
  subtotalCents: nonNegativeCents(quote.subtotalCents),
  discountCents: nonNegativeCents(quote.discountCents) || 0,
  deliveryFeeCents: nonNegativeCents(quote.deliveryFeeCents) || 0,
  serviceFeeCents: nonNegativeCents(quote.serviceFeeCents) || 0,
  grandTotalCents: nonNegativeCents(quote.grandTotalCents),
  deliveryMethod: String(quote.deliveryMethod || "pickup").toLowerCase(),
  deliveryRateCents: nonNegativeCents(quote.delivery?.rateCents) || 0,
  deliveryConfigId: positiveInteger(quote.delivery?.commercialConfigId),
});

/**
 * An integrity-neutral stale quote fingerprint. It never authorizes a price;
 * order creation independently reloads authoritative catalogue/config values.
 */
export const buildCheckoutQuoteFingerprint = ({ organizationId, quote }) => {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalQuote({ organizationId, quote })))
    .digest("hex");
  return `v1.${digest}`;
};

export const normalizeCheckoutQuoteFingerprint = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^v1\.[a-f0-9]{64}$/.test(normalized) ? normalized : "";
};

export const findExpectedPriceChanges = (expectedItems = [], quotedItems = []) => {
  const expectedByItem = new Map(
    (Array.isArray(expectedItems) ? expectedItems : [])
      .map((item) => [quoteItemKey(item), item])
      .filter(([key]) => key)
  );

  return (Array.isArray(quotedItems) ? quotedItems : []).flatMap((item) => {
    const expected = expectedByItem.get(quoteItemKey(item));
    const expectedUnitPriceCents = nonNegativeCents(expected?.expectedUnitPriceCents);
    const authoritativeUnitPriceCents = nonNegativeCents(item?.unitPriceCents);
    if (
      expectedUnitPriceCents === null
      || authoritativeUnitPriceCents === null
      || expectedUnitPriceCents === authoritativeUnitPriceCents
    ) {
      return [];
    }
    return [{
      productId: positiveInteger(item.productId),
      variantId: positiveInteger(item.variantId),
      name: String(item.name || item.itemName || "Shop item"),
      expectedUnitPriceCents,
      authoritativeUnitPriceCents,
    }];
  });
};

export const buildPublicCheckoutQuote = ({ organizationId, quote, expectedItems = [] }) => {
  const fingerprint = buildCheckoutQuoteFingerprint({ organizationId, quote });
  const priceChanges = findExpectedPriceChanges(expectedItems, quote?.items);
  return {
    ...quote,
    fingerprint,
    priceChanged: priceChanges.length > 0,
    priceChanges,
  };
};

export const assertCheckoutQuoteGuard = ({
  organizationId,
  quote,
  expectedItems = [],
  expectedFingerprint = "",
  acknowledgePriceChanges = false,
}) => {
  const publicQuote = buildPublicCheckoutQuote({ organizationId, quote, expectedItems });
  const normalizedFingerprint = normalizeCheckoutQuoteFingerprint(expectedFingerprint);
  if (normalizedFingerprint && normalizedFingerprint !== publicQuote.fingerprint) {
    const error = new Error("Shop prices or fees changed after the quote. Review the latest total before confirming.");
    error.statusCode = 409;
    error.code = "CHECKOUT_QUOTE_STALE";
    error.quote = publicQuote;
    throw error;
  }
  if (
    publicQuote.priceChanged
    && (!normalizedFingerprint || acknowledgePriceChanges !== true)
  ) {
    const error = new Error("Current shop prices must be reviewed and accepted before confirming.");
    error.statusCode = 409;
    error.code = "CHECKOUT_PRICE_ACKNOWLEDGEMENT_REQUIRED";
    error.quote = publicQuote;
    throw error;
  }
  return publicQuote;
};
