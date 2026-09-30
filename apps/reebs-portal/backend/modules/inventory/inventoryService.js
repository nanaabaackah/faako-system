import {
  INVENTORY_ERROR_CODES,
  STOCK_MOVEMENT_TYPES,
  createInventoryError,
  serializeAdjustmentReplay,
} from "./inventoryDomain.js";
import * as defaultRepository from "./inventoryRepository.js";

export const adjustInventoryStock = async (
  client,
  { organizationId, adjustment, actor },
  repository = defaultRepository
) => {
  await client.query("BEGIN");
  try {
    const product = await repository.lockInventoryProduct(
      client,
      organizationId,
      adjustment.productId
    );
    if (!product) {
      throw createInventoryError("Inventory item not found.", {
        statusCode: 404,
        code: INVENTORY_ERROR_CODES.NOT_FOUND,
      });
    }
    if (product.isWaterProduct) {
      throw createInventoryError("Water stock must be changed from the Water Business module.", {
        statusCode: 409,
        code: INVENTORY_ERROR_CODES.SCOPE_CONFLICT,
      });
    }
    if (product.isDeleted || product.isArchived || product.isActive === false) {
      throw createInventoryError(`${product.name || "This item"} is inactive or unavailable.`, {
        statusCode: 409,
        code: INVENTORY_ERROR_CODES.INVALID_STATE,
      });
    }
    const replay = await repository.findMovementByIdempotencyKey(
      client,
      organizationId,
      adjustment.idempotencyKey
    );
    if (replay) {
      await client.query("COMMIT");
      return serializeAdjustmentReplay(replay);
    }
    const isRental = String(product.sourceCategoryCode || "").trim().toUpperCase() === "RENTAL";
    if (
      adjustment.type === STOCK_MOVEMENT_TYPES.OUT
      && isRental
      && adjustment.reasonCode !== "CAPACITY_CORRECTION"
    ) {
      throw createInventoryError(
        "Rental capacity is managed through Bookings. Do not remove it as sale stock.",
        { statusCode: 409, code: INVENTORY_ERROR_CODES.INVALID_STATE }
      );
    }
    if (isRental && adjustment.type === STOCK_MOVEMENT_TYPES.OUT) {
      const peakReserved = await repository.getPeakRentalReservation(
        client,
        organizationId,
        adjustment.productId
      );
      const nextCapacity = Number(product.stock || 0) - adjustment.quantity;
      if (nextCapacity < peakReserved) {
        throw createInventoryError(
          `Capacity cannot be reduced below ${peakReserved}; that many units are already booked on at least one date.`,
          { statusCode: 409, code: INVENTORY_ERROR_CODES.CONFLICT }
        );
      }
    }

    let previousStock = Number(product.stock || 0);
    let update = null;
    if (adjustment.variantId) {
      const variant = await repository.lockInventoryVariant(
        client,
        organizationId,
        adjustment.productId,
        adjustment.variantId
      );
      if (!variant) {
        throw createInventoryError("Variant not found for this inventory item.", {
          statusCode: 404,
          code: INVENTORY_ERROR_CODES.NOT_FOUND,
        });
      }
      if (String(variant.status || "active").trim().toLowerCase() === "inactive") {
        throw createInventoryError("This inventory variant is inactive.", {
          statusCode: 409,
          code: INVENTORY_ERROR_CODES.INVALID_STATE,
        });
      }
      previousStock = Number(variant.stockQty || 0);
      update = await repository.applyVariantStockDelta(client, {
        organizationId,
        productId: adjustment.productId,
        variantId: adjustment.variantId,
        delta: adjustment.delta,
        actorUserId: actor.userId,
      });
    } else {
      if (String(product.itemType || "STANDARD").trim().toUpperCase() === "VARIANT_PARENT") {
        throw createInventoryError("Choose a variant before adjusting this item.", {
          statusCode: 409,
          code: INVENTORY_ERROR_CODES.INVALID_STATE,
        });
      }
      update = await repository.applyProductStockDelta(client, {
        organizationId,
        productId: adjustment.productId,
        delta: adjustment.delta,
        actorUserId: actor.userId,
      });
    }

    if (!update) {
      const available = adjustment.variantId
        ? "Only unreserved variant stock can be removed."
        : `Only ${previousStock} unit${previousStock === 1 ? " is" : "s are"} available.`;
      throw createInventoryError(available, {
        statusCode: 409,
        code: INVENTORY_ERROR_CODES.INSUFFICIENT,
      });
    }

    const resultingStock = Number(update.resultingStock);
    const movementId = await repository.insertInventoryMovement(client, {
      organizationId,
      adjustment,
      previousStock,
      resultingStock,
      actor,
    });
    await client.query("COMMIT");

    return {
      message: `${adjustment.type === STOCK_MOVEMENT_TYPES.IN ? "Stock added" : "Stock removed"} successfully.`,
      idempotentReplay: false,
      movementId,
      productId: adjustment.productId,
      variantId: adjustment.variantId,
      newStock: resultingStock,
      variantAvailableQty: adjustment.variantId ? Number(update.availableQty) : undefined,
      lastUpdatedAt: update.lastUpdatedAt || new Date().toISOString(),
      lastUpdatedByUserId: update.lastUpdatedByUserId || actor.userId,
      lastUpdatedByName: actor.userName,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (String(error?.code || "") === "23505" && adjustment.idempotencyKey) {
      const replay = await repository.findMovementByIdempotencyKey(
        client,
        organizationId,
        adjustment.idempotencyKey
      );
      if (replay) return serializeAdjustmentReplay(replay);
    }
    throw error;
  }
};
