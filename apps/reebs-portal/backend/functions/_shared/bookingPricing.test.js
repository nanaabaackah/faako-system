import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingItemsMatchPriceSnapshot,
  calculateBundleDiscountCents,
  resolveBookingCommercialPricing,
  resolveBookingCommercialPricingForMutation,
  shouldPreserveBookingPriceSnapshot,
} from "./bookingPricing.js";

const RULE_TYPES = {
  booking_bundle_min_items: "INTEGER",
  booking_bundle_discount_bps: "BASIS_POINTS",
  booking_attendant_unit_fee_cents: "MONEY_CENTS",
};

const configRow = ({ key, value, id = 1, effectiveFrom, effectiveTo = null }) => ({
  id,
  organizationId: 7,
  businessUnit: "REEBS_CORE",
  key,
  value: String(value),
  valueType: RULE_TYPES[key],
  effectiveFrom,
  effectiveTo,
  active: true,
  description: null,
  createdByUserId: 3,
  updatedByUserId: 3,
  createdAt: effectiveFrom,
  updatedAt: effectiveFrom,
});

const valuesForInstant = (asOf) => {
  const instant = new Date(asOf).getTime();
  const futureStarted = instant >= new Date("2026-09-01T00:00:00.000Z").getTime();
  return futureStarted
    ? {
        booking_bundle_min_items: 4,
        booking_bundle_discount_bps: 1500,
        booking_attendant_unit_fee_cents: 12000,
      }
    : {
        booking_bundle_min_items: 3,
        booking_bundle_discount_bps: 1000,
        booking_attendant_unit_fee_cents: 10000,
      };
};

const effectiveConfigClient = () => ({
  async query(_sql, params) {
    const [, , key, asOf] = params;
    const futureStarted = new Date(asOf).getTime() >= new Date("2026-09-01T00:00:00.000Z").getTime();
    return {
      rows: [configRow({
        id: futureStarted ? 100 + Object.keys(RULE_TYPES).indexOf(key) : 1 + Object.keys(RULE_TYPES).indexOf(key),
        key,
        value: valuesForInstant(asOf)[key],
        effectiveFrom: futureStarted
          ? "2026-09-01T00:00:00.000Z"
          : "2026-01-01T00:00:00.000Z",
        effectiveTo: futureStarted ? null : "2026-09-01T00:00:00.000Z",
      })],
    };
  },
});

test("booking item comparison ignores ordering but preserves product, variant, and quantity", () => {
  assert.equal(
    bookingItemsMatchPriceSnapshot(
      [
        { productId: 2, variantId: 8, quantity: 1 },
        { productId: 1, quantity: 2 },
      ],
      [
        { productId: 1, variantId: null, quantity: 2, price: 9000 },
        { productId: 2, variantId: 8, quantity: 1, price: 12000 },
      ]
    ),
    true
  );
  assert.equal(
    bookingItemsMatchPriceSnapshot(
      [{ productId: 1, quantity: 3 }],
      [{ productId: 1, quantity: 2, price: 9000 }]
    ),
    false
  );
});

test("metadata-only and unchanged-item booking updates preserve the persisted price snapshot", () => {
  assert.equal(
    shouldPreserveBookingPriceSnapshot({ method: "PUT", hasItemsPayload: false }),
    true
  );
  assert.equal(
    shouldPreserveBookingPriceSnapshot({
      method: "PUT",
      hasItemsPayload: true,
      requestedItems: [{ productId: 1, quantity: 1 }],
      persistedItems: [{ productId: 1, quantity: 1, price: 22000 }],
    }),
    true
  );
  assert.equal(
    shouldPreserveBookingPriceSnapshot({ method: "POST", hasItemsPayload: true }),
    false
  );
});

test("booking repricing resolves the current effective database rules", async () => {
  const pricing = await resolveBookingCommercialPricing(effectiveConfigClient(), {
    organizationId: 7,
    at: "2026-08-31T23:59:59.000Z",
  });

  assert.deepEqual(
    {
      bundleMinimumItems: pricing.bundleMinimumItems,
      bundleDiscountBps: pricing.bundleDiscountBps,
      attendantUnitFeeCents: pricing.attendantUnitFeeCents,
    },
    {
      bundleMinimumItems: 3,
      bundleDiscountBps: 1000,
      attendantUnitFeeCents: 10000,
    }
  );
  assert.equal(
    calculateBundleDiscountCents({
      subtotalCents: 100000,
      itemCount: 3,
      applyBundleDiscount: true,
      ...pricing,
    }),
    10000
  );
});

test("future booking rules become authoritative only at their effective instant", async () => {
  const pricing = await resolveBookingCommercialPricing(effectiveConfigClient(), {
    organizationId: 7,
    at: "2026-09-01T00:00:00.000Z",
  });

  assert.equal(pricing.bundleMinimumItems, 4);
  assert.equal(pricing.bundleDiscountBps, 1500);
  assert.equal(pricing.attendantUnitFeeCents, 12000);
});

test("new booking repricing fails closed when a required database rule is missing", async () => {
  const client = effectiveConfigClient();
  const originalQuery = client.query;
  client.query = async (sql, params) => (
    params[2] === "booking_bundle_discount_bps"
      ? { rows: [] }
      : originalQuery(sql, params)
  );

  await assert.rejects(
    () => resolveBookingCommercialPricing(client, {
      organizationId: 7,
      at: "2026-08-15T12:00:00.000Z",
    }),
    { code: "MISSING_COMMERCIAL_CONFIGURATION", statusCode: 503 }
  );
});

test("historical booking status updates do not consult current commercial rules", async () => {
  let queryCount = 0;
  const pricing = await resolveBookingCommercialPricingForMutation(
    { async query() { queryCount += 1; return { rows: [] }; } },
    {
      organizationId: 7,
      preservePriceSnapshot: true,
      at: "2026-09-01T00:00:00.000Z",
    }
  );

  assert.equal(pricing, null);
  assert.equal(queryCount, 0);
});
