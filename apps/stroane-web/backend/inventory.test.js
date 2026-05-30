import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInventoryMovementState,
  calculateAvailableQuantity,
  evaluateStockStatus,
} from "./src/inventory/services.js";
import { validateMovementPayload } from "./src/inventory/validation.js";

test("calculates available quantity from on-hand and reserved stock", () => {
  assert.equal(calculateAvailableQuantity(12, 4), 8);
  assert.equal(calculateAvailableQuantity(2, 8), 0);
  assert.equal(calculateAvailableQuantity(null, 0), null);
});

test("evaluates low and unavailable stock statuses", () => {
  assert.equal(
    evaluateStockStatus({
      quantityOnHand: 5,
      reservedQuantity: 1,
      lowStockThreshold: 4,
    }),
    "low_stock"
  );
  assert.equal(evaluateStockStatus({ quantityOnHand: null }), "unavailable");
});

test("applies restock and reserved movement state safely", () => {
  const restocked = applyInventoryMovementState(
    { quantityOnHand: 4, reservedQuantity: 1, lowStockThreshold: 2 },
    { movementType: "RESTOCK", quantityDelta: 6 }
  );

  assert.equal(restocked.quantityBefore, 4);
  assert.equal(restocked.quantityAfter, 10);
  assert.equal(restocked.reservedAfter, 1);
  assert.equal(restocked.availableQuantity, 9);

  const reserved = applyInventoryMovementState(
    { quantityOnHand: 10, reservedQuantity: 1, lowStockThreshold: 2 },
    { movementType: "RESERVED", quantityDelta: 3 }
  );

  assert.equal(reserved.quantityAfter, 10);
  assert.equal(reserved.reservedAfter, 4);
  assert.equal(reserved.availableQuantity, 6);
});

test("rejects movement that would oversell reserved stock", () => {
  assert.throws(
    () =>
      applyInventoryMovementState(
        { quantityOnHand: 4, reservedQuantity: 3 },
        { movementType: "RESERVED", quantityDelta: 3 }
      ),
    /reserve more stock/
  );
});

test("validates supported movement payloads", () => {
  const movement = validateMovementPayload({
    type: "restock",
    productSlug: "KitchenCraft Fridge Freezer Dial Thermometer",
    quantity: 5,
  });

  assert.equal(movement.movementType, "RESTOCK");
  assert.equal(movement.productSlug, "kitchencraft-fridge-freezer-dial-thermometer");
  assert.equal(movement.quantityDelta, 5);
});
