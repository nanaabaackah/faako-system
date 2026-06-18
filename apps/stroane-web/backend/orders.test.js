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
