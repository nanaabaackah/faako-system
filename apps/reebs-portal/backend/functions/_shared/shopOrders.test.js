import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionOrderStatus,
  createShopOrder,
  SHOP_ORDER_STATUS,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  normalizeOrderStatus,
  normalizeFulfillmentStatus,
  normalizePaymentStatus,
  normalizeDeliveryMethod,
  normalizePaymentMethod,
  parseJsonBody,
  recordOrderPayment,
  resolveAuthoritativeDeliveryFee,
  getHeaderValue,
  buildBatchOrderItemParams,
  loadAndPriceItems,
  quoteShopOrder,
} from "./shopOrders.js";

const deliveryConfigurationRow = ({
  id = 31,
  value = 50,
  effectiveFrom = "2026-01-01T00:00:00.000Z",
  effectiveTo = null,
} = {}) => ({
  id,
  organizationId: 7,
  businessUnit: "REEBS_CORE",
  key: "delivery_per_km_fee_cents",
  value: String(value),
  valueType: "MONEY_CENTS",
  effectiveFrom,
  effectiveTo,
  active: true,
  description: null,
  createdByUserId: 3,
  updatedByUserId: 3,
  createdAt: effectiveFrom,
  updatedAt: effectiveFrom,
});

test("core order pricing rejects a crafted Water product id", async () => {
  const client = {
    async query(sql) {
      assert.match(sql, /FROM "product"/);
      return {
        rows: [{
          id: 17,
          name: "15pk Gwater",
          price: 2700,
          purchasePriceGhs: 2200,
          stock: 20,
          isActive: true,
          itemType: "STANDARD",
          sourceCategoryCode: "WATER",
        }],
      };
    },
  };

  await assert.rejects(
    () => loadAndPriceItems(client, 3, [{ productId: 17, variantId: null, quantity: 1 }]),
    (error) => error?.statusCode === 400 && /Water business/.test(error.message)
  );
});

test("shop quote resolves authoritative pickup pricing without order or stock mutations", async () => {
  const queries = [];
  const quote = await quoteShopOrder({
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM "product"')) {
        return {
          rowCount: 1,
          rows: [{
            id: 17,
            name: "Party balloons",
            sku: "SHOP-17",
            price: 2700,
            purchasePriceGhs: 2000,
            stock: 20,
            isActive: true,
            itemType: "STANDARD",
            sourceCategoryCode: "SHOP",
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  }, {
    organizationId: 3,
    payload: {
      items: [{ productId: 17, quantity: 2 }],
      deliveryMethod: "pickup",
      source: "checkout",
    },
    at: new Date("2026-08-15T12:00:00.000Z"),
  });

  assert.equal(quote.subtotalCents, 5400);
  assert.equal(quote.deliveryFeeCents, 0);
  assert.equal(quote.grandTotalCents, 5400);
  assert.deepEqual(quote.items[0], {
    productId: 17,
    variantId: null,
    name: "Party balloons",
    quantity: 2,
    unitPriceCents: 2700,
    lineTotalCents: 5400,
  });
  assert.equal(
    queries.some(({ sql }) => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql)),
    false
  );
});

test("order status transitions reject regressions and arbitrary terminal changes", () => {
  assert.equal(canTransitionOrderStatus("pending_payment", "paid"), true);
  assert.equal(canTransitionOrderStatus("paid", "processing"), true);
  assert.equal(canTransitionOrderStatus("completed", "pending_payment"), false);
  assert.equal(canTransitionOrderStatus("paid", "pending_payment"), false);
  assert.equal(canTransitionOrderStatus("paid", "not-a-status"), false);
});

test("payment idempotency replay returns the persisted payment without new side effects", async () => {
  const queries = [];
  const order = {
    id: 41,
    organizationId: 7,
    customerId: 12,
    status: "partially_paid",
    grandTotalCents: 10000,
    amountPaidCents: 2500,
  };
  const payment = {
    id: 90,
    organizationId: 7,
    orderId: 41,
    amountCents: 2500,
    idempotencyKey: "payment-command-1",
  };
  const result = await recordOrderPayment({
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM "order"')) return { rowCount: 1, rows: [order] };
      if (sql.includes('FROM "orderPayment"')) return { rowCount: 1, rows: [payment] };
      if (sql.includes('FROM "orderReceipt"')) {
        return { rowCount: 1, rows: [{ id: 101, receiptNumber: "REC-101" }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  }, {
    organizationId: 7,
    orderId: 41,
    amountCents: 2500,
    method: "cash",
    actor: { userId: 3 },
    idempotencyKey: "payment-command-1",
  });

  assert.equal(result.idempotentReplay, true);
  assert.equal(result.payment.id, 90);
  assert.equal(result.receipt.receiptNumber, "REC-101");
  assert.equal(queries.some(({ sql }) => sql.includes("INSERT INTO")), false);
});

test("order idempotency replay returns persisted totals without consulting current pricing", async () => {
  const queries = [];
  const result = await createShopOrder(
    {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rowCount: 1,
          rows: [{
            id: 81,
            orderNumber: "ORD-81",
            subtotalCents: 10000,
            discountCents: 1000,
            deliveryFeeCents: 600,
            serviceFeeCents: 0,
            grandTotalCents: 9600,
          }],
        };
      },
    },
    {
      organizationId: 7,
      payload: { customerId: 12 },
      actor: { userId: 3 },
      idempotencyKey: "existing-order-command",
    }
  );

  assert.equal(result.idempotentReplay, true);
  assert.equal(result.grandTotalCents, 9600);
  assert.equal(result.deliveryFeeCents, 600);
  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0].sql, /commercialConfiguration/);
});

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

test("authoritative delivery pricing uses the current effective database rate", async () => {
  const pricing = await resolveAuthoritativeDeliveryFee(
    {
      async query() {
        return { rows: [deliveryConfigurationRow()] };
      },
    },
    {
      organizationId: 7,
      deliveryMethod: "delivery",
      deliveryDetails: { distanceKm: 12.4 },
      at: "2026-08-31T23:59:59.000Z",
    }
  );

  assert.deepEqual(pricing, {
    distanceKm: 12.4,
    feeCents: 620,
    rateCents: 50,
    commercialConfigId: 31,
    effectiveAt: "2026-08-31T23:59:59.000Z",
  });
});

test("a scheduled delivery rate becomes authoritative at its effective instant", async () => {
  const pricing = await resolveAuthoritativeDeliveryFee(
    {
      async query(_sql, params) {
        const isFuture = new Date(params[3]).getTime()
          >= new Date("2026-09-01T00:00:00.000Z").getTime();
        return {
          rows: [isFuture
            ? deliveryConfigurationRow({
                id: 32,
                value: 75,
                effectiveFrom: "2026-09-01T00:00:00.000Z",
              })
            : deliveryConfigurationRow({
                effectiveTo: "2026-09-01T00:00:00.000Z",
              })],
        };
      },
    },
    {
      organizationId: 7,
      deliveryMethod: "delivery",
      deliveryDetails: { distanceKm: 12.4 },
      at: "2026-09-01T00:00:00.000Z",
    }
  );

  assert.equal(pricing.rateCents, 75);
  assert.equal(pricing.feeCents, 930);
  assert.equal(pricing.commercialConfigId, 32);
});

test("delivery pricing fails closed when its required database rule is missing", async () => {
  await assert.rejects(
    () => resolveAuthoritativeDeliveryFee(
      { async query() { return { rows: [] }; } },
      {
        organizationId: 7,
        deliveryMethod: "delivery",
        deliveryDetails: { distanceKm: 10 },
      }
    ),
    { code: "MISSING_COMMERCIAL_CONFIGURATION", statusCode: 503 }
  );
});

test("pickup remains free without consulting an unrelated delivery rule", async () => {
  let queryCount = 0;
  const pricing = await resolveAuthoritativeDeliveryFee(
    { async query() { queryCount += 1; return { rows: [] }; } },
    {
      organizationId: 7,
      deliveryMethod: "pickup",
      deliveryDetails: { distanceKm: 10 },
      at: "2026-08-15T12:00:00.000Z",
    }
  );

  assert.equal(pricing.feeCents, 0);
  assert.equal(pricing.commercialConfigId, null);
  assert.equal(queryCount, 0);
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
    { productId: 10, variantId: null, quantity: 2, unitPriceCents: 500, lineTotalCents: 1000, unitCostCents: 300 },
  ]);
  assert.deepEqual(placeholders, ["($1,$2,$3,$4,$5,$6,$7,$8)"]);
  assert.deepEqual(params, [1, 42, 10, null, 2, 500, 1000, 300]);
});

test("buildBatchOrderItemParams builds sequential placeholders for multiple items", () => {
  const { placeholders, params } = buildBatchOrderItemParams(1, 42, [
    { productId: 10, variantId: null, quantity: 2, unitPriceCents: 500, lineTotalCents: 1000 },
    { productId: 20, variantId: 5, quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500 },
  ]);
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0], "($1,$2,$3,$4,$5,$6,$7,$8)");
  assert.equal(placeholders[1], "($9,$10,$11,$12,$13,$14,$15,$16)");
  assert.deepEqual(params.slice(8), [1, 42, 20, 5, 1, 1500, 1500, null]);
});

test("buildBatchOrderItemParams handles variant IDs and null variants", () => {
  const items = [
    { productId: 1, variantId: 100, quantity: 3, unitPriceCents: 200, lineTotalCents: 600 },
    { productId: 2, variantId: null, quantity: 1, unitPriceCents: 800, lineTotalCents: 800 },
  ];
  const { params } = buildBatchOrderItemParams(5, 10, items);
  assert.equal(params[3], 100);  // first item variantId
  assert.equal(params[11], null); // second item variantId is null
});

test("buildBatchOrderItemParams returns empty arrays for empty items list", () => {
  const { placeholders, params } = buildBatchOrderItemParams(1, 1, []);
  assert.deepEqual(placeholders, []);
  assert.deepEqual(params, []);
});
