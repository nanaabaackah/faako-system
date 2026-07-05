import {
  calculateAvailableQuantity,
  evaluateStockStatus,
  syncProductStockFromInventory,
} from "./inventory/services.js";

export const PAID_ORDER_INVENTORY_REFERENCE_TYPE = "commerce_order_paid";

const toInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const toQuantity = (value) => {
  const parsed = toInteger(value);
  return parsed && parsed > 0 ? parsed : 0;
};

const toNonNegativeInteger = (value) => {
  const parsed = toInteger(value);
  return parsed === null ? null : Math.max(0, parsed);
};

const safeText = (value = "", maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const buildLineKey = (line) => safeText(line.id || line.productSlug, 120);

const buildReferenceId = (order, line) => `${safeText(order.id, 80)}:${buildLineKey(line)}`.slice(0, 120);

const buildPaidOrderMovementState = (item, quantity) => {
  const beforeQuantity = toNonNegativeInteger(item.quantityOnHand);
  if (beforeQuantity === null) {
    return {
      skipped: true,
      reason: "unknown_stock_quantity",
    };
  }

  const beforeReserved = toNonNegativeInteger(item.reservedQuantity) ?? 0;
  const quantityAfter = Math.max(0, beforeQuantity - quantity);
  const reservedAfter = Math.min(beforeReserved, quantityAfter);
  const availableQuantity = calculateAvailableQuantity(quantityAfter, reservedAfter);

  return {
    quantityDelta: quantityAfter - beforeQuantity,
    quantityBefore: beforeQuantity,
    quantityAfter,
    reservedBefore: beforeReserved,
    reservedAfter,
    availableQuantity,
    stockStatus: evaluateStockStatus({
      ...item,
      quantityOnHand: quantityAfter,
      reservedQuantity: reservedAfter,
      availableQuantity,
    }),
    oversoldQuantity: Math.max(0, quantity - beforeQuantity),
  };
};

const normalizeOrderLines = (order) =>
  (Array.isArray(order?.items) ? order.items : [])
    .map((line) => ({
      ...line,
      productSlug: safeText(line.productSlug, 160),
      productName: safeText(line.productName, 180),
      quantity: toQuantity(line.quantity),
    }))
    .filter((line) => line.productSlug && line.quantity > 0);

export const reduceInventoryForPaidOrder = async (
  prisma,
  order,
  { source = "payment", createdById = null, createdByName = "Stroane payment sync" } = {}
) => {
  const orderId = safeText(order?.id, 120);
  const orderNumber = safeText(order?.orderNumber, 80) || orderId;
  const lines = normalizeOrderLines(order);

  if (!orderId || !lines.length || !prisma?.$transaction) {
    return {
      status: "skipped",
      appliedCount: 0,
      skippedCount: lines.length,
      reason: !orderId ? "missing_order_id" : "missing_order_items",
    };
  }

  return prisma.$transaction(async (tx) => {
    const applied = [];
    const skipped = [];

    for (const line of lines) {
      const referenceId = buildReferenceId(order, line);
      const existingMovement = await tx.inventoryMovement.findFirst({
        where: {
          referenceType: PAID_ORDER_INVENTORY_REFERENCE_TYPE,
          referenceId,
          productSlug: line.productSlug,
        },
        select: { id: true },
      });

      if (existingMovement) {
        skipped.push({
          productSlug: line.productSlug,
          quantity: line.quantity,
          reason: "already_applied",
          movementId: existingMovement.id,
        });
        continue;
      }

      const inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          productSlug: line.productSlug,
          variantId: null,
        },
      });

      if (!inventoryItem) {
        skipped.push({
          productSlug: line.productSlug,
          quantity: line.quantity,
          reason: "inventory_item_not_found",
        });
        continue;
      }

      if (inventoryItem.inventoryTrackingEnabled === false) {
        skipped.push({
          productSlug: line.productSlug,
          quantity: line.quantity,
          inventoryItemId: inventoryItem.id,
          reason: "inventory_tracking_disabled",
        });
        continue;
      }

      const nextState = buildPaidOrderMovementState(inventoryItem, line.quantity);
      if (nextState.skipped) {
        skipped.push({
          productSlug: line.productSlug,
          quantity: line.quantity,
          inventoryItemId: inventoryItem.id,
          reason: nextState.reason,
        });
        continue;
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantityOnHand: nextState.quantityAfter,
          reservedQuantity: nextState.reservedAfter,
          availableQuantity: nextState.availableQuantity,
          stockStatus: nextState.stockStatus,
        },
      });

      await syncProductStockFromInventory(tx, updatedItem, updatedItem);

      const reason = nextState.oversoldQuantity
        ? `Stock deducted after paid order ${orderNumber}; ${nextState.oversoldQuantity} unit(s) exceeded recorded stock.`
        : `Stock deducted after paid order ${orderNumber}.`;

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: updatedItem.id,
          productSlug: updatedItem.productSlug,
          variantId: updatedItem.variantId,
          supplierId: updatedItem.supplierId,
          movementType: "ADJUSTMENT",
          quantityDelta: nextState.quantityDelta,
          quantityBefore: nextState.quantityBefore,
          quantityAfter: nextState.quantityAfter,
          reservedBefore: nextState.reservedBefore,
          reservedAfter: nextState.reservedAfter,
          reason,
          referenceType: PAID_ORDER_INVENTORY_REFERENCE_TYPE,
          referenceId,
          purchaseNote: safeText(
            `${source}: ${line.quantity} unit(s) paid for ${line.productName || line.productSlug}.`,
            700
          ),
          createdById,
          createdByName,
        },
      });

      await tx.inventoryAuditEntry.create({
        data: {
          inventoryItemId: updatedItem.id,
          supplierId: updatedItem.supplierId,
          action: "INVENTORY_PAID_ORDER_DEDUCTED",
          entityType: "commerce_order",
          entityId: orderId,
          productSlug: updatedItem.productSlug,
          variantId: updatedItem.variantId,
          beforeState: {
            quantityOnHand: nextState.quantityBefore,
            reservedQuantity: nextState.reservedBefore,
            stockStatus: inventoryItem.stockStatus,
          },
          afterState: {
            quantityOnHand: nextState.quantityAfter,
            reservedQuantity: nextState.reservedAfter,
            availableQuantity: nextState.availableQuantity,
            stockStatus: nextState.stockStatus,
          },
          note: reason,
          createdById,
          createdByName,
        },
      });

      applied.push({
        productSlug: updatedItem.productSlug,
        quantity: line.quantity,
        quantityDelta: nextState.quantityDelta,
        quantityBefore: nextState.quantityBefore,
        quantityAfter: nextState.quantityAfter,
        availableQuantity: nextState.availableQuantity,
        stockStatus: nextState.stockStatus,
        movementId: movement.id,
        oversoldQuantity: nextState.oversoldQuantity,
      });
    }

    return {
      status: applied.length ? "applied" : "skipped",
      appliedCount: applied.length,
      skippedCount: skipped.length,
      applied,
      skipped,
    };
  });
};
