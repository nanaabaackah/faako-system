import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInventoryMovementState,
  calculateAvailableQuantity,
  evaluateStockStatus,
  listInventoryItems,
  updateProductInventory,
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
  assert.equal(evaluateStockStatus({ quantityOnHand: 0, reservedQuantity: 0 }), "out_of_stock");
  assert.equal(evaluateStockStatus({ quantityOnHand: null, availableQuantity: 0 }), "out_of_stock");
  assert.equal(evaluateStockStatus({ quantityOnHand: null }), "unavailable");
});

test("hydrates legacy inventory rows from product slug stock data", async () => {
  const items = await listInventoryItems(
    {
      inventoryItem: {
        findMany: async () => [
          {
            id: "inventory-legacy-zero",
            productId: null,
            productSlug: "legacy-zero-stock",
            variantId: null,
            sku: null,
            supplierId: null,
            quantityOnHand: null,
            reservedQuantity: 0,
            availableQuantity: null,
            reorderThreshold: null,
            lowStockThreshold: null,
            stockStatus: "unavailable",
            inventoryTrackingEnabled: true,
            allowBackorder: false,
            isPurchasable: false,
            product: null,
            supplier: null,
          },
        ],
      },
      catalogueProduct: {
        findMany: async (query) => {
          assert.deepEqual(query.where, { slug: { in: ["legacy-zero-stock"] } });
          return [
            {
              id: "product-legacy-zero",
              slug: "legacy-zero-stock",
              name: "Legacy zero stock",
              sku: "LEG-0",
              stockStatus: "out_of_stock",
              stockQuantity: null,
              availableQuantity: 0,
              reservedQuantity: 0,
              isPurchasable: false,
              allowBackorder: false,
            },
          ];
        },
      },
    },
    { limit: 10 }
  );

  assert.equal(items[0].availableQuantity, 0);
  assert.equal(items[0].computedStockStatus, "out_of_stock");
  assert.equal(items[0].product?.availableQuantity, 0);
});

test("variant inventory updates do not overwrite parent product stock", async () => {
  const product = {
    id: "product-apron",
    slug: "chef-waterproof-apron",
    name: "Chef Waterproof Apron",
    sku: "APR-PARENT",
    stockQuantity: 20,
    reservedQuantity: 0,
    availableQuantity: 20,
    lowStockThreshold: 5,
    reorderThreshold: 2,
    stockStatus: "in_stock",
    allowBackorder: false,
    isPurchasable: true,
  };
  const existingItem = {
    id: "inventory-apron-black",
    productId: product.id,
    productSlug: product.slug,
    variantId: "chef-waterproof-apron-black",
    sku: "APR-BLK",
    supplierId: null,
    quantityOnHand: 1,
    reservedQuantity: 0,
    availableQuantity: 1,
    reorderThreshold: null,
    lowStockThreshold: 5,
    stockStatus: "low_stock",
    inventoryTrackingEnabled: true,
    allowBackorder: false,
    isPurchasable: true,
    product,
    supplier: null,
  };
  let catalogueProductUpdateCalled = false;
  let inventoryUpdateData = null;
  let auditData = null;

  const prisma = {
    catalogueProduct: {
      findFirst: async () => product,
    },
    $transaction: async (callback) =>
      callback({
        catalogueProduct: {
          update: async () => {
            catalogueProductUpdateCalled = true;
            return product;
          },
        },
        inventoryItem: {
          findFirst: async () => existingItem,
          update: async ({ data }) => {
            inventoryUpdateData = data;
            return { ...existingItem, ...data };
          },
        },
        inventoryAuditEntry: {
          create: async ({ data }) => {
            auditData = data;
            return data;
          },
        },
      }),
  };

  const result = await updateProductInventory(
    prisma,
    product.slug,
    {
      variantId: "chef-waterproof-apron-black",
      quantityOnHand: 4,
      reservedQuantity: 1,
      stockStatus: "low_stock",
    },
    { username: "tester" }
  );

  assert.equal(catalogueProductUpdateCalled, false);
  assert.equal(inventoryUpdateData.quantityOnHand, 4);
  assert.equal(inventoryUpdateData.reservedQuantity, 1);
  assert.equal(inventoryUpdateData.availableQuantity, 3);
  assert.equal(inventoryUpdateData.variantId, "chef-waterproof-apron-black");
  assert.equal(auditData.entityType, "inventory_item");
  assert.equal(auditData.entityId, "inventory-apron-black");
  assert.equal(result.inventoryItem.variantId, "chef-waterproof-apron-black");
  assert.equal(result.inventoryItem.availableQuantity, 3);
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
