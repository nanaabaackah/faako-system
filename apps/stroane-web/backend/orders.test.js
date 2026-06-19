import assert from "node:assert/strict";
import test from "node:test";
import { prepareCommerceOrder } from "./src/orders.js";

const createPrismaWithProduct = (product) => ({
  catalogueProduct: {
    findMany: async () => [product],
  },
});

const baseProduct = {
  id: "priced-product-id",
  slug: "priced-product",
  name: "Priced Product",
  sku: "STR-PRICED",
  categorySlug: "thermometers",
  category: { slug: "thermometers", name: "Thermometers" },
  currency: "GHS",
  unit: "each",
  price: "125.00",
  compareAtPrice: null,
  stockQuantity: null,
  availableQuantity: null,
  reservedQuantity: 0,
  stockStatus: "unavailable",
  allowBackorder: false,
  isPurchasable: false,
};

const checkoutPayload = {
  customer: {
    name: "Nana",
    email: "nana@example.com",
    phone: "+233555000000",
    deliveryAddress: "Accra",
  },
  deliveryLocation: {
    label: "Accra, Ghana",
    provider: "test",
    placeId: "test-accra",
    latitude: 5.6037,
    longitude: -0.187,
    mapUrl: "https://maps.example.test/accra",
  },
  items: [{ productSlug: "priced-product", quantity: 2 }],
};

const pickupPayload = {
  ...checkoutPayload,
  customer: {
    ...checkoutPayload.customer,
    deliveryAddress: "Accra Central pickup - Stroane Solutions, Accra Central",
    deliveryNotes: "Please call on arrival.",
  },
  fulfillmentMethod: "pickup",
  deliveryMethod: "pickup",
  deliveryLocation: null,
  pickupLocationId: "accra-central",
  pickupLocationName: "Accra Central pickup",
  pickupDate: "2026-06-20",
  pickupTime: "10:00",
  expectedDeliveryDate: "2026-06-20T10:00:00",
};

test("priced products can checkout while stock is still unconfirmed", async () => {
  const order = await prepareCommerceOrder(createPrismaWithProduct(baseProduct), checkoutPayload);

  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].productSlug, "priced-product");
  assert.equal(order.lines[0].unitPrice, 125);
  assert.equal(order.total, 250);
});

test("priced products with explicit zero available stock still cannot checkout", async () => {
  await assert.rejects(
    () =>
      prepareCommerceOrder(
        createPrismaWithProduct({
          ...baseProduct,
          availableQuantity: 0,
        }),
        checkoutPayload
      ),
    /Priced Product is out of stock/
  );
});

test("pickup checkout accepts the fixed morning afternoon and evening windows", async () => {
  const order = await prepareCommerceOrder(createPrismaWithProduct(baseProduct), pickupPayload);

  assert.equal(order.deliveryMethod, "pickup");
  assert.equal(order.fulfillment.pickupDate, "2026-06-20");
  assert.equal(order.fulfillment.pickupTime, "10:00");
  assert.match(order.customer.deliveryNotes, /Morning pickup window, 10:00 AM - 12:00 PM/);
});

test("pickup checkout rejects Sundays and arbitrary pickup times", async () => {
  await assert.rejects(
    () =>
      prepareCommerceOrder(createPrismaWithProduct(baseProduct), {
        ...pickupPayload,
        pickupDate: "2026-06-21",
        expectedDeliveryDate: "2026-06-21T10:00:00",
      }),
    (error) =>
      Array.isArray(error.details) &&
      error.details.includes("Sunday pickups are not available. Choose Monday to Saturday.")
  );

  await assert.rejects(
    () =>
      prepareCommerceOrder(createPrismaWithProduct(baseProduct), {
        ...pickupPayload,
        pickupTime: "09:30",
        expectedDeliveryDate: "2026-06-20T09:30:00",
      }),
    (error) =>
      Array.isArray(error.details) &&
      error.details.includes("Choose a pickup window between 10:00 AM and 7:00 PM.")
  );
});
