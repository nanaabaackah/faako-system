import assert from "node:assert/strict";
import test from "node:test";
import {
  PAID_ORDER_INVENTORY_REFERENCE_TYPE,
  reduceInventoryForPaidOrder,
} from "./src/orderInventory.js";

const createOrder = () => ({
  id: "order-paid-1",
  orderNumber: "STR-20260705-PAID1",
  paymentReference: "STR-paystack-ref",
  items: [
    {
      id: "line-thermometer",
      productSlug: "probe-thermometer",
      productName: "Probe Thermometer",
      quantity: 2,
    },
  ],
});

const createInventoryPrisma = () => {
  const inventoryItem = {
    id: "inventory-probe-thermometer",
    productSlug: "probe-thermometer",
    variantId: null,
    supplierId: null,
    quantityOnHand: 7,
    reservedQuantity: 1,
    availableQuantity: 6,
    lowStockThreshold: 3,
    reorderThreshold: 2,
    stockStatus: "in_stock",
    inventoryTrackingEnabled: true,
    lastRestockedAt: null,
  };
  const movements = [];
  const auditEntries = [];
  const productUpdates = [];

  const tx = {
    inventoryMovement: {
      findFirst: async ({ where }) =>
        movements.find(
          (movement) =>
            movement.referenceType === where.referenceType &&
            movement.referenceId === where.referenceId &&
            movement.productSlug === where.productSlug
        ) || null,
      create: async ({ data }) => {
        const movement = { id: `movement-${movements.length + 1}`, ...data };
        movements.push(movement);
        return movement;
      },
    },
    inventoryItem: {
      findFirst: async ({ where }) =>
        where.productSlug === inventoryItem.productSlug && where.variantId === null
          ? { ...inventoryItem }
          : null,
      update: async ({ data }) => {
        Object.assign(inventoryItem, data);
        return { ...inventoryItem };
      },
    },
    catalogueProduct: {
      updateMany: async ({ where, data }) => {
        productUpdates.push({ where, data });
        return { count: 1 };
      },
    },
    inventoryAuditEntry: {
      create: async ({ data }) => {
        auditEntries.push(data);
        return data;
      },
    },
  };

  return {
    inventoryItem,
    movements,
    auditEntries,
    productUpdates,
    prisma: {
      $transaction: async (callback) => callback(tx),
    },
  };
};

test("reduces tracked inventory when a commerce order is paid", async () => {
  const { inventoryItem, movements, auditEntries, productUpdates, prisma } = createInventoryPrisma();

  const result = await reduceInventoryForPaidOrder(prisma, createOrder(), {
    source: "paystack_webhook",
  });

  assert.equal(result.status, "applied");
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(inventoryItem.quantityOnHand, 5);
  assert.equal(inventoryItem.reservedQuantity, 1);
  assert.equal(inventoryItem.availableQuantity, 4);
  assert.equal(inventoryItem.stockStatus, "in_stock");
  assert.equal(movements.length, 1);
  assert.equal(movements[0].movementType, "ADJUSTMENT");
  assert.equal(movements[0].quantityDelta, -2);
  assert.equal(movements[0].quantityBefore, 7);
  assert.equal(movements[0].quantityAfter, 5);
  assert.equal(movements[0].referenceType, PAID_ORDER_INVENTORY_REFERENCE_TYPE);
  assert.equal(productUpdates.length, 1);
  assert.deepEqual(productUpdates[0].where, { slug: "probe-thermometer" });
  assert.equal(productUpdates[0].data.stockQuantity, 5);
  assert.equal(productUpdates[0].data.availableQuantity, 4);
  assert.equal(auditEntries[0].action, "INVENTORY_PAID_ORDER_DEDUCTED");
});

test("does not reduce inventory twice for repeated paid payment events", async () => {
  const { inventoryItem, movements, prisma } = createInventoryPrisma();
  const order = createOrder();

  const firstResult = await reduceInventoryForPaidOrder(prisma, order, {
    source: "paystack_webhook",
  });
  const secondResult = await reduceInventoryForPaidOrder(prisma, order, {
    source: "paystack_webhook_retry",
  });

  assert.equal(firstResult.appliedCount, 1);
  assert.equal(secondResult.appliedCount, 0);
  assert.equal(secondResult.skipped[0].reason, "already_applied");
  assert.equal(inventoryItem.quantityOnHand, 5);
  assert.equal(movements.length, 1);
});
