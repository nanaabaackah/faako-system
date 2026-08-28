import assert from "node:assert/strict";
import test from "node:test";

import { sanitizePublicCheckoutQuotePayload } from "./checkoutQuote.js";

test("public quote keeps stale-price guards but strips every client commercial total", () => {
  const payload = sanitizePublicCheckoutQuotePayload({
    items: [{ productId: 4, variantId: 9, quantity: 2, expectedUnitPriceCents: 1200 }],
    deliveryMethod: "pickup",
    pickupDetails: { date: "2026-08-20" },
    discountCents: 99999,
    deliveryFeeCents: 1,
    serviceFeeCents: 1,
    grandTotalCents: 1,
    organizationId: 999,
    businessUnit: "WATER",
  });

  assert.deepEqual(payload.items, [{
    productId: 4,
    variantId: 9,
    quantity: 2,
    digitString: "",
    expectedUnitPriceCents: 1200,
  }]);
  assert.equal(payload.source, "checkout");
  assert.equal(payload.organizationId, undefined);
  assert.equal(payload.businessUnit, undefined);
  assert.equal(payload.discountCents, undefined);
  assert.equal(payload.deliveryFeeCents, undefined);
  assert.equal(payload.serviceFeeCents, undefined);
  assert.equal(payload.grandTotalCents, undefined);
});

test("public quote rejects malformed expected prices and identifiers", () => {
  assert.throws(
    () => sanitizePublicCheckoutQuotePayload({ items: [{ productId: "water", quantity: 1 }] }),
    /valid product/
  );
  assert.throws(
    () => sanitizePublicCheckoutQuotePayload({
      items: [{ productId: 4, quantity: 1, expectedUnitPriceCents: -1 }],
    }),
    /expected price/
  );
});
