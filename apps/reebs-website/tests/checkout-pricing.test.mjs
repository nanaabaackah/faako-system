import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckoutCommandItems,
  findCheckoutQuotePriceChanges,
  normalizeCheckoutDeliveryDistance,
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
