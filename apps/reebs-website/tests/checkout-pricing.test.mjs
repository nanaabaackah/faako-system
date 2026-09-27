import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckoutCommandItems,
  findCheckoutQuotePriceChanges,
  normalizeCheckoutDeliveryDistance,
  quoteCheckoutForConfirmation,
} from "../src/utils/checkoutPricing.js";

test("checkout command sends expected prices only as cents-based stale-cart guards", () => {
  assert.deepEqual(createCheckoutCommandItems([
    { id: 12, price: 27, cartQuantity: 2 },
    { productId: 15, variantId: 8, priceCents: 1250, cartQuantity: 1 },
  ]), [
    { productId: 12, quantity: 2, expectedUnitPriceCents: 2700 },
    { productId: 15, variantId: 8, quantity: 1, expectedUnitPriceCents: 1250 },
  ]);
});

test("quote comparison identifies authoritative price changes by product and variant", () => {
  const commandItems = [
    { productId: 12, quantity: 2, expectedUnitPriceCents: 2700 },
    { productId: 15, variantId: 8, quantity: 1, expectedUnitPriceCents: 1250 },
  ];
  const changes = findCheckoutQuotePriceChanges(commandItems, [
    { productId: 12, variantId: null, name: "Balloons", unitPriceCents: 2900 },
    { productId: 15, variantId: 8, name: "Banner, blue", unitPriceCents: 1250 },
  ]);

  assert.deepEqual(changes, [{
    productId: 12,
    variantId: null,
    name: "Balloons",
    expectedUnitPriceCents: 2700,
    authoritativeUnitPriceCents: 2900,
  }]);
});

test("quote comparison does not invent a change when a legacy client supplied no guard", () => {
  assert.deepEqual(findCheckoutQuotePriceChanges(
    [{ productId: 12, quantity: 1 }],
    [{ productId: 12, name: "Balloons", unitPriceCents: 2900 }]
  ), []);
});

test("delivery distance is positive and normalized before the public quote", () => {
  assert.equal(normalizeCheckoutDeliveryDistance("12.44"), 12.4);
  assert.equal(normalizeCheckoutDeliveryDistance(0), null);
  assert.equal(normalizeCheckoutDeliveryDistance(""), null);
  assert.equal(normalizeCheckoutDeliveryDistance("unknown"), null);
});

const quotePayload = {
  items: [{ productId: 12, quantity: 2, expectedUnitPriceCents: 2700 }],
  deliveryMethod: "pickup",
};
const makeQuote = (overrides = {}) => ({
  fingerprint: `v1.${"a".repeat(64)}`,
  currency: "GHS",
  items: [{ productId: 12, variantId: null, name: "Balloons", quantity: 2, unitPriceCents: 2700, lineTotalCents: 5400 }],
  subtotalCents: 5400,
  discountCents: 0,
  deliveryFeeCents: 0,
  serviceFeeCents: 0,
  grandTotalCents: 5400,
  ...overrides,
});
const quoteRequest = (quote, status = 200) => async () => ({ ok: status < 400, json: async () => quote });

test("checkout fetches a quote before order creation without treating client prices as authoritative", async () => {
  const calls = [];
  const result = await quoteCheckoutForConfirmation({
    payload: quotePayload,
    request: async (url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body) });
      return quoteRequest(makeQuote())();
    },
  });
  assert.deepEqual(calls, [{ url: "/api/checkoutQuote", method: "POST", body: quotePayload }]);
  assert.equal(result.requiresReview, false);
  assert.equal(result.acknowledgePriceChanges, false);
  assert.equal(result.quote.fingerprint, makeQuote().fingerprint);
});

test("changed unit prices need review before the matching quote can be acknowledged", async () => {
  const quote = makeQuote({
    items: [{ productId: 12, name: "Balloons", quantity: 2, unitPriceCents: 3000, lineTotalCents: 6000 }],
    subtotalCents: 6000,
    grandTotalCents: 6000,
  });
  const initial = await quoteCheckoutForConfirmation({ payload: quotePayload, request: quoteRequest(quote) });
  assert.equal(initial.requiresReview, true);
  assert.equal(initial.acknowledgePriceChanges, false);
  const reviewed = await quoteCheckoutForConfirmation({
    payload: quotePayload, reviewedFingerprint: quote.fingerprint, request: quoteRequest(quote),
  });
  assert.equal(reviewed.requiresReview, false);
  assert.equal(reviewed.acknowledgePriceChanges, true);
});

test("fee changes also require review even when item prices are unchanged", async () => {
  const result = await quoteCheckoutForConfirmation({
    payload: quotePayload,
    request: quoteRequest(makeQuote({ serviceFeeCents: 500, grandTotalCents: 5900 })),
  });
  assert.equal(result.priceChanges.length, 0);
  assert.equal(result.requiresReview, true);
});

test("a quote that changes again cannot reuse acknowledgement of an earlier fingerprint", async () => {
  const result = await quoteCheckoutForConfirmation({
    payload: quotePayload,
    reviewedFingerprint: `v1.${"b".repeat(64)}`,
    request: quoteRequest(makeQuote()),
  });
  assert.equal(result.requiresReview, true);
});

test("failed quote requests surface the error without creating or retrying an order", async () => {
  let requests = 0;
  await assert.rejects(quoteCheckoutForConfirmation({
    payload: quotePayload,
    request: async () => { requests += 1; return quoteRequest({ error: "Insufficient stock." }, 409)(); },
  }), /Insufficient stock/);
  assert.equal(requests, 1);
});

test("incomplete or internally inconsistent quote responses fail closed", async () => {
  for (const quote of [[], null, makeQuote({ fingerprint: "" }), makeQuote({ currency: "USD" }),
    makeQuote({ grandTotalCents: 100 }), makeQuote({ serviceFeeCents: -1 })]) {
    await assert.rejects(quoteCheckoutForConfirmation({
      payload: quotePayload, request: quoteRequest(quote),
    }), /quote is incomplete/);
  }
});

test("a quote for a different product or quantity cannot be submitted", async () => {
  for (const productId of [15, null]) {
    await assert.rejects(quoteCheckoutForConfirmation({
      payload: quotePayload,
      request: quoteRequest(makeQuote({ items: [{ productId, quantity: 2, unitPriceCents: 2700, lineTotalCents: 5400 }] })),
    }), /does not match your cart/);
  }
  await assert.rejects(quoteCheckoutForConfirmation({
    payload: quotePayload,
    request: quoteRequest(makeQuote({ items: [{ productId: 12, quantity: 1, unitPriceCents: 5400, lineTotalCents: 5400 }] })),
  }), /does not match your cart/);
});
