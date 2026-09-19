import assert from "node:assert/strict";
import test from "node:test";
import {
  FULFILLMENT_STATUS,
  SHOP_ORDER_STATUS,
  canTransitionFulfillment,
  canTransitionOrder,
  getAllowedFulfillmentTransitions,
  getOrderStatusForFulfillment,
  requiresSettledPaymentForFulfillment,
} from "./orderPolicy.js";

test("order lifecycle allows forward transitions and blocks terminal reopening", () => {
  assert.equal(canTransitionOrder("paid", "processing"), true);
  assert.equal(canTransitionOrder("processing", "completed"), false);
  assert.equal(canTransitionOrder("completed", "processing"), false);
  assert.equal(canTransitionOrder("cancelled", "pending_payment"), false);
});

test("fulfillment transitions follow pickup and delivery paths", () => {
  assert.deepEqual(getAllowedFulfillmentTransitions("preparing", "pickup"), [
    FULFILLMENT_STATUS.READY_FOR_PICKUP,
  ]);
  assert.deepEqual(getAllowedFulfillmentTransitions("preparing", "delivery"), [
    FULFILLMENT_STATUS.OUT_FOR_DELIVERY,
  ]);
  assert.equal(canTransitionFulfillment("ready_for_pickup", "picked_up", "pickup"), true);
  assert.equal(canTransitionFulfillment("not_started", "delivered", "delivery"), false);
});

test("handover steps require payment and map to order lifecycle", () => {
  assert.equal(requiresSettledPaymentForFulfillment("preparing"), false);
  assert.equal(requiresSettledPaymentForFulfillment("out_for_delivery"), true);
  assert.equal(
    getOrderStatusForFulfillment("out_for_delivery", SHOP_ORDER_STATUS.PAID),
    SHOP_ORDER_STATUS.OUT_FOR_DELIVERY
  );
});
