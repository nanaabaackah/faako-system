export const SHOP_ORDER_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING_PAYMENT: "pending_payment",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  PROCESSING: "processing",
  READY_FOR_PICKUP: "ready_for_pickup",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
});

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  OVERPAID: "overpaid",
  REFUNDED: "refunded",
  REFUND_PENDING: "refund_pending",
});

export const FULFILLMENT_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  PREPARING: "preparing",
  READY_FOR_PICKUP: "ready_for_pickup",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  PICKED_UP: "picked_up",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const ORDER_STATUS_VALUES = new Set(Object.values(SHOP_ORDER_STATUS));
const FULFILLMENT_STATUS_VALUES = new Set(Object.values(FULFILLMENT_STATUS));

const normalizeKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

export const normalizeOrderStatus = (value, fallback = SHOP_ORDER_STATUS.PENDING_PAYMENT) => {
  const normalized = normalizeKey(value);
  const aliases = {
    pending: SHOP_ORDER_STATUS.PENDING_PAYMENT,
    partial: SHOP_ORDER_STATUS.PARTIALLY_PAID,
    fulfilled: SHOP_ORDER_STATUS.COMPLETED,
    complete: SHOP_ORDER_STATUS.COMPLETED,
    canceled: SHOP_ORDER_STATUS.CANCELLED,
  };
  const resolved = aliases[normalized] || normalized;
  return ORDER_STATUS_VALUES.has(resolved) ? resolved : fallback;
};

export const normalizeFulfillmentStatus = (
  value,
  fallback = FULFILLMENT_STATUS.NOT_STARTED
) => {
  const normalized = normalizeKey(value);
  const aliases = {
    pending: FULFILLMENT_STATUS.NOT_STARTED,
    pickedup: FULFILLMENT_STATUS.PICKED_UP,
    complete: FULFILLMENT_STATUS.COMPLETED,
    canceled: FULFILLMENT_STATUS.CANCELLED,
  };
  const resolved = aliases[normalized] || normalized;
  return FULFILLMENT_STATUS_VALUES.has(resolved) ? resolved : fallback;
};

const ORDER_TRANSITIONS = Object.freeze({
  [SHOP_ORDER_STATUS.DRAFT]: [SHOP_ORDER_STATUS.PENDING_PAYMENT, SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.PENDING_PAYMENT]: [SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.PARTIALLY_PAID]: [SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.PAID]: [SHOP_ORDER_STATUS.PROCESSING, SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.PROCESSING]: [
    SHOP_ORDER_STATUS.READY_FOR_PICKUP,
    SHOP_ORDER_STATUS.OUT_FOR_DELIVERY,
    SHOP_ORDER_STATUS.CANCELLED,
  ],
  [SHOP_ORDER_STATUS.READY_FOR_PICKUP]: [SHOP_ORDER_STATUS.COMPLETED, SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.OUT_FOR_DELIVERY]: [SHOP_ORDER_STATUS.DELIVERED, SHOP_ORDER_STATUS.CANCELLED],
  [SHOP_ORDER_STATUS.DELIVERED]: [SHOP_ORDER_STATUS.COMPLETED],
  [SHOP_ORDER_STATUS.COMPLETED]: [],
  [SHOP_ORDER_STATUS.CANCELLED]: [],
  [SHOP_ORDER_STATUS.REFUNDED]: [],
});

export const getAllowedOrderTransitions = (status) =>
  ORDER_TRANSITIONS[normalizeOrderStatus(status)] || [];

export const canTransitionOrder = (currentStatus, nextStatus) => {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus, "");
  return Boolean(next) && (current === next || getAllowedOrderTransitions(current).includes(next));
};

export const getAllowedFulfillmentTransitions = (status, deliveryMethod = "pickup") => {
  const current = normalizeFulfillmentStatus(status);
  const isDelivery = normalizeKey(deliveryMethod).includes("delivery");
  const transitions = {
    [FULFILLMENT_STATUS.NOT_STARTED]: [FULFILLMENT_STATUS.PREPARING],
    [FULFILLMENT_STATUS.PREPARING]: [
      isDelivery ? FULFILLMENT_STATUS.OUT_FOR_DELIVERY : FULFILLMENT_STATUS.READY_FOR_PICKUP,
    ],
    [FULFILLMENT_STATUS.READY_FOR_PICKUP]: [
      FULFILLMENT_STATUS.PICKED_UP,
    ],
    [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: [
      FULFILLMENT_STATUS.DELIVERED,
    ],
    [FULFILLMENT_STATUS.DELIVERED]: [FULFILLMENT_STATUS.COMPLETED],
    [FULFILLMENT_STATUS.PICKED_UP]: [FULFILLMENT_STATUS.COMPLETED],
    [FULFILLMENT_STATUS.COMPLETED]: [],
    [FULFILLMENT_STATUS.CANCELLED]: [],
  };
  return transitions[current] || [];
};

export const canTransitionFulfillment = (currentStatus, nextStatus, deliveryMethod) => {
  const current = normalizeFulfillmentStatus(currentStatus);
  const next = normalizeFulfillmentStatus(nextStatus, "");
  return Boolean(next)
    && (current === next || getAllowedFulfillmentTransitions(current, deliveryMethod).includes(next));
};

export const requiresSettledPaymentForFulfillment = (status) =>
  [
    FULFILLMENT_STATUS.READY_FOR_PICKUP,
    FULFILLMENT_STATUS.OUT_FOR_DELIVERY,
    FULFILLMENT_STATUS.DELIVERED,
    FULFILLMENT_STATUS.PICKED_UP,
    FULFILLMENT_STATUS.COMPLETED,
  ].includes(normalizeFulfillmentStatus(status));

export const getOrderStatusForFulfillment = (status, currentOrderStatus) => {
  const fulfillmentStatus = normalizeFulfillmentStatus(status);
  const current = normalizeOrderStatus(currentOrderStatus);
  const mapped = {
    [FULFILLMENT_STATUS.PREPARING]: SHOP_ORDER_STATUS.PROCESSING,
    [FULFILLMENT_STATUS.READY_FOR_PICKUP]: SHOP_ORDER_STATUS.READY_FOR_PICKUP,
    [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: SHOP_ORDER_STATUS.OUT_FOR_DELIVERY,
    [FULFILLMENT_STATUS.DELIVERED]: SHOP_ORDER_STATUS.DELIVERED,
    [FULFILLMENT_STATUS.PICKED_UP]: SHOP_ORDER_STATUS.COMPLETED,
    [FULFILLMENT_STATUS.COMPLETED]: SHOP_ORDER_STATUS.COMPLETED,
  };
  return mapped[fulfillmentStatus] || current;
};

export const isClosedOrderStatus = (status) =>
  [SHOP_ORDER_STATUS.CANCELLED, SHOP_ORDER_STATUS.REFUNDED].includes(
    normalizeOrderStatus(status)
  );

export const getOrderNextActions = (order = {}) => ({
  fulfillmentTransitions: getAllowedFulfillmentTransitions(
    order.fulfillmentStatus,
    order.deliveryMethod
  ),
  orderTransitions: getAllowedOrderTransitions(order.status),
  requiresPayment: Number(order.balanceDueCents || 0) > 0,
});
