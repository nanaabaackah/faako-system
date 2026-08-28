import assert from "node:assert/strict";
import test from "node:test";

import { sanitizePublicCheckoutPayload } from "./createOrder.js";

test("public checkout keeps identifiers but strips client-owned commercial totals", () => {
  const fingerprint = `v1.${"a".repeat(64)}`;
  const payload = sanitizePublicCheckoutPayload({
    customerId: 7,
    items: [{ productId: 4, variantId: 9, quantity: 2, price: 1 }],
    deliveryMethod: "pickup",
    pickupDetails: { date: "2026-08-20" },
    discountCents: 99999,
    deliveryFeeCents: 1,
    serviceFeeCents: 1,
    total: 1,
    status: "completed",
    organizationId: 999,
    quoteFingerprint: fingerprint,
  });

  assert.deepEqual(payload.items, [
    { productId: 4, variantId: 9, quantity: 2, digitString: "" },
  ]);
  assert.equal(payload.status, "pending_payment");
  assert.equal(payload.source, "checkout");
  assert.equal(payload.organizationId, undefined);
  assert.equal(payload.discountCents, undefined);
  assert.equal(payload.deliveryFeeCents, undefined);
  assert.equal(payload.serviceFeeCents, undefined);
  assert.equal(payload.total, undefined);
});

test("public checkout rejects an order command without a current quote", () => {
  assert.throws(
    () => sanitizePublicCheckoutPayload({
      customerId: 7,
      items: [{ productId: 4, quantity: 1 }],
    }),
    (error) => error?.statusCode === 409 && error?.code === "CHECKOUT_QUOTE_REQUIRED"
  );
});

test("public checkout rejects malformed item identifiers", () => {
  assert.throws(
    () => sanitizePublicCheckoutPayload({
      customerId: 7,
      items: [{ productId: "water" }],
      quoteFingerprint: `v1.${"a".repeat(64)}`,
    }),
    /valid product/
  );
});

test("public checkout retains quote guards without accepting a client price as authority", () => {
  const fingerprint = `v1.${"a".repeat(64)}`;
  const payload = sanitizePublicCheckoutPayload({
    customerId: 7,
    items: [{
      productId: 4,
      quantity: 2,
      price: 1,
      expectedUnitPriceCents: 2500,
    }],
    quoteFingerprint: fingerprint,
    acknowledgePriceChanges: true,
  });

  assert.deepEqual(payload.items, [{
    productId: 4,
    variantId: null,
    quantity: 2,
    digitString: "",
    expectedUnitPriceCents: 2500,
  }]);
  assert.equal(payload.items[0].price, undefined);
  assert.equal(payload.quoteFingerprint, fingerprint);
  assert.equal(payload.acknowledgePriceChanges, true);
});

test("public checkout rejects malformed quote guards", () => {
  assert.throws(
    () => sanitizePublicCheckoutPayload({
      customerId: 7,
      items: [{ productId: 4, quantity: 1 }],
      quoteFingerprint: "tampered",
    }),
    /quote is invalid/i
  );
  assert.throws(
    () => sanitizePublicCheckoutPayload({
      customerId: 7,
      items: [{ productId: 4, quantity: 1, expectedUnitPriceCents: -1 }],
      quoteFingerprint: `v1.${"a".repeat(64)}`,
    }),
    /valid product/i
  );
});
