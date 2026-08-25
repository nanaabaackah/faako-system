import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCheckoutQuoteGuard,
  buildCheckoutQuoteFingerprint,
  buildPublicCheckoutQuote,
  findExpectedPriceChanges,
  normalizeCheckoutQuoteFingerprint,
} from "./checkoutQuote.js";

const quote = {
  currency: "GHS",
  items: [
    { productId: 9, variantId: null, name: "Balloons", quantity: 2, unitPriceCents: 2700, lineTotalCents: 5400 },
    { productId: 4, variantId: 3, name: "Banner", quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500 },
  ],
  subtotalCents: 6900,
  discountCents: 0,
  deliveryFeeCents: 0,
  serviceFeeCents: 0,
  grandTotalCents: 6900,
  deliveryMethod: "pickup",
  delivery: { distanceKm: 0, rateCents: 0, commercialConfigId: null },
};

test("quote fingerprint is deterministic across item order and excludes display labels", () => {
  const fingerprint = buildCheckoutQuoteFingerprint({ organizationId: 7, quote });
  const reordered = buildCheckoutQuoteFingerprint({
    organizationId: 7,
    quote: {
      ...quote,
      items: [...quote.items].reverse().map((item) => ({ ...item, name: `New ${item.name}` })),
    },
  });

  assert.equal(fingerprint, reordered);
  assert.match(fingerprint, /^v1\.[a-f0-9]{64}$/);
  assert.equal(normalizeCheckoutQuoteFingerprint(fingerprint.toUpperCase()), fingerprint);
  assert.equal(normalizeCheckoutQuoteFingerprint("not-a-quote"), "");
});

test("quote fingerprint changes whenever an authoritative amount changes", () => {
  const original = buildCheckoutQuoteFingerprint({ organizationId: 7, quote });
  const repriced = buildCheckoutQuoteFingerprint({
    organizationId: 7,
    quote: {
      ...quote,
      items: [{ ...quote.items[0], unitPriceCents: 2800, lineTotalCents: 5600 }, quote.items[1]],
      subtotalCents: 7100,
      grandTotalCents: 7100,
    },
  });
  assert.notEqual(original, repriced);
});

test("price changes are explanatory only and compare expected guards to server values", () => {
  assert.deepEqual(findExpectedPriceChanges([
    { productId: 9, expectedUnitPriceCents: 2500 },
    { productId: 4, variantId: 3, expectedUnitPriceCents: 1500 },
  ], quote.items), [{
    productId: 9,
    variantId: null,
    name: "Balloons",
    expectedUnitPriceCents: 2500,
    authoritativeUnitPriceCents: 2700,
  }]);

  const publicQuote = buildPublicCheckoutQuote({
    organizationId: 7,
    quote,
    expectedItems: [{ productId: 9, expectedUnitPriceCents: 2500 }],
  });
  assert.equal(publicQuote.priceChanged, true);
  assert.equal(publicQuote.priceChanges.length, 1);
  assert.ok(publicQuote.fingerprint);
});

test("order guard requires explicit acknowledgement bound to the current server quote", () => {
  const expectedItems = [{ productId: 9, expectedUnitPriceCents: 2500 }];
  const current = buildPublicCheckoutQuote({ organizationId: 7, quote, expectedItems });

  assert.throws(
    () => assertCheckoutQuoteGuard({ organizationId: 7, quote, expectedItems }),
    (error) => error.code === "CHECKOUT_PRICE_ACKNOWLEDGEMENT_REQUIRED" && error.quote.fingerprint === current.fingerprint
  );
  assert.throws(
    () => assertCheckoutQuoteGuard({
      organizationId: 7,
      quote,
      expectedItems,
      expectedFingerprint: buildCheckoutQuoteFingerprint({ organizationId: 8, quote }),
      acknowledgePriceChanges: true,
    }),
    (error) => error.code === "CHECKOUT_QUOTE_STALE"
  );

  assert.equal(assertCheckoutQuoteGuard({
    organizationId: 7,
    quote,
    expectedItems,
    expectedFingerprint: current.fingerprint,
    acknowledgePriceChanges: true,
  }).fingerprint, current.fingerprint);
});
