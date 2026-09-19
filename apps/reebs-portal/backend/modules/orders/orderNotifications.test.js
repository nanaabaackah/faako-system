import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerOrderPlacedText,
  buildOrderPlacedNotification,
} from "./orderNotifications.js";

test("order notifications use the core order reference and GHS total", () => {
  const order = {
    id: 9,
    orderNumber: "ORD-20260830-001",
    customerName: "Ama",
    grandTotalCents: 12500,
    fulfillmentMethod: "Pickup",
  };
  assert.match(buildOrderPlacedNotification(order).body, /GHS 125\.00/);
  assert.match(buildCustomerOrderPlacedText(order), /pending payment confirmation/i);
});
