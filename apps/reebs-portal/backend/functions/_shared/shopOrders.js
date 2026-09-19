import { createHash } from "node:crypto";
import { getDeliveryFeeDetails } from "./deliveryFee.js";
import { formatVariantLabel } from "./inventoryExtensions.js";
import { sanitizeOrderLogisticsDetails } from "./orderDetails.js";
import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_KEYS,
  resolveCommercialConfiguration,
} from "./commercialConfig.js";
import { assertCheckoutQuoteGuard } from "./checkoutQuote.js";
import {
  FULFILLMENT_STATUS,
  PAYMENT_STATUS,
  SHOP_ORDER_STATUS,
  canTransitionFulfillment,
  canTransitionOrder,
  getOrderNextActions,
  getOrderStatusForFulfillment,
  isClosedOrderStatus,
  normalizeFulfillmentStatus,
  normalizeOrderStatus,
  requiresSettledPaymentForFulfillment,
} from "../../modules/orders/orderPolicy.js";
import { normalizePaymentMethod as normalizeSharedPaymentMethod } from "../../modules/payments/paymentDomain.js";

export {
  FULFILLMENT_STATUS,
  PAYMENT_STATUS,
  SHOP_ORDER_STATUS,
  normalizeFulfillmentStatus,
  normalizeOrderStatus,
} from "../../modules/orders/orderPolicy.js";

export const ORDER_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";

const runSequentially = async (operations = []) => {
  const results = [];
  for (const operation of operations) {
    results.push(await operation());
  }
  return results;
};

// Builds the placeholders and flat params array for a batch INSERT into "orderItem".
// Returns { placeholders: string[], params: any[] } so callers can test the shape
// independently of a live database connection.
export const buildBatchOrderItemParams = (organizationId, orderId, items) => {
  const placeholders = items.map((_, i) => {
    const b = i * 11;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11})`;
  });
  const params = items.flatMap((item) => [
    organizationId,
    orderId,
    item.productId,
    item.variantId || null,
    item.quantity,
    item.unitPriceCents,
    item.lineTotalCents,
    item.unitCostSnapshotCents ?? null,
    0,
    0,
    "REEBS_CORE",
  ]);
  return { placeholders, params };
};

const STOCK_COMMIT_STATUSES = new Set([
  SHOP_ORDER_STATUS.PAID,
  SHOP_ORDER_STATUS.PROCESSING,
  SHOP_ORDER_STATUS.READY_FOR_PICKUP,
  SHOP_ORDER_STATUS.OUT_FOR_DELIVERY,
  SHOP_ORDER_STATUS.DELIVERED,
  SHOP_ORDER_STATUS.COMPLETED,
]);

const normalizeText = (value, max = 500) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const normalizeNullableText = (value, max = 500) => normalizeText(value, max) || null;

const normalizeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePositiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeCents = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

const normalizeMajorUnitsToCents = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed * 100));
};

export const buildOrderIdempotencyFingerprint = (payload = {}) => {
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map((item) => ({
      productId: normalizePositiveId(item?.productId || item?.inventoryItemId),
      variantId: normalizePositiveId(item?.variantId),
      quantity: Math.max(1, normalizeInteger(item?.quantity, 0)),
      digits: normalizeText(item?.digitString || item?.numberSequence || item?.digits || "", 40),
    }))
    .sort((left, right) =>
      `${left.productId}:${left.variantId || 0}:${left.digits}`.localeCompare(
        `${right.productId}:${right.variantId || 0}:${right.digits}`
      )
    );
  const canonical = JSON.stringify({
    customerId: normalizePositiveId(payload.customerId),
    linkedBookingId: normalizePositiveId(payload.linkedBookingId || payload.bookingId),
    deliveryMethod: normalizeDeliveryMethod(payload.deliveryMethod, "pickup"),
    deliveryDetails: sanitizeOrderLogisticsDetails(payload.deliveryDetails),
    pickupDetails: sanitizeOrderLogisticsDetails(payload.pickupDetails),
    isPosOrder: Boolean(payload.isPosOrder),
    discountCents: normalizeCents(payload.discountCents, normalizeMajorUnitsToCents(payload.discount, 0)),
    serviceFeeCents: normalizeCents(payload.serviceFeeCents, normalizeMajorUnitsToCents(payload.serviceFee, 0)),
    items,
  });
  return createHash("sha256").update(canonical).digest("hex");
};

export const getHeaderValue = (event, key) => {
  const headers = event?.headers || {};
  return normalizeText(
    headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "",
    500
  );
};

export const parseJsonBody = (event) => {
  try {
    return { body: JSON.parse(event?.body || "{}") };
  } catch {
    return { error: "Invalid JSON body." };
  }
};

export const normalizePaymentStatus = (amountPaidCents, grandTotalCents) => {
  const paid = normalizeCents(amountPaidCents);
  const total = normalizeCents(grandTotalCents);
  if (paid <= 0) return PAYMENT_STATUS.UNPAID;
  if (paid < total) return PAYMENT_STATUS.PARTIALLY_PAID;
  if (paid === total) return PAYMENT_STATUS.PAID;
  return PAYMENT_STATUS.OVERPAID;
};

export const normalizeDeliveryMethod = (value, fallback = "pickup") => {
  const normalized = normalizeText(value, 80).toLowerCase();
  if (normalized.includes("delivery")) return "delivery";
  if (normalized.includes("pickup")) return "pickup";
  return fallback;
};

export const resolveAuthoritativeDeliveryFee = async (
  client,
  {
    organizationId,
    deliveryMethod,
    deliveryDetails,
    at = new Date(),
  } = {}
) => {
  const method = normalizeDeliveryMethod(deliveryMethod, "pickup");
  if (method === "pickup") {
    return {
      ...getDeliveryFeeDetails(method, deliveryDetails, 0),
      commercialConfigId: null,
      effectiveAt: new Date(at).toISOString(),
    };
  }

  const configuration = await resolveCommercialConfiguration(client, {
    organizationId,
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.DELIVERY_PER_KM_FEE_CENTS,
    at,
  });
  return {
    ...getDeliveryFeeDetails(method, deliveryDetails, configuration.value),
    commercialConfigId: configuration.id,
    effectiveAt: new Date(at).toISOString(),
  };
};

export const normalizePaymentMethod = (value) => {
  return normalizeSharedPaymentMethod(value);
};

const getPaymentAssetCode = (method) => {
  const normalized = normalizePaymentMethod(method).toLowerCase();
  if (normalized === "mobile money") return "1010";
  if (normalized === "bank transfer" || normalized === "card") return "1030";
  return "1000";
};

const getDateStamp = (date = new Date()) => {
  const parsed = date instanceof Date ? date : new Date(date);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return safeDate.toISOString().slice(0, 10).replace(/-/g, "");
};

const buildPaymentMetadata = (paymentPreference = {}) => {
  const preference = paymentPreference && typeof paymentPreference === "object"
    ? paymentPreference
    : {};
  return {
    method: normalizePaymentMethod(preference.method),
    provider: normalizeNullableText(preference.momoProvider || preference.provider, 120),
    transactionReference: normalizeNullableText(
      preference.momoReference || preference.transactionReference || preference.reference,
      160
    ),
    phoneNumber: normalizeNullableText(preference.phoneNumber || preference.phone, 80),
    confirmationStatus: "manual_recorded",
    notes: normalizeNullableText(preference.notes, 500),
  };
};

const inferFulfillmentStatus = ({ orderStatus, deliveryMethod, isPosOrder }) => {
  if (orderStatus === SHOP_ORDER_STATUS.CANCELLED) return FULFILLMENT_STATUS.CANCELLED;
  if (orderStatus === SHOP_ORDER_STATUS.REFUNDED) return FULFILLMENT_STATUS.CANCELLED;
  if (isPosOrder && orderStatus === SHOP_ORDER_STATUS.COMPLETED) return FULFILLMENT_STATUS.PICKED_UP;
  if (orderStatus === SHOP_ORDER_STATUS.DELIVERED) return FULFILLMENT_STATUS.DELIVERED;
  if (orderStatus === SHOP_ORDER_STATUS.COMPLETED) return FULFILLMENT_STATUS.COMPLETED;
  if (orderStatus === SHOP_ORDER_STATUS.OUT_FOR_DELIVERY) return FULFILLMENT_STATUS.OUT_FOR_DELIVERY;
  if (orderStatus === SHOP_ORDER_STATUS.READY_FOR_PICKUP) return FULFILLMENT_STATUS.READY_FOR_PICKUP;
  if (STOCK_COMMIT_STATUSES.has(orderStatus)) {
    return deliveryMethod === "pickup" ? FULFILLMENT_STATUS.PREPARING : FULFILLMENT_STATUS.PREPARING;
  }
  return FULFILLMENT_STATUS.NOT_STARTED;
};

const normalizeSourceContext = (payload = {}, creationMode = "staff") => {
  if (creationMode === "public_checkout") {
    const deliveryMethod = normalizeDeliveryMethod(payload.deliveryMethod, "pickup");
    return {
      linkedBookingId: null,
      source: "Storefront",
      purchaseChannel: "Online",
      fulfillmentMethod: deliveryMethod === "delivery" ? "Delivery" : "Pickup",
      deliveryRequired: deliveryMethod === "delivery",
      isPosOrder: false,
      deliveryMethod,
      expectedFulfillmentDate: payload.deliveryDate || new Date(),
    };
  }
  const rawSource = normalizeText(payload.source, 120);
  const sourceKey = rawSource.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const isPosOrder = Boolean(payload.isPosOrder) || ["pos", "store_mode", "storemode"].includes(sourceKey);
  const linkedBookingId = normalizePositiveId(payload.linkedBookingId || payload.bookingId);
  if (isPosOrder) {
    return {
      linkedBookingId: null,
      source: "POS",
      purchaseChannel: "In Store",
      fulfillmentMethod: "Pickup",
      deliveryRequired: false,
      isPosOrder: true,
      deliveryMethod: "pickup",
      expectedFulfillmentDate: new Date(),
    };
  }
  if (linkedBookingId) {
    return {
      linkedBookingId,
      source: "Booking Add-on",
      purchaseChannel: "Booking Add-on",
      fulfillmentMethod: "Booking/Event Add-on",
      deliveryRequired: false,
      isPosOrder: false,
      deliveryMethod: "pickup",
      expectedFulfillmentDate: payload.expectedFulfillmentDate || new Date(),
    };
  }
  const deliveryMethod = normalizeDeliveryMethod(payload.deliveryMethod, "pickup");
  return {
    linkedBookingId: null,
    source: rawSource || "Manual Admin Entry",
    purchaseChannel: normalizeNullableText(payload.purchaseChannel, 120) || "Admin",
    fulfillmentMethod:
      normalizeNullableText(payload.fulfillmentMethod, 120)
      || (deliveryMethod === "delivery" ? "Delivery" : "Pickup"),
    deliveryRequired: deliveryMethod === "delivery",
    isPosOrder: false,
    deliveryMethod,
    expectedFulfillmentDate: payload.expectedFulfillmentDate || payload.deliveryDate || new Date(),
  };
};

export const writeOrderEvent = async (
  client,
  { organizationId, orderId, type, summary = "", metadata = null, createdByUserId = null }
) => {
  await client.query(
    `INSERT INTO "orderEvent" (
       "organizationId", "orderId", "type", "summary", "metadata", "createdByUserId", "createdAt"
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      organizationId,
      orderId,
      normalizeText(type, 120),
      normalizeNullableText(summary, 500),
      metadata ? JSON.stringify(metadata) : null,
      createdByUserId,
    ]
  );
};

const buildOrderNumber = async (client, organizationId) => {
  const dateStamp = getDateStamp();
  const lockKey = Number(dateStamp);
  await client.query(`SELECT pg_advisory_xact_lock($1, $2)`, [organizationId, lockKey]);
  const sequenceRes = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING("orderNumber" FROM '([0-9]+)$')::int), 0) + 1 AS next_number
     FROM "order"
     WHERE "organizationId" = $1
       AND "orderNumber" ~ $2`,
    [organizationId, `^ORD-${dateStamp}-[0-9]+$`]
  );
  return `ORD-${dateStamp}-${String(sequenceRes.rows[0]?.next_number || 1).padStart(3, "0")}`;
};

const buildReceiptNumber = async (client, organizationId) => {
  const dateStamp = getDateStamp();
  await client.query(`SELECT pg_advisory_xact_lock($1, $2)`, [organizationId, Number(dateStamp) + 7]);
  const result = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING("receiptNumber" FROM '([0-9]+)$')::int), 0) + 1 AS next_number
     FROM "orderReceipt"
     WHERE "organizationId" = $1
       AND "receiptNumber" ~ $2`,
    [organizationId, `^REC-${dateStamp}-[0-9]+$`]
  );
  return `REC-${dateStamp}-${String(result.rows[0]?.next_number || 1).padStart(3, "0")}`;
};

const expandDigitVariants = async (client, organizationId, items) => {
  const expanded = [];
  for (const item of items) {
    if (!item.digitString || item.variantId) {
      expanded.push(item);
      continue;
    }
    const digits = [...new Set(item.digitString.split(""))];
    const result = await client.query(
      `SELECT id, "variantNumber"
       FROM "inventoryVariant"
       WHERE "organizationId" = $1
         AND "inventoryItemId" = $2
         AND "variantNumber" = ANY($3::text[])
         AND LOWER(COALESCE(status, 'active')) = 'active'`,
      [organizationId, item.productId, digits]
    );
    const variantByNumber = new Map(result.rows.map((row) => [String(row.variantNumber), Number(row.id)]));
    for (const digit of item.digitString.split("")) {
      const variantId = variantByNumber.get(digit);
      if (!variantId) {
        const error = new Error(`Number variant ${digit} is not configured for product ${item.productId}.`);
        error.statusCode = 409;
        throw error;
      }
      expanded.push({ ...item, variantId, digitString: "", quantity: 1 });
    }
  }
  return expanded;
};

const normalizeItems = async (client, organizationId, rawItems = []) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const error = new Error("At least one shop product is required.");
    error.statusCode = 400;
    throw error;
  }
  if (rawItems.length > 100) {
    const error = new Error("An order cannot contain more than 100 line items.");
    error.statusCode = 400;
    error.code = "ORDER_ITEM_LIMIT_EXCEEDED";
    throw error;
  }
  const normalized = rawItems
    .map((item) => ({
      productId: normalizePositiveId(item?.productId || item?.inventoryItemId),
      variantId: normalizePositiveId(item?.variantId),
      quantity: Math.min(1000, Math.max(1, normalizeInteger(item?.quantity, 0))),
      digitString: normalizeText(item?.digitString || item?.numberSequence || item?.digits || "", 40)
        .replace(/\D/g, "")
        .slice(0, 40),
    }))
    .filter((item) => item.productId && item.quantity > 0);
  if (!normalized.length) {
    const error = new Error("At least one valid shop product is required.");
    error.statusCode = 400;
    throw error;
  }

  const expanded = await expandDigitVariants(client, organizationId, normalized);
  const byProductVariant = new Map();
  for (const item of expanded) {
    const key = `${item.productId}:${item.variantId || ""}`;
    const existing = byProductVariant.get(key);
    if (existing) existing.quantity += item.quantity;
    else byProductVariant.set(key, { ...item });
  }
  return [...byProductVariant.values()];
};

export const loadAndPriceItems = async (
  client,
  organizationId,
  items,
  { lockForUpdate = true } = {}
) => {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const productRes = await client.query(
    `SELECT p.id, p.name, p.sku, p.price, p."purchasePriceGhs", p.stock, p."isActive", p."itemType", p."sourceCategoryCode", p."imageUrl",
            EXISTS (
              SELECT 1
              FROM "waterProductConfig" wpc
              WHERE wpc."organizationId" = p."organizationId"
                AND wpc."inventoryProductId" = p.id
                AND wpc."isActive" = TRUE
            ) AS "isWaterProduct"
     FROM "product" p
     WHERE p.id = ANY($1::int[])
       AND p."organizationId" = $2
     ${lockForUpdate ? "FOR UPDATE" : ""}`,
    [productIds, organizationId]
  );
  const productMap = new Map(productRes.rows.map((row) => [Number(row.id), row]));
  if (productMap.size !== productIds.length) {
    const error = new Error("One or more products were not found.");
    error.statusCode = 404;
    throw error;
  }

  const variantIds = [
    ...new Set(items.map((item) => item.variantId).filter((value) => Number.isInteger(value) && value > 0)),
  ];
  const variantMap = new Map();
  if (variantIds.length) {
    const variantRes = await client.query(
      `SELECT id, "inventoryItemId", sku, "variantNumber", color, size, "stockQty", "reservedQty", "priceOverride", status
       FROM "inventoryVariant"
       WHERE id = ANY($1::int[])
         AND "organizationId" = $2
       ${lockForUpdate ? "FOR UPDATE" : ""}`,
      [variantIds, organizationId]
    );
    variantRes.rows.forEach((row) => variantMap.set(Number(row.id), row));
    if (variantMap.size !== variantIds.length) {
      const error = new Error("One or more variants were not found.");
      error.statusCode = 404;
      throw error;
    }
  }

  return items.map((item) => {
    const product = productMap.get(item.productId);
    const sourceCode = normalizeText(product?.sourceCategoryCode, 80).toUpperCase();
    if (sourceCode === "RENTAL") {
      const error = new Error(`"${product?.name || `Item ${item.productId}`}" is a rental item. Use Bookings for rentals.`);
      error.statusCode = 400;
      throw error;
    }
    if (sourceCode === "WATER" || product?.isWaterProduct === true) {
      const error = new Error(`"${product?.name || `Item ${item.productId}`}" belongs to the standalone Water business. Use Water Sales.`);
      error.statusCode = 400;
      error.code = "WATER_PRODUCT_REQUIRES_WATER_SALE";
      throw error;
    }
    if (product?.isActive === false) {
      const error = new Error(`"${product?.name || `Item ${item.productId}`}" is unavailable.`);
      error.statusCode = 409;
      throw error;
    }
    const itemType = normalizeText(product?.itemType || "STANDARD", 80).toUpperCase();
    const productPriceCents = normalizeCents(product?.price);
    let availableQty = Math.max(0, Number(product?.stock || 0));
    let variant = null;
    let unitPriceCents = productPriceCents;
    let itemName = product?.name || `Item ${item.productId}`;

    if (item.variantId) {
      variant = variantMap.get(item.variantId);
      if (!variant || Number(variant.inventoryItemId) !== Number(item.productId)) {
        const error = new Error(`Variant ${item.variantId} does not belong to product ${item.productId}.`);
        error.statusCode = 409;
        throw error;
      }
      if (normalizeText(variant.status || "active", 80).toLowerCase() !== "active") {
        const error = new Error(`Variant ${item.variantId} is unavailable.`);
        error.statusCode = 409;
        throw error;
      }
      availableQty = Math.max(0, Number(variant.stockQty || 0) - Number(variant.reservedQty || 0));
      const override = Number(variant.priceOverride);
      if (Number.isFinite(override) && override >= 0) unitPriceCents = Math.round(override);
      itemName = formatVariantLabel(product.name, variant);
    } else if (itemType === "VARIANT_PARENT") {
      const error = new Error(`Choose a specific variant for ${product.name || `product ${item.productId}`}.`);
      error.statusCode = 400;
      throw error;
    }

    if (unitPriceCents <= 0) {
      const error = new Error(`A selling price must be configured for ${itemName} before it can be ordered.`);
      error.statusCode = 409;
      error.code = "ORDER_PRICE_UNAVAILABLE";
      throw error;
    }

    if (availableQty < item.quantity) {
      const error = new Error(`Insufficient stock for ${itemName}.`);
      error.statusCode = 409;
      throw error;
    }

    return {
      ...item,
      product,
      variant,
      itemName,
      unitPriceCents,
      unitCostSnapshotCents: product?.purchasePriceGhs == null
        ? null
        : normalizeCents(product.purchasePriceGhs),
      lineTotalCents: unitPriceCents * item.quantity,
    };
  });
};

const toAuthoritativeQuote = ({
  sourceContext,
  pricedItems,
  deliveryPricing,
  discountCents = 0,
  serviceFeeCents = 0,
}) => {
  const subtotalCents = pricedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const deliveryFeeCents = normalizeCents(deliveryPricing?.feeCents);
  const normalizedDiscountCents = Math.min(subtotalCents, normalizeCents(discountCents));
  const normalizedServiceFeeCents = normalizeCents(serviceFeeCents);
  const grandTotalCents = Math.max(
    0,
    subtotalCents - normalizedDiscountCents + deliveryFeeCents + normalizedServiceFeeCents
  );

  return {
    currency: "GHS",
    items: pricedItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.itemName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
    subtotalCents,
    discountCents: normalizedDiscountCents,
    deliveryFeeCents,
    serviceFeeCents: normalizedServiceFeeCents,
    grandTotalCents,
    deliveryMethod: sourceContext.deliveryMethod,
    delivery: {
      distanceKm: Number(deliveryPricing?.distanceKm || 0),
      rateCents: normalizeCents(deliveryPricing?.rateCents),
      commercialConfigId: deliveryPricing?.commercialConfigId || null,
      effectiveAt: deliveryPricing?.effectiveAt || null,
    },
  };
};

/** Read-only catalogue/config pricing used by public checkout before mutation. */
export const quoteShopOrder = async (
  client,
  { organizationId, payload, at = new Date() }
) => {
  const sourceContext = normalizeSourceContext(payload, "public_checkout");
  const normalizedItems = await normalizeItems(client, organizationId, payload.items);
  const pricedItems = await loadAndPriceItems(client, organizationId, normalizedItems, {
    lockForUpdate: false,
  });
  const deliveryDetails = sanitizeOrderLogisticsDetails(payload.deliveryDetails);
  const deliveryPricing = await resolveAuthoritativeDeliveryFee(client, {
    organizationId,
    deliveryMethod: sourceContext.deliveryMethod,
    deliveryDetails,
    at,
  });

  return toAuthoritativeQuote({
    sourceContext,
    pricedItems,
    deliveryPricing,
  });
};

const syncVariantParentStock = async (client, { organizationId, productId, actorUserId }) => {
  await client.query(
    `UPDATE "product" p
     SET stock = COALESCE((
           SELECT SUM(v."stockQty")::int
           FROM "inventoryVariant" v
           WHERE v."organizationId" = p."organizationId"
             AND v."inventoryItemId" = p.id
             AND LOWER(COALESCE(v.status, 'active')) <> 'inactive'
         ), p.stock),
         "lastUpdatedByUserId" = COALESCE($2, "lastUpdatedByUserId"),
         "lastUpdatedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE p.id = $1 AND p."organizationId" = $3`,
    [productId, actorUserId, organizationId]
  );
};

const applyStockMovement = async (
  client,
  {
    organizationId,
    orderId,
    orderItemId,
    productId,
    variantId = null,
    quantity,
    direction,
    movementType,
    reason,
    actor,
    reference,
  }
) => {
  if (direction === "out") {
    const updateResult = variantId
      ? await client.query(
          `UPDATE "inventoryVariant"
           SET "stockQty" = "stockQty" - $1,
               "updatedAt" = NOW()
           WHERE id = $2
             AND "organizationId" = $3
             AND GREATEST("stockQty" - "reservedQty", 0) >= $1`,
          [quantity, variantId, organizationId]
        )
      : await client.query(
          `UPDATE "product"
           SET stock = stock - $1,
               "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
               "lastUpdatedAt" = NOW(),
               "updatedAt" = NOW()
           WHERE id = $2
             AND "organizationId" = $4
             AND COALESCE("isActive", true) = true
             AND stock >= $1`,
          [quantity, productId, actor.userId, organizationId]
        );
    if (updateResult.rowCount === 0) {
      const error = new Error(`Unable to reserve stock for product ${productId}.`);
      error.statusCode = 409;
      throw error;
    }
  } else {
    if (variantId) {
      await client.query(
        `UPDATE "inventoryVariant"
         SET "stockQty" = "stockQty" + $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3`,
        [quantity, variantId, organizationId]
      );
    } else {
      await client.query(
        `UPDATE "product"
         SET stock = stock + $1,
             "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
             "lastUpdatedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $4`,
        [quantity, productId, actor.userId, organizationId]
      );
    }
  }

  if (variantId) {
    await syncVariantParentStock(client, { organizationId, productId, actorUserId: actor.userId });
  }

  await client.query(
    `INSERT INTO "stockMovement" (
       "organizationId", "productId", "variantId", "orderId", "orderItemId", "type", "quantity",
       "notes", "reference", "date", "performedByUserId", "performedByName", "performedByEmail", "createdAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12,NOW())`,
    [
      organizationId,
      productId,
      variantId,
      orderId,
      orderItemId,
      movementType,
      quantity,
      reason,
      reference,
      actor.userId,
      actor.userName,
      actor.userEmail,
    ]
  );
};

// Applies stock deductions and inserts stockMovement rows for all items in one
// pass using batch UPDATEs and a single INSERT ... SELECT unnest(...).
// Products/variants are already locked FOR UPDATE by loadAndPriceItems, so
// rowCount checks here are a last-resort guard rather than primary concurrency control.
const applyBatchStockOut = async (
  client,
  { organizationId, orderId, orderNumber, pricedItems, orderItemIds, actor }
) => {
  const allItems = pricedItems.map((item, i) => ({
    ...item,
    orderItemId: orderItemIds[i],
  }));

  const variantItems = allItems.filter((i) => i.variantId);
  const simpleItems = allItems.filter((i) => !i.variantId);

  if (variantItems.length > 0) {
    const result = await client.query(
      `UPDATE "inventoryVariant" v
       SET "stockQty" = v."stockQty" - d.qty,
           "updatedAt" = NOW()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS qty) AS d
       WHERE v.id = d.id
         AND v."organizationId" = $3
         AND GREATEST(v."stockQty" - v."reservedQty", 0) >= d.qty`,
      [variantItems.map((i) => i.variantId), variantItems.map((i) => i.quantity), organizationId]
    );
    if (result.rowCount < variantItems.length) {
      const err = new Error("Insufficient stock for one or more variant items.");
      err.statusCode = 409;
      throw err;
    }
    const uniqueParentIds = [...new Set(variantItems.map((i) => i.productId))];
    for (const productId of uniqueParentIds) {
      await syncVariantParentStock(client, { organizationId, productId, actorUserId: actor.userId });
    }
  }

  if (simpleItems.length > 0) {
    const result = await client.query(
      `UPDATE "product" p
       SET stock = p.stock - d.qty,
           "lastUpdatedByUserId" = COALESCE($3, p."lastUpdatedByUserId"),
           "lastUpdatedAt" = NOW(),
           "updatedAt" = NOW()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS qty) AS d
       WHERE p.id = d.id
         AND p."organizationId" = $4
         AND COALESCE(p."isActive", true) = true
         AND p.stock >= d.qty`,
      [simpleItems.map((i) => i.productId), simpleItems.map((i) => i.quantity), actor.userId, organizationId]
    );
    if (result.rowCount < simpleItems.length) {
      const err = new Error("Insufficient stock for one or more products.");
      err.statusCode = 409;
      throw err;
    }
  }

  // Single batch INSERT for all stockMovement rows using unnest.
  await client.query(
    `INSERT INTO "stockMovement" (
       "organizationId", "productId", "variantId", "orderId", "orderItemId",
       "type", "quantity", "notes", "reference", "date",
       "performedByUserId", "performedByName", "performedByEmail", "createdAt"
     )
     SELECT
       $1, p, v, $2, oi,
       'SHOP_SALE', q,
       $3, $4, NOW(),
       $5, $6, $7, NOW()
     FROM unnest(
       $8::int[], $9::int[], $10::int[], $11::int[]
     ) AS t(p, v, oi, q)`,
    [
      organizationId,
      orderId,
      `Shop sale ${orderNumber}`,
      orderNumber,
      actor.userId,
      actor.userName,
      actor.userEmail,
      allItems.map((i) => i.productId),
      allItems.map((i) => i.variantId ?? null),
      allItems.map((i) => i.orderItemId),
      allItems.map((i) => i.quantity),
    ]
  );
};

const commitOrderStockIfNeeded = async (client, { organizationId, order, actor }) => {
  const existingStock = await client.query(
    `SELECT 1
     FROM "stockMovement"
     WHERE "organizationId" = $1
       AND ("orderId" = $2 OR reference = $3)
       AND LOWER(COALESCE(type, '')) IN ('shop_sale', 'stockout')
     LIMIT 1`,
    [organizationId, order.id, order.orderNumber]
  );
  if (existingStock.rowCount > 0) return false;

  const itemsRes = await client.query(
    `SELECT "productId", "variantId", quantity, id
     FROM "orderItem"
     WHERE "organizationId" = $1
       AND "orderId" = $2
     ORDER BY id ASC`,
    [organizationId, order.id]
  );
  await applyBatchStockOut(client, {
    organizationId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    pricedItems: itemsRes.rows.map((r) => ({
      productId: Number(r.productId),
      variantId: r.variantId ? Number(r.variantId) : null,
      quantity: Number(r.quantity || 0),
    })),
    orderItemIds: itemsRes.rows.map((r) => r.id),
    actor,
  });
  await writeOrderEvent(client, {
    organizationId,
    orderId: order.id,
    type: "stock_deducted",
    summary: `Stock deducted for ${order.orderNumber}.`,
    metadata: { itemCount: itemsRes.rows.length },
    createdByUserId: actor.userId,
  });
  return true;
};

// Set per-warm-container so this only fires once after a cold start.
let _paymentAccountsEnsured = false;

const ensurePaymentAccounts = async (client, organizationId) => {
  if (_paymentAccountsEnsured) return;
  await client.query(
    `INSERT INTO "chartOfAccount" (
       "organizationId", "accountCode", "accountName", "accountType", "normalBalance",
       "isSystemAccount", "isActive", "createdAt", "updatedAt"
     )
     VALUES
       ($1,'1000','Cash on Hand','ASSET','DEBIT',FALSE,TRUE,NOW(),NOW()),
       ($1,'1010','MTN Mobile Money','ASSET','DEBIT',FALSE,TRUE,NOW(),NOW()),
       ($1,'1030','Bank Account','ASSET','DEBIT',FALSE,TRUE,NOW(),NOW()),
       ($1,'4000','Retail Sales Revenue','REVENUE','CREDIT',FALSE,TRUE,NOW(),NOW())
     ON CONFLICT ("organizationId", "accountCode") DO NOTHING`,
    [organizationId]
  );
  _paymentAccountsEnsured = true;
};

const createPaymentJournal = async (client, { organizationId, paymentId, amountCents, method, actor }) => {
  const hasJournalTables = await client.query(
    `SELECT to_regclass('"journalEntry"') AS journal_table, to_regclass('"journalLine"') AS line_table`
  );
  if (!hasJournalTables.rows[0]?.journal_table || !hasJournalTables.rows[0]?.line_table) {
    return false;
  }
  await ensurePaymentAccounts(client, organizationId);
  const assetCode = getPaymentAssetCode(method);
  const accountsRes = await client.query(
    `SELECT "accountCode", id
     FROM "chartOfAccount"
     WHERE "organizationId" = $1
       AND "accountCode" = ANY($2::text[])`,
    [organizationId, [assetCode, "4000"]]
  );
  const accountByCode = new Map(accountsRes.rows.map((row) => [row.accountCode, row.id]));
  const assetAccountId = accountByCode.get(assetCode);
  const revenueAccountId = accountByCode.get("4000");
  if (!assetAccountId || !revenueAccountId) return false;

  const reference = `ORDPAY-${paymentId}`;
  const journalRes = await client.query(
    `INSERT INTO "journalEntry" (
       "organizationId", "date", "reference", "description", "createdByUserId", "isPosted", "postedAt", "postedByUserId", "createdAt", "updatedAt"
     )
     VALUES ($1,NOW(),$2,$3,$4,FALSE,NULL,NULL,NOW(),NOW())
     ON CONFLICT ("organizationId", "reference") DO NOTHING
     RETURNING id`,
    [organizationId, reference, `Shop order payment ${paymentId}`, actor.userId]
  );
  const journalId = journalRes.rows[0]?.id;
  if (!journalId) return true;
  await client.query(
    `INSERT INTO "journalLine" ("journalEntryId", "accountId", "debit", "credit", "description")
     VALUES
       ($1,$2,$4,0,$5),
       ($1,$3,0,$4,$6)`,
    [
      journalId,
      assetAccountId,
      revenueAccountId,
      amountCents,
      `Payment received via ${normalizePaymentMethod(method)}`,
      "Retail sales revenue recognized on payment",
    ]
  );
  await client.query(
    `UPDATE "journalEntry"
     SET "isPosted" = TRUE,
         "postedAt" = NOW(),
         "postedByUserId" = $2,
         "updatedAt" = NOW()
     WHERE id = $1
       AND "organizationId" = $3`,
    [journalId, actor.userId, organizationId]
  );
  return true;
};

export const createReceiptForPayment = async (
  client,
  { organizationId, order, payment, actor }
) => {
  const receiptNumber = await buildReceiptNumber(client, organizationId);
  const itemsRes = await client.query(
    `SELECT
       oi.id,
       oi."productId",
       oi."variantId",
       oi.quantity,
       oi.unit_price,
       oi.total_amount,
       p.name,
       p.sku
     FROM "orderItem" oi
     LEFT JOIN "product" p
       ON p.id = oi."productId"
      AND p."organizationId" = oi."organizationId"
     WHERE oi."organizationId" = $1
       AND oi."orderId" = $2
     ORDER BY oi.id ASC`,
    [organizationId, order.id]
  );
  const snapshot = {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      grandTotalCents: Number(order.grandTotalCents ?? order.total_amount ?? 0),
      amountPaidCents: Number(order.amountPaidCents ?? 0),
      balanceDueCents: Number(order.balanceDueCents ?? 0),
      issuedAt: new Date().toISOString(),
    },
    payment: {
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      paidAt: payment.paidAt,
      recordedByUserId: payment.recordedByUserId,
    },
    items: itemsRes.rows,
  };

  const receiptRes = await client.query(
    `INSERT INTO "orderReceipt" (
       "organizationId", "receiptNumber", "orderId", "paymentId", "customerId", "amountCents",
       "snapshot", "issuedAt", "issuedByUserId", "createdAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW(),$8,NOW())
     RETURNING id, "receiptNumber", "issuedAt"`,
    [
      organizationId,
      receiptNumber,
      order.id,
      payment.id,
      order.customerId,
      payment.amountCents,
      JSON.stringify(snapshot),
      actor.userId,
    ]
  );
  await writeOrderEvent(client, {
    organizationId,
    orderId: order.id,
    type: "receipt_generated",
    summary: `Receipt ${receiptNumber} generated.`,
    metadata: { paymentId: payment.id, amountCents: payment.amountCents },
    createdByUserId: actor.userId,
  });
  return receiptRes.rows[0];
};

export const recordOrderPayment = async (
  client,
  {
    organizationId,
    orderId,
    amountCents,
    method,
    provider = null,
    transactionReference = null,
    phoneNumber = null,
    confirmationStatus = null,
    status = "successful",
    notes = null,
    idempotencyKey = "",
    isInitialPayment = false,
    actor,
  }
) => {
  const orderRes = await client.query(
    `SELECT *
     FROM "order"
     WHERE id = $1
       AND "organizationId" = $2
     FOR UPDATE`,
    [orderId, organizationId]
  );
  if (orderRes.rowCount === 0) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  const order = orderRes.rows[0];
  if (
    isClosedOrderStatus(order.status)
    || (!isInitialPayment && normalizeOrderStatus(order.status) === SHOP_ORDER_STATUS.COMPLETED)
  ) {
    const error = new Error("Payments cannot be recorded against a closed order.");
    error.statusCode = 409;
    throw error;
  }

  const paymentAmountCents = normalizeCents(amountCents);
  if (paymentAmountCents <= 0) {
    const error = new Error("Payment amount must be greater than zero.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedIdempotencyKey = normalizeText(idempotencyKey, 160);
  if (normalizedIdempotencyKey) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `order-payment:${organizationId}:${normalizedIdempotencyKey}`,
    ]);
    const existingPaymentRes = await client.query(
      `SELECT p.*, r.id AS "receiptId", r."receiptNumber", r."issuedAt"
       FROM "orderPayment" p
       LEFT JOIN "orderReceipt" r
         ON r."organizationId" = p."organizationId"
        AND r."paymentId" = p.id
       WHERE p."organizationId" = $1
         AND p."idempotencyKey" = $2
       LIMIT 1`,
      [organizationId, normalizedIdempotencyKey]
    );
    if (existingPaymentRes.rowCount > 0) {
      const existing = existingPaymentRes.rows[0];
      if (
        Number(existing.orderId) !== Number(order.id)
        || Number(existing.amountCents) !== paymentAmountCents
        || normalizePaymentMethod(existing.method) !== normalizePaymentMethod(method)
      ) {
        const error = new Error("That payment request key was already used with different payment details.");
        error.statusCode = 409;
        error.code = "PAYMENT_IDEMPOTENCY_CONFLICT";
        throw error;
      }
      return {
        payment: existing,
        receipt: existing.receiptId
          ? {
              id: existing.receiptId,
              receiptNumber: existing.receiptNumber,
              issuedAt: existing.issuedAt,
            }
          : null,
        order,
        idempotentReplay: true,
      };
    }
  }

  const currentBalanceDueCents = isInitialPayment
    ? normalizeCents(order.grandTotalCents ?? order.total_amount)
    : normalizeCents(
        order.balanceDueCents ?? (order.grandTotalCents ?? order.total_amount) - order.amountPaidCents
      );
  if (paymentAmountCents > currentBalanceDueCents) {
    const error = new Error("Payment amount cannot be greater than the current balance due.");
    error.statusCode = 409;
    error.code = "PAYMENT_EXCEEDS_BALANCE";
    throw error;
  }

  const paymentRes = await client.query(
    `INSERT INTO "orderPayment" (
       "organizationId", "orderId", "customerId", "amountCents", "method", "provider",
       "transactionReference", "phoneNumber", "confirmationStatus", "status", "paidAt",
       "recordedByUserId", "notes", "idempotencyKey", "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12,$13,NOW(),NOW())
     RETURNING *`,
    [
      organizationId,
      order.id,
      order.customerId,
      paymentAmountCents,
      normalizePaymentMethod(method),
      provider,
      transactionReference,
      phoneNumber,
      confirmationStatus,
      normalizeText(status, 80).toLowerCase() || "successful",
      actor.userId,
      notes,
      normalizedIdempotencyKey || null,
    ]
  );
  const payment = paymentRes.rows[0];
  const paidRes = await client.query(
    `SELECT COALESCE(SUM("amountCents"), 0)::int AS paid_cents
     FROM "orderPayment"
     WHERE "organizationId" = $1
       AND "orderId" = $2
       AND LOWER(COALESCE(status, 'successful')) IN ('successful', 'confirmed', 'paid')`,
    [organizationId, order.id]
  );
  const grandTotalCents = normalizeCents(order.grandTotalCents ?? order.total_amount);
  const amountPaidCents = normalizeCents(paidRes.rows[0]?.paid_cents);
  const balanceDueCents = Math.max(grandTotalCents - amountPaidCents, 0);
  const paymentStatus = normalizePaymentStatus(amountPaidCents, grandTotalCents);
  const nextOrderStatus = paymentStatus === PAYMENT_STATUS.PAID
    ? SHOP_ORDER_STATUS.PAID
    : paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID
      ? SHOP_ORDER_STATUS.PARTIALLY_PAID
      : order.status;

  const updatedOrderRes = await client.query(
    `UPDATE "order"
     SET "amountPaidCents" = $1,
         "balanceDueCents" = $2,
         "paymentStatus" = $3,
         status = CASE
           WHEN LOWER(COALESCE(status, '')) IN ('draft', 'pending', 'pending_payment', 'partially_paid', 'paid') THEN $4
           ELSE status
         END,
         "updatedByUserId" = $5,
         "updatedAt" = NOW(),
         "lastModifiedAt" = NOW()
     WHERE id = $6
       AND "organizationId" = $7
     RETURNING *`,
    [amountPaidCents, balanceDueCents, paymentStatus, nextOrderStatus, actor.userId, order.id, organizationId]
  );
  const updatedOrder = updatedOrderRes.rows[0];
  const stockCommitted = await commitOrderStockIfNeeded(client, {
    organizationId,
    order: updatedOrder,
    actor,
  });
  const receipt = await createReceiptForPayment(client, {
    organizationId,
    order: updatedOrder,
    payment,
    actor,
  });
  const journalCreated = await createPaymentJournal(client, {
    organizationId,
    paymentId: payment.id,
    amountCents: payment.amountCents,
    method: payment.method,
    actor,
  });
  await writeOrderEvent(client, {
    organizationId,
    orderId: order.id,
    type: "payment_recorded",
    summary: `Payment recorded for ${updatedOrder.orderNumber}.`,
    metadata: {
      paymentId: payment.id,
      receiptId: receipt.id,
      amountCents: payment.amountCents,
      paymentStatus,
      journalCreated,
      stockCommitted,
    },
    createdByUserId: actor.userId,
  });

  return { payment, receipt, order: updatedOrder };
};

export const createShopOrder = async (
  client,
  {
    organizationId,
    payload,
    actor,
    idempotencyKey = "",
    creationMode = "staff",
    allowCommercialOverrides = true,
  }
) => {
  const customerId = normalizePositiveId(payload.customerId);
  if (!customerId) {
    const error = new Error("Customer is required.");
    error.statusCode = 400;
    throw error;
  }
  const idempotencyFingerprint = buildOrderIdempotencyFingerprint(payload);

  if (idempotencyKey) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `shop-order:${organizationId}:${idempotencyKey}`,
    ]);
    const existingRes = await client.query(
      `SELECT id, "orderNumber", "idempotencyFingerprint"
       FROM "order"
       WHERE "organizationId" = $1
         AND "idempotencyKey" = $2
       LIMIT 1`,
      [organizationId, idempotencyKey]
    );
    if (existingRes.rowCount > 0) {
      if (
        existingRes.rows[0].idempotencyFingerprint
        && existingRes.rows[0].idempotencyFingerprint !== idempotencyFingerprint
      ) {
        const error = new Error("That order request key was already used with different order details.");
        error.statusCode = 409;
        error.code = "ORDER_IDEMPOTENCY_CONFLICT";
        throw error;
      }
      return { ...existingRes.rows[0], idempotentReplay: true };
    }
  }

  const isPublicCheckout = creationMode === "public_checkout";
  const requestedCommercialOverride = [
    payload.discountCents,
    payload.discount,
    payload.deliveryFeeCents,
    payload.serviceFeeCents,
    payload.serviceFee,
  ].some((value) => value != null && Number(value) !== 0);
  if (!isPublicCheckout && requestedCommercialOverride && !allowCommercialOverrides) {
    const error = new Error("You do not have permission to override order discounts or fees.");
    error.statusCode = 403;
    error.code = "ORDER_COMMERCIAL_OVERRIDE_FORBIDDEN";
    throw error;
  }
  const sourceContext = normalizeSourceContext(payload, creationMode);
  if (sourceContext.linkedBookingId) {
    const bookingRes = await client.query(
      `SELECT id
       FROM "booking"
       WHERE id = $1
         AND "organizationId" = $2
       LIMIT 1`,
      [sourceContext.linkedBookingId, organizationId]
    );
    if (bookingRes.rowCount === 0) {
      const error = new Error("Linked booking was not found for this organization.");
      error.statusCode = 404;
      throw error;
    }
  }

  const normalizedItems = await normalizeItems(client, organizationId, payload.items);
  const pricedItems = await loadAndPriceItems(client, organizationId, normalizedItems);
  const subtotalCents = pricedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const discountCents = isPublicCheckout || !allowCommercialOverrides
    ? 0
    : Math.min(
        subtotalCents,
        normalizeCents(payload.discountCents, normalizeMajorUnitsToCents(payload.discount, 0))
      );
  const serviceFeeCents = isPublicCheckout || !allowCommercialOverrides
    ? 0
    : normalizeCents(payload.serviceFeeCents, normalizeMajorUnitsToCents(payload.serviceFee, 0));
  const deliveryDetails = sanitizeOrderLogisticsDetails(payload.deliveryDetails);
  const pickupDetails = sanitizeOrderLogisticsDetails(payload.pickupDetails);
  const deliveryPricing = await resolveAuthoritativeDeliveryFee(client, {
    organizationId,
    deliveryMethod: sourceContext.deliveryMethod,
    deliveryDetails,
    at: new Date(),
  });
  const calculatedDeliveryFeeCents = deliveryPricing.feeCents;
  const deliveryFeeCents = isPublicCheckout || !allowCommercialOverrides
    ? calculatedDeliveryFeeCents
    : normalizeCents(payload.deliveryFeeCents, calculatedDeliveryFeeCents);
  const grandTotalCents = Math.max(0, subtotalCents - discountCents + deliveryFeeCents + serviceFeeCents);
  const hasQuoteGuard = Boolean(payload.quoteFingerprint)
    || (Array.isArray(payload.items)
      && payload.items.some((item) =>
        item?.expectedUnitPriceCents !== null && item?.expectedUnitPriceCents !== undefined
      ));
  if (hasQuoteGuard) {
    assertCheckoutQuoteGuard({
      organizationId,
      quote: toAuthoritativeQuote({
        sourceContext,
        pricedItems,
        deliveryPricing: {
          ...deliveryPricing,
          feeCents: deliveryFeeCents,
        },
        discountCents,
        serviceFeeCents,
      }),
      expectedItems: payload.items,
      expectedFingerprint: payload.quoteFingerprint,
      acknowledgePriceChanges: payload.acknowledgePriceChanges,
    });
  }
  const paymentPreference = payload.paymentPreference && typeof payload.paymentPreference === "object"
    ? payload.paymentPreference
    : {};
  const wantsPayLater = Boolean(paymentPreference.payLater) || normalizeText(paymentPreference.method).toLowerCase() === "pay-later";
  let orderStatus = isPublicCheckout
    ? SHOP_ORDER_STATUS.PENDING_PAYMENT
    : normalizeOrderStatus(payload.status, SHOP_ORDER_STATUS.PENDING_PAYMENT);
  if (sourceContext.isPosOrder && !wantsPayLater && orderStatus === SHOP_ORDER_STATUS.PAID) {
    orderStatus = SHOP_ORDER_STATUS.COMPLETED;
  }
  const shouldCreateInitialPayment =
    !isPublicCheckout
    && !wantsPayLater
    && (orderStatus === SHOP_ORDER_STATUS.PAID
      || orderStatus === SHOP_ORDER_STATUS.COMPLETED
      || sourceContext.isPosOrder);
  const initialAmountPaidCents = shouldCreateInitialPayment ? grandTotalCents : 0;
  const paymentStatus = normalizePaymentStatus(initialAmountPaidCents, grandTotalCents);
  const fulfillmentStatus = inferFulfillmentStatus({
    orderStatus,
    deliveryMethod: sourceContext.deliveryMethod,
    isPosOrder: sourceContext.isPosOrder,
  });
  const shouldCommitStock = shouldCreateInitialPayment || STOCK_COMMIT_STATUSES.has(orderStatus);

  const customerRes = await client.query(
    `SELECT id, name, email, phone
     FROM "customer"
     WHERE id = $1
       AND "organizationId" = $2`,
    [customerId, organizationId]
  );
  if (customerRes.rowCount === 0) {
    const error = new Error("Customer not found.");
    error.statusCode = 404;
    throw error;
  }
  const customer = customerRes.rows[0];
  const orderNumber = await buildOrderNumber(client, organizationId);
  const normalizedDelivery = sourceContext.deliveryMethod === "delivery" ? deliveryDetails : null;
  const normalizedPickup = sourceContext.deliveryMethod === "pickup"
    ? pickupDetails || { date: new Date().toISOString().slice(0, 10) }
    : null;

  const orderRes = await client.query(
    `INSERT INTO "order" (
       "organizationId", "orderNumber", "customerId", "customerName", status, "deliveryMethod",
       "deliveryDetails", "pickupDetails", "total_amount", "orderDate", "deliveryDate",
       "linkedBookingId", source, "purchaseChannel", "fulfillmentMethod", "deliveryRequired",
       "isPosOrder", "expectedFulfillmentDate", "subtotalCents", "discountCents", "deliveryFeeCents",
       "serviceFeeCents", "taxCents", currency, "businessUnit", "grandTotalCents", "amountPaidCents", "balanceDueCents",
       "paymentStatus", "fulfillmentStatus", "idempotencyKey", "assignedUserId",
       "createdByUserId", "updatedByUserId", "lastModifiedAt", "createdAt", "updatedAt", "internalNotes",
       "idempotencyFingerprint"
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,0,'GHS','REEBS_CORE',$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW(),NOW(),$31,$32
     )
     RETURNING *`,
    [
      organizationId,
      orderNumber,
      customer.id,
      customer.name,
      orderStatus,
      sourceContext.deliveryMethod,
      normalizedDelivery,
      normalizedPickup,
      grandTotalCents,
      sourceContext.expectedFulfillmentDate,
      sourceContext.linkedBookingId,
      sourceContext.source,
      sourceContext.purchaseChannel,
      sourceContext.fulfillmentMethod,
      sourceContext.deliveryRequired,
      sourceContext.isPosOrder,
      sourceContext.expectedFulfillmentDate,
      subtotalCents,
      discountCents,
      deliveryFeeCents,
      serviceFeeCents,
      grandTotalCents,
      initialAmountPaidCents,
      Math.max(grandTotalCents - initialAmountPaidCents, 0),
      paymentStatus,
      fulfillmentStatus,
      idempotencyKey || null,
      actor.userId,
      actor.userId,
      actor.userId,
      isPublicCheckout ? null : normalizeNullableText(payload.internalNotes, 1000),
      idempotencyFingerprint,
    ]
  );
  const order = orderRes.rows[0];

  // Batch-insert all order items in one round-trip.
  const { placeholders: itemPlaceholders, params: itemParams } =
    buildBatchOrderItemParams(organizationId, order.id, pricedItems);
  const insertedItems = await client.query(
    `INSERT INTO "orderItem" (
       "organizationId", "orderId", "productId", "variantId", quantity, unit_price, total_amount,
       "unitCostSnapshotCents", "lineDiscountCents", "taxCents", "businessUnit"
     )
     VALUES ${itemPlaceholders.join(", ")}
     RETURNING id`,
    itemParams
  );
  const orderItemIds = insertedItems.rows.map((r) => r.id);

  if (shouldCommitStock) {
    await applyBatchStockOut(client, {
      organizationId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      pricedItems,
      orderItemIds,
      actor,
    });
  }

  await writeOrderEvent(client, {
    organizationId,
    orderId: order.id,
    type: "order_created",
    summary: `Created shop order ${order.orderNumber}.`,
    metadata: {
      source: sourceContext.source,
      itemCount: pricedItems.length,
      subtotalCents,
      discountCents,
      grandTotalCents,
      stockCommitted: shouldCommitStock,
    },
    createdByUserId: actor.userId,
  });

  let payment = null;
  let receipt = null;
  if (shouldCreateInitialPayment && grandTotalCents > 0) {
    const paymentData = buildPaymentMetadata(paymentPreference);
    const paymentResult = await recordOrderPayment(client, {
      organizationId,
      orderId: order.id,
      amountCents: grandTotalCents,
      ...paymentData,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}:initial-payment` : "",
      isInitialPayment: true,
      actor,
    });
    payment = paymentResult.payment;
    receipt = paymentResult.receipt;
  }

  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    assignedUserId: order.assignedUserId,
    updatedByUserId: actor.userId,
    paymentId: payment?.id || null,
    receiptId: receipt?.id || null,
    stockCommitted: shouldCommitStock,
  };
};

export const fetchOrderDetail = async (
  client,
  { organizationId, orderId, includeCosts = false }
) => {
  const orderRes = await client.query(
    `SELECT
       o.*,
       c.email AS "customerEmail",
       c.phone AS "customerPhone",
       assignee."fullName" AS "assignedUserName",
       updater."fullName" AS "updatedByName",
       b.id AS "linkedBookingId",
       b."eventDate" AS "linkedBookingEventDate"
     FROM "order" o
     LEFT JOIN "customer" c
       ON c.id = o."customerId"
      AND c."organizationId" = o."organizationId"
     LEFT JOIN "user" assignee
       ON assignee.id = o."assignedUserId"
      AND assignee."organizationId" = o."organizationId"
     LEFT JOIN "user" updater
       ON updater.id = o."updatedByUserId"
      AND updater."organizationId" = o."organizationId"
     LEFT JOIN "booking" b
       ON b.id = o."linkedBookingId"
      AND b."organizationId" = o."organizationId"
     WHERE o.id = $1
       AND o."organizationId" = $2`,
    [orderId, organizationId]
  );
  if (orderRes.rowCount === 0) return null;
  const order = orderRes.rows[0];
  const [itemsRes, paymentsRes, receiptsRes, eventsRes, stockRes, expensesRes] = await runSequentially([
    () => client.query(
      `SELECT
         oi.id,
         oi."productId",
         oi."variantId",
         oi.quantity,
         oi.unit_price,
         oi.total_amount,
         oi."unitCostSnapshotCents",
         oi."lineDiscountCents",
         oi."taxCents",
         oi."businessUnit",
         p.name AS "productName",
         p.sku,
         p."imageUrl",
         NULLIF(CONCAT_WS(' / ', p.name, v."variantNumber", v.color, v.size), '') AS "variantLabel"
       FROM "orderItem" oi
       LEFT JOIN "product" p
         ON p.id = oi."productId"
        AND p."organizationId" = oi."organizationId"
       LEFT JOIN "inventoryVariant" v
         ON v.id = oi."variantId"
        AND v."organizationId" = oi."organizationId"
       WHERE oi."orderId" = $1
         AND oi."organizationId" = $2
       ORDER BY oi.id ASC`,
      [orderId, organizationId]
    ),
    () => client.query(
      `SELECT *
       FROM "orderPayment"
       WHERE "orderId" = $1
         AND "organizationId" = $2
       ORDER BY "paidAt" DESC, id DESC`,
      [orderId, organizationId]
    ),
    () => client.query(
      `SELECT id, "receiptNumber", "orderId", "paymentId", "customerId", "amountCents", "pdfDocumentId", "issuedAt", "issuedByUserId", "createdAt"
       FROM "orderReceipt"
       WHERE "orderId" = $1
         AND "organizationId" = $2
       ORDER BY "issuedAt" DESC, id DESC`,
      [orderId, organizationId]
    ),
    () => client.query(
      `SELECT *
       FROM "orderEvent"
       WHERE "orderId" = $1
         AND "organizationId" = $2
       ORDER BY "createdAt" DESC, id DESC`,
      [orderId, organizationId]
    ),
    () => client.query(
      `SELECT sm.*, p.name AS "productName", p.sku
       FROM "stockMovement" sm
       LEFT JOIN "product" p
         ON p.id = sm."productId"
        AND p."organizationId" = sm."organizationId"
       WHERE sm."organizationId" = $1
         AND (sm."orderId" = $2 OR sm.reference = $3)
       ORDER BY sm.date DESC, sm.id DESC`,
      [organizationId, orderId, order.orderNumber]
    ),
    () => client.query(
      `SELECT id, category, amount, description, date, "createdAt", "updatedAt"
       FROM "expense"
       WHERE "organizationId" = $1
         AND "orderId" = $2
       ORDER BY date DESC, id DESC`,
      [organizationId, orderId]
    ),
  ]);

  const totalCents = normalizeCents(order.grandTotalCents ?? order.total_amount);
  return {
    ...order,
    total: totalCents / 100,
    totalCents,
    customer: {
      id: order.customerId,
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    linkedBooking: order.linkedBookingId
      ? { id: order.linkedBookingId, eventDate: order.linkedBookingEventDate }
      : null,
    items: itemsRes.rows.map((row) => {
      const { unitCostSnapshotCents, ...safeRow } = row;
      const displayRow = includeCosts ? row : safeRow;
      return {
        ...displayRow,
        unitPrice: Number(row.unit_price || 0) / 100,
        total: Number(row.total_amount || 0) / 100,
        ...(includeCosts
          ? {
              grossMarginCents: unitCostSnapshotCents == null
                ? null
                : Number(row.total_amount || 0)
                  - Number(unitCostSnapshotCents || 0) * Number(row.quantity || 0)
                  - Number(row.lineDiscountCents || 0),
            }
          : {}),
      };
    }),
    payments: paymentsRes.rows,
    receipts: receiptsRes.rows,
    events: eventsRes.rows,
    stockMovements: stockRes.rows,
    expenses: expensesRes.rows,
    nextActions: getOrderNextActions(order),
  };
};

export const fetchOrdersList = async (client, { organizationId, query = {} }) => {
  const params = [organizationId];
  const where = [`o."organizationId" = $1`];
  const search = normalizeText(query.q || query.search, 160).toLowerCase();
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(
      LOWER(o."orderNumber") LIKE ${p}
      OR LOWER(o."customerName") LIKE ${p}
      OR EXISTS (
        SELECT 1 FROM "customer" c
        WHERE c.id = o."customerId"
          AND c."organizationId" = o."organizationId"
          AND LOWER(COALESCE(c.phone, '')) LIKE ${p}
      )
    )`);
  }
  const status = normalizeNullableText(query.status, 80);
  if (status && status !== "all") {
    params.push(normalizeOrderStatus(status));
    where.push(`LOWER(COALESCE(o.status, '')) = $${params.length}`);
  }
  const paymentStatus = normalizeNullableText(query.paymentStatus, 80);
  if (paymentStatus && paymentStatus !== "all") {
    params.push(paymentStatus.toLowerCase());
    where.push(`LOWER(COALESCE(o."paymentStatus", '')) = $${params.length}`);
  }
  if (normalizeText(query.reconciliation) === "1") {
    where.push(`o."subtotalCents" IS NOT NULL
      AND o."subtotalCents" <> COALESCE((
        SELECT SUM(reconciliation_item.total_amount)
        FROM "orderItem" reconciliation_item
        WHERE reconciliation_item."orderId" = o.id
          AND reconciliation_item."organizationId" = o."organizationId"
      ), 0)`);
  }
  const fulfillmentStatus = normalizeNullableText(query.fulfillmentStatus, 80);
  if (fulfillmentStatus && fulfillmentStatus !== "all") {
    params.push(fulfillmentStatus.toLowerCase());
    where.push(`LOWER(COALESCE(o."fulfillmentStatus", '')) = $${params.length}`);
  }
  const source = normalizeNullableText(query.source, 120);
  if (source && source !== "all") {
    params.push(source.toLowerCase());
    where.push(`LOWER(COALESCE(o.source, '')) = $${params.length}`);
  }
  const assigned = normalizePositiveId(query.assigned || query.createdBy);
  if (assigned) {
    params.push(assigned);
    where.push(`(o."createdByUserId" = $${params.length} OR o."assignedUserId" = $${params.length})`);
  }
  const productId = normalizePositiveId(query.productId);
  if (productId) {
    params.push(productId);
    where.push(`EXISTS (
      SELECT 1 FROM "orderItem" oi
      WHERE oi."organizationId" = o."organizationId"
        AND oi."orderId" = o.id
        AND oi."productId" = $${params.length}
    )`);
  }
  if (query.dateFrom) {
    params.push(query.dateFrom);
    where.push(`o."orderDate" >= $${params.length}::timestamptz`);
  }
  if (query.dateTo) {
    params.push(query.dateTo);
    where.push(`o."orderDate" < $${params.length}::timestamptz + INTERVAL '1 day'`);
  }

  const page = Math.max(1, normalizeInteger(query.page, 1));
  const pageSize = Math.min(500, Math.max(1, normalizeInteger(query.pageSize || query.limit, 50)));
  const offset = (page - 1) * pageSize;
  const compact = normalizeText(query.compact) === "1";
  const whereSql = where.join(" AND ");

  const selectSql = compact
    ? `SELECT
         o.id,
         o."orderNumber",
         o."customerName",
         c.phone AS "customerPhone",
         o.status,
         o."paymentStatus",
         o."fulfillmentStatus",
         o.source,
         o."purchaseChannel",
         o."fulfillmentMethod",
         o."deliveryMethod",
         o."deliveryDetails",
         o."pickupDetails",
         COALESCE(o."grandTotalCents", o."total_amount")::numeric / 100 AS total,
         COALESCE(o."grandTotalCents", o."total_amount") AS "totalCents",
         o."amountPaidCents",
         o."balanceDueCents",
         o."orderDate",
         o."deliveryDate",
         o."lastModifiedAt",
         o."assignedUserId",
         assignee."fullName" AS "assignedUserName",
         creator."fullName" AS "createdByName"
       FROM "order" o
       LEFT JOIN "customer" c ON c.id = o."customerId" AND c."organizationId" = o."organizationId"
       LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId" AND assignee."organizationId" = o."organizationId"
       LEFT JOIN "user" creator ON creator.id = o."createdByUserId" AND creator."organizationId" = o."organizationId"`
    : `SELECT
         o.id,
         o."orderNumber",
         o."customerName",
         c.phone AS "customerPhone",
         o.status,
         o."paymentStatus",
         o."fulfillmentStatus",
         o.source,
         o."purchaseChannel",
         o."fulfillmentMethod",
         o."deliveryMethod",
         o."deliveryDetails",
         o."pickupDetails",
         COALESCE(o."grandTotalCents", o."total_amount")::numeric / 100 AS total,
         COALESCE(o."grandTotalCents", o."total_amount") AS "totalCents",
         o."amountPaidCents",
         o."balanceDueCents",
         o."orderDate",
         o."deliveryDate",
         o."lastModifiedAt",
         o."assignedUserId",
         o."updatedByUserId",
         assignee."fullName" AS "assignedUserName",
         updater."fullName" AS "updatedByName",
         creator."fullName" AS "createdByName",
         (
           SELECT COALESCE(json_agg(json_build_object(
             'id', oi.id,
             'productId', oi."productId",
             'variantId', oi."variantId",
             'productName', p.name,
             'variantLabel', NULLIF(CONCAT_WS(' / ', p.name, v."variantNumber", v.color, v.size), ''),
             'sku', p.sku,
             'quantity', oi.quantity,
             'unitPrice', oi.unit_price,
             'total', oi.total_amount,
             'imageUrl', p."imageUrl"
           ) ORDER BY oi.id ASC), '[]'::json)
           FROM "orderItem" oi
           LEFT JOIN "product" p ON p.id = oi."productId" AND p."organizationId" = o."organizationId"
           LEFT JOIN "inventoryVariant" v ON v.id = oi."variantId" AND v."organizationId" = o."organizationId"
           WHERE oi."orderId" = o.id
             AND oi."organizationId" = o."organizationId"
         ) AS items
       FROM "order" o
       LEFT JOIN "customer" c ON c.id = o."customerId" AND c."organizationId" = o."organizationId"
       LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId" AND assignee."organizationId" = o."organizationId"
       LEFT JOIN "user" updater ON updater.id = o."updatedByUserId" AND updater."organizationId" = o."organizationId"
       LEFT JOIN "user" creator ON creator.id = o."createdByUserId" AND creator."organizationId" = o."organizationId"`;

  const listParams = [...params, pageSize, offset];
  const limitSql = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const [result, countRes] = await runSequentially([
    () => client.query(
      `${selectSql}
       WHERE ${whereSql}
       ORDER BY o."orderDate" DESC, o.id DESC
       ${limitSql}`,
      listParams
    ),
    () => client.query(
      `SELECT COUNT(*)::int AS total
       FROM "order" o
       WHERE ${whereSql}`,
      params
    ),
  ]);
  return {
    items: result.rows,
    total: countRes.rows[0]?.total || 0,
    page,
    pageSize,
  };
};

export const updateOrderMetadata = async (
  client,
  { organizationId, orderId, payload, actor }
) => {
  const orderRes = await client.query(
    `SELECT *
     FROM "order"
     WHERE id = $1
       AND "organizationId" = $2
     FOR UPDATE`,
    [orderId, organizationId]
  );
  if (orderRes.rowCount === 0) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  const order = orderRes.rows[0];
  if (isClosedOrderStatus(order.status) || normalizeOrderStatus(order.status) === SHOP_ORDER_STATUS.COMPLETED) {
    const error = new Error("Closed orders cannot be edited.");
    error.statusCode = 409;
    throw error;
  }
  if (Array.isArray(payload.items)) {
    const error = new Error("Line item replacement needs order-item soft-void columns before it can ship safely.");
    error.statusCode = 409;
    throw error;
  }

  const updates = [];
  const params = [];
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, "status");
  if (hasStatus) {
    const nextStatus = normalizeOrderStatus(payload.status, order.status);
    const grandTotalCents = normalizeCents(order.grandTotalCents ?? order.total_amount);
    const amountPaidCents = normalizeCents(order.amountPaidCents);
    if (
      [SHOP_ORDER_STATUS.PAID, SHOP_ORDER_STATUS.COMPLETED].includes(nextStatus)
      && amountPaidCents < grandTotalCents
    ) {
      const error = new Error("Record a payment before marking an order as paid or completed.");
      error.statusCode = 409;
      throw error;
    }
    if (!canTransitionOrder(order.status, nextStatus)) {
      const error = new Error("That order status change is not allowed.");
      error.statusCode = 409;
      error.code = "INVALID_ORDER_TRANSITION";
      error.details = {
        currentStatus: normalizeOrderStatus(order.status),
        requestedStatus: nextStatus,
      };
      throw error;
    }
    params.push(nextStatus);
    updates.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "fulfillmentStatus")) {
    const nextFulfillmentStatus = normalizeFulfillmentStatus(
      payload.fulfillmentStatus,
      order.fulfillmentStatus || FULFILLMENT_STATUS.NOT_STARTED
    );
    if (!canTransitionFulfillment(
      order.fulfillmentStatus,
      nextFulfillmentStatus,
      order.deliveryMethod
    )) {
      const error = new Error("That fulfillment step is not available from the current state.");
      error.statusCode = 409;
      error.code = "INVALID_FULFILLMENT_TRANSITION";
      throw error;
    }
    const balanceDueCents = normalizeCents(
      order.balanceDueCents ?? (order.grandTotalCents ?? order.total_amount) - order.amountPaidCents
    );
    if (requiresSettledPaymentForFulfillment(nextFulfillmentStatus) && balanceDueCents > 0) {
      const error = new Error("Settle the order balance before handover or dispatch.");
      error.statusCode = 409;
      error.code = "ORDER_BALANCE_DUE";
      throw error;
    }
    params.push(nextFulfillmentStatus);
    updates.push(`"fulfillmentStatus" = $${params.length}`);
    if (!hasStatus) {
      params.push(getOrderStatusForFulfillment(nextFulfillmentStatus, order.status));
      updates.push(`status = $${params.length}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "internalNotes")) {
    params.push(normalizeNullableText(payload.internalNotes, 1000));
    updates.push(`"internalNotes" = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    const nextDetails = {
      ...(order.pickupDetails || order.deliveryDetails || {}),
      notes: normalizeNullableText(payload.notes, 1000),
    };
    params.push(nextDetails);
    if (normalizeDeliveryMethod(order.deliveryMethod) === "delivery") {
      updates.push(`"deliveryDetails" = $${params.length}`);
    } else {
      updates.push(`"pickupDetails" = $${params.length}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "deliveryMethod")) {
    const method = normalizeDeliveryMethod(payload.deliveryMethod, normalizeDeliveryMethod(order.deliveryMethod));
    const deliveryDetails = sanitizeOrderLogisticsDetails(payload.deliveryDetails);
    const pickupDetails = sanitizeOrderLogisticsDetails(payload.pickupDetails);
    params.push(method);
    updates.push(`"deliveryMethod" = $${params.length}`);
    params.push(method === "delivery" ? deliveryDetails : null);
    updates.push(`"deliveryDetails" = $${params.length}`);
    params.push(method === "pickup" ? pickupDetails : null);
    updates.push(`"pickupDetails" = $${params.length}`);
    params.push(method === "delivery");
    updates.push(`"deliveryRequired" = $${params.length}`);
    params.push(method === "delivery" ? "Delivery" : "Pickup");
    updates.push(`"fulfillmentMethod" = $${params.length}`);
  }

  if (!updates.length) {
    const error = new Error("No supported order updates were provided.");
    error.statusCode = 400;
    throw error;
  }
  params.push(actor.userId);
  updates.push(`"updatedByUserId" = $${params.length}`);
  updates.push(`"updatedAt" = NOW()`);
  updates.push(`"lastModifiedAt" = NOW()`);
  params.push(orderId, organizationId);

  const updated = await client.query(
    `UPDATE "order"
     SET ${updates.join(", ")}
     WHERE id = $${params.length - 1}
       AND "organizationId" = $${params.length}
     RETURNING *`,
    params
  );
  await writeOrderEvent(client, {
    organizationId,
    orderId,
    type: "order_updated",
    summary: `Updated order ${order.orderNumber}.`,
    metadata: {
      fields: Object.keys(payload || {}).filter((key) => key !== "items"),
    },
    createdByUserId: actor.userId,
  });
  return {
    ...updated.rows[0],
    nextActions: getOrderNextActions(updated.rows[0]),
  };
};

export const cancelOrder = async (
  client,
  { organizationId, orderId, reason, actor }
) => {
  const orderRes = await client.query(
    `SELECT *
     FROM "order"
     WHERE id = $1
       AND "organizationId" = $2
     FOR UPDATE`,
    [orderId, organizationId]
  );
  if (orderRes.rowCount === 0) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  const order = orderRes.rows[0];
  const status = normalizeOrderStatus(order.status);
  if (status === SHOP_ORDER_STATUS.CANCELLED) {
    return order;
  }

  const paidCents = normalizeCents(order.amountPaidCents);
  const nextPaymentStatus = paidCents > 0 ? PAYMENT_STATUS.REFUND_PENDING : PAYMENT_STATUS.UNPAID;
  const movementRes = await client.query(
    `SELECT sm.*, oi.id AS "orderItemId"
     FROM "stockMovement" sm
     LEFT JOIN "orderItem" oi
       ON oi.id = sm."orderItemId"
      AND oi."organizationId" = sm."organizationId"
     WHERE sm."organizationId" = $1
       AND (sm."orderId" = $2 OR sm.reference = $3)
       AND LOWER(COALESCE(sm.type, '')) IN ('shop_sale', 'stockout')
       AND NOT EXISTS (
         SELECT 1 FROM "stockMovement" restock
         WHERE restock."organizationId" = sm."organizationId"
           AND (restock."orderId" = $2 OR restock.reference = $3)
           AND LOWER(COALESCE(restock.type, '')) IN ('shop_sale_cancelled', 'shop_return_restock')
       )`,
    [organizationId, order.id, order.orderNumber]
  );

  for (const movement of movementRes.rows) {
    await applyStockMovement(client, {
      organizationId,
      orderId: order.id,
      orderItemId: movement.orderItemId || null,
      productId: Number(movement.productId),
      variantId: movement.variantId ? Number(movement.variantId) : null,
      quantity: Math.max(0, Number(movement.quantity || 0)),
      direction: "in",
      movementType: "SHOP_SALE_CANCELLED",
      reason: normalizeNullableText(reason, 500) || `Shop order ${order.orderNumber} cancelled`,
      actor,
      reference: order.orderNumber,
    });
  }

  const updated = await client.query(
    `UPDATE "order"
     SET status = $1,
         "fulfillmentStatus" = $2,
         "paymentStatus" = $3,
         "cancelledAt" = NOW(),
         "cancelReason" = $4,
         "updatedByUserId" = $5,
         "updatedAt" = NOW(),
         "lastModifiedAt" = NOW()
     WHERE id = $6
       AND "organizationId" = $7
     RETURNING *`,
    [
      SHOP_ORDER_STATUS.CANCELLED,
      FULFILLMENT_STATUS.CANCELLED,
      nextPaymentStatus,
      normalizeNullableText(reason, 500),
      actor.userId,
      order.id,
      organizationId,
    ]
  );
  await writeOrderEvent(client, {
    organizationId,
    orderId: order.id,
    type: "order_cancelled",
    summary: `Cancelled order ${order.orderNumber}.`,
    metadata: {
      reason: normalizeNullableText(reason, 500),
      restockMovementsCreated: movementRes.rows.length,
      paymentStatus: nextPaymentStatus,
    },
    createdByUserId: actor.userId,
  });
  return updated.rows[0];
};
