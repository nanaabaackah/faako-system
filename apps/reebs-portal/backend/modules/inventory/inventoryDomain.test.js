import assert from "node:assert/strict";
import test from "node:test";
import {
  STOCK_MOVEMENT_TYPES,
  normalizeInventoryAdjustment,
  normalizeInventoryIdempotencyKey,
  normalizeSoldMonth,
} from "./inventoryDomain.js";

test("normalizes a safe stock adjustment without trusting actor fields", () => {
  const result = normalizeInventoryAdjustment({
    productId: "12",
    variantId: "4",
    type: "stockout",
    quantity: "2",
    soldMonth: "2026-08",
    idempotencyKey: "inventory-adjustment-123",
    notes: "  Damaged   during setup  ",
    userId: 999,
  });

  assert.deepEqual(result.value, {
    productId: 12,
    variantId: 4,
    quantity: 2,
    type: STOCK_MOVEMENT_TYPES.OUT,
    delta: -2,
    idempotencyKey: "inventory-adjustment-123",
    soldMonth: "2026-08-01",
    reasonCode: "REMOVE",
    notes: "Damaged during setup",
    reference: null,
  });
});

test("rejects negative, fractional, and zero inventory quantities", () => {
  for (const quantity of [-1, 0, 1.5, "two"]) {
    const result = normalizeInventoryAdjustment({ productId: 1, type: "StockIn", quantity });
    assert.match(result.error, /positive whole number/i);
  }
});

test("accepts only stable idempotency keys and supported month formats", () => {
  assert.equal(normalizeInventoryIdempotencyKey("short"), null);
  assert.equal(normalizeInventoryIdempotencyKey("inventory-123"), "inventory-123");
  assert.equal(normalizeSoldMonth("2026-08"), "2026-08-01");
  assert.equal(normalizeSoldMonth("31/08/2026"), undefined);
});
