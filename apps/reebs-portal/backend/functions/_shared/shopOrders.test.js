import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOP_ORDER_STATUS,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  normalizeOrderStatus,
  normalizeFulfillmentStatus,
  normalizePaymentStatus,
  normalizeDeliveryMethod,
  normalizePaymentMethod,
  parseJsonBody,
  getHeaderValue,
  buildBatchOrderItemParams,
} from "./shopOrders.js";

// ── normalizeOrderStatus ──────────────────────────────────────────────────────

test("normalizeOrderStatus returns fallback for unknown values", () => {
  assert.equal(normalizeOrderStatus("UNKNOWN"), SHOP_ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(normalizeOrderStatus(""), SHOP_ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(normalizeOrderStatus(null), SHOP_ORDER_STATUS.PENDING_PAYMENT);
});

test("normalizeOrderStatus accepts all canonical values", () => {
  assert.equal(normalizeOrderStatus("draft"), SHOP_ORDER_STATUS.DRAFT);
  assert.equal(normalizeOrderStatus("paid"), SHOP_ORDER_STATUS.PAID);
  assert.equal(normalizeOrderStatus("completed"), SHOP_ORDER_STATUS.COMPLETED);
  assert.equal(normalizeOrderStatus("cancelled"), SHOP_ORDER_STATUS.CANCELLED);
  assert.equal(normalizeOrderStatus("refunded"), SHOP_ORDER_STATUS.REFUNDED);
  assert.equal(normalizeOrderStatus("processing"), SHOP_ORDER_STATUS.PROCESSING);
});

test("normalizeOrderStatus accepts aliases", () => {
  assert.equal(normalizeOrderStatus("pending"), SHOP_ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(normalizeOrderStatus("pending_payment"), SHOP_ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(normalizeOrderStatus("canceled"), SHOP_ORDER_STATUS.CANCELLED);
  assert.equal(normalizeOrderStatus("fulfilled"), SHOP_ORDER_STATUS.COMPLETED);
  assert.equal(normalizeOrderStatus("complete"), SHOP_ORDER_STATUS.COMPLETED);
  assert.equal(normalizeOrderStatus("partial"), SHOP_ORDER_STATUS.PARTIALLY_PAID);
});

test("normalizeOrderStatus is case and whitespace insensitive", () => {
  assert.equal(normalizeOrderStatus("PAID"), SHOP_ORDER_STATUS.PAID);
  assert.equal(normalizeOrderStatus("Pending Payment"), SHOP_ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(normalizeOrderStatus("ready-for-pickup"), SHOP_ORDER_STATUS.READY_FOR_PICKUP);
});

// ── normalizePaymentStatus ────────────────────────────────────────────────────

test("normalizePaymentStatus returns unpaid when nothing paid", () => {
  assert.equal(normalizePaymentStatus(0, 5000), PAYMENT_STATUS.UNPAID);
  assert.equal(normalizePaymentStatus(-100, 5000), PAYMENT_STATUS.UNPAID);
});

test("normalizePaymentStatus returns paid when amounts match exactly", () => {
  assert.equal(normalizePaymentStatus(5000, 5000), PAYMENT_STATUS.PAID);
});

test("normalizePaymentStatus returns partially_paid when underpaid", () => {
  assert.equal(normalizePaymentStatus(2500, 5000), PAYMENT_STATUS.PARTIALLY_PAID);
  assert.equal(normalizePaymentStatus(1, 5000), PAYMENT_STATUS.PARTIALLY_PAID);
});

test("normalizePaymentStatus returns overpaid when overpaid", () => {
  assert.equal(normalizePaymentStatus(5001, 5000), PAYMENT_STATUS.OVERPAID);
  assert.equal(normalizePaymentStatus(9999, 5000), PAYMENT_STATUS.OVERPAID);
});

// ── normalizeFulfillmentStatus ────────────────────────────────────────────────

test("normalizeFulfillmentStatus returns fallback for unknown values", () => {
  assert.equal(normalizeFulfillmentStatus("unknown"), FULFILLMENT_STATUS.NOT_STARTED);
  assert.equal(normalizeFulfillmentStatus(null), FULFILLMENT_STATUS.NOT_STARTED);
});

test("normalizeFulfillmentStatus accepts canonical values", () => {
  assert.equal(normalizeFulfillmentStatus("not_started"), FULFILLMENT_STATUS.NOT_STARTED);
  assert.equal(normalizeFulfillmentStatus("preparing"), FULFILLMENT_STATUS.PREPARING);
  assert.equal(normalizeFulfillmentStatus("delivered"), FULFILLMENT_STATUS.DELIVERED);
  assert.equal(normalizeFulfillmentStatus("completed"), FULFILLMENT_STATUS.COMPLETED);
  assert.equal(normalizeFulfillmentStatus("cancelled"), FULFILLMENT_STATUS.CANCELLED);
});

test("normalizeFulfillmentStatus accepts aliases", () => {
  assert.equal(normalizeFulfillmentStatus("pending"), FULFILLMENT_STATUS.NOT_STARTED);
  assert.equal(normalizeFulfillmentStatus("pickedup"), FULFILLMENT_STATUS.PICKED_UP);
  assert.equal(normalizeFulfillmentStatus("complete"), FULFILLMENT_STATUS.COMPLETED);
  assert.equal(normalizeFulfillmentStatus("canceled"), FULFILLMENT_STATUS.CANCELLED);
});

// ── normalizeDeliveryMethod ───────────────────────────────────────────────────

test("normalizeDeliveryMethod identifies delivery strings", () => {
  assert.equal(normalizeDeliveryMethod("delivery"), "delivery");
  assert.equal(normalizeDeliveryMethod("home-delivery"), "delivery");
  assert.equal(normalizeDeliveryMethod("Home Delivery"), "delivery");
});

test("normalizeDeliveryMethod identifies pickup strings", () => {
  assert.equal(normalizeDeliveryMethod("pickup"), "pickup");
  assert.equal(normalizeDeliveryMethod("PICKUP"), "pickup");
});

test("normalizeDeliveryMethod falls back to given default or pickup", () => {
  assert.equal(normalizeDeliveryMethod("walk-in"), "pickup");
  assert.equal(normalizeDeliveryMethod("walk-in", "delivery"), "delivery");
  assert.equal(normalizeDeliveryMethod(null), "pickup");
});

// ── normalizePaymentMethod ────────────────────────────────────────────────────

test("normalizePaymentMethod normalizes known methods", () => {
  assert.equal(normalizePaymentMethod("cash"), "Cash");
  assert.equal(normalizePaymentMethod("momo"), "Mobile Money");
  assert.equal(normalizePaymentMethod("mobile_money"), "Mobile Money");
  assert.equal(normalizePaymentMethod("bank"), "Bank Transfer");
  assert.equal(normalizePaymentMethod("card"), "Card");
});

test("normalizePaymentMethod returns Other for unknown values", () => {
  assert.equal(normalizePaymentMethod("crypto"), "Other");
  assert.equal(normalizePaymentMethod(""), "Other");
});

// ── parseJsonBody ─────────────────────────────────────────────────────────────

test("parseJsonBody parses a valid JSON string body", () => {
  const { body } = parseJsonBody({ body: '{"orderId":99,"amount":500}' });
  assert.deepEqual(body, { orderId: 99, amount: 500 });
});

test("parseJsonBody returns empty object when body is missing", () => {
  const { body } = parseJsonBody({});
  assert.deepEqual(body, {});
});

test("parseJsonBody returns error object on invalid JSON", () => {
  const result = parseJsonBody({ body: "not-json{}" });
  assert.ok(result.error, "expected an error property");
  assert.equal(result.body, undefined);
});

// ── getHeaderValue ────────────────────────────────────────────────────────────

test("getHeaderValue retrieves header case-insensitively", () => {
  const event = { headers: { "x-org-id": "7" } };
  assert.equal(getHeaderValue(event, "X-Org-Id"), "7");
  assert.equal(getHeaderValue(event, "x-org-id"), "7");
});

test("getHeaderValue returns empty string for missing header", () => {
  assert.equal(getHeaderValue({ headers: {} }, "X-Missing"), "");
  assert.equal(getHeaderValue({}, "X-Missing"), "");
});

// ── buildBatchOrderItemParams ─────────────────────────────────────────────────

test("buildBatchOrderItemParams builds correct placeholders for one item", () => {
  const { placeholders, params } = buildBatchOrderItemParams(1, 42, [
    { productId: 10, variantId: null, quantity: 2, unitPriceCents: 500, lineTotalCents: 1000 },
  ]);
  assert.deepEqual(placeholders, ["($1,$2,$3,$4,$5,$6,$7)"]);
  assert.deepEqual(params, [1, 42, 10, null, 2, 500, 1000]);
});

test("buildBatchOrderItemParams builds sequential placeholders for multiple items", () => {
  const { placeholders, params } = buildBatchOrderItemParams(1, 42, [
    { productId: 10, variantId: null, quantity: 2, unitPriceCents: 500, lineTotalCents: 1000 },
    { productId: 20, variantId: 5, quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500 },
  ]);
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0], "($1,$2,$3,$4,$5,$6,$7)");
  assert.equal(placeholders[1], "($8,$9,$10,$11,$12,$13,$14)");
  assert.deepEqual(params.slice(7), [1, 42, 20, 5, 1, 1500, 1500]);
});

test("buildBatchOrderItemParams handles variant IDs and null variants", () => {
  const items = [
    { productId: 1, variantId: 100, quantity: 3, unitPriceCents: 200, lineTotalCents: 600 },
    { productId: 2, variantId: null, quantity: 1, unitPriceCents: 800, lineTotalCents: 800 },
  ];
  const { params } = buildBatchOrderItemParams(5, 10, items);
  assert.equal(params[3], 100);  // first item variantId
  assert.equal(params[10], null); // second item variantId is null
});

test("buildBatchOrderItemParams returns empty arrays for empty items list", () => {
  const { placeholders, params } = buildBatchOrderItemParams(1, 1, []);
  assert.deepEqual(placeholders, []);
  assert.deepEqual(params, []);
});
