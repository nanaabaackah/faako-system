/* eslint-disable no-undef */
// Filename: createOrder.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  ensureAuditColumns,
  backfillAuditDefaults,
} from "./auditHelpers.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { notifyManager } from "./_shared/managerPush.js";
import { sanitizeOrderLogisticsDetails } from "./_shared/orderDetails.js";
import { sendManagerWhatsApp } from "./_shared/whatsapp.js";
import { resolveOrganizationId } from "./_shared/organization.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";
import { sanitizePaymentPreference } from "./_shared/paymentInstructions.js";
import { ensureInventoryVariantSchema, formatVariantLabel } from "./_shared/inventoryExtensions.js";
import {
  buildCustomerOrderEmailHtml,
  buildCustomerOrderEmailText,
  buildInternalOrderEmailHtml,
  buildInternalOrderEmailText,
} from "./_shared/transactionEmailTemplates.js";

const formatAmount = (cents) => {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "0.00";
  return (value / 100).toFixed(2);
};

const formatWindow = (value) => {
  const map = {
    "9am-11am": "9:00am-11:00am",
    "11am-1pm": "11:00am-1:00pm",
    "1pm-3pm": "1:00pm-3:00pm",
    "3pm-5pm": "3:00pm-5:00pm",
    "5pm-7pm": "5:00pm-7:00pm",
  };
  if (!value) return "";
  return map[value] || value;
};

const buildOrderNotification = ({
  orderId,
  orderNumber,
  customerName,
  totalAmountCents,
  itemsCount,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  customerPhone,
}) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  const details = isPickup ? pickupDetails : deliveryDetails;
  const when = details?.date ? `${details.date}` : "Date TBD";
  const windowLabel = formatWindow(details?.window);
  const methodLabel = isPickup ? "Pickup" : "Delivery";
  const itemLabel = itemsCount === 1 ? "item" : "items";

  let body = `${customerName || "New customer"} · GHS ${formatAmount(totalAmountCents)} · ${itemsCount || 0} ${itemLabel}`;
  body += ` · ${methodLabel} ${when}`;
  if (windowLabel) body += ` (${windowLabel})`;
  if (!isPickup && details?.address) body += ` · ${details.address}`;
  if (!isPickup && (details?.contact || customerPhone)) {
    body += ` · ${details?.contact || customerPhone}`;
  }

  return {
    title: `New order ${orderNumber}`,
    body,
    data: {
      type: "order",
      id: orderId,
      orderNumber,
    },
  };
};

const buildWhatsAppLines = ({
  orderNumber,
  customerName,
  customerPhone,
  totalAmountCents,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  itemsCount,
}) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  const details = isPickup ? pickupDetails : deliveryDetails;
  const windowLabel = formatWindow(details?.window);

  const lines = [
    `New order ${orderNumber}`,
    `Customer: ${customerName || "Unknown"}`,
    `Total: GHS ${formatAmount(totalAmountCents)}`,
    `Items: ${itemsCount || 0}`,
    `Fulfillment: ${isPickup ? "Pickup" : "Delivery"}`,
  ];

  if (details?.date) {
    lines.push(`${isPickup ? "Pickup" : "Delivery"} date: ${details.date}`);
  }
  if (windowLabel) {
    lines.push(`${isPickup ? "Pickup" : "Delivery"} window: ${windowLabel}`);
  }
  if (!isPickup && details?.address) {
    lines.push(`Address: ${details.address}`);
  }
  if ((details?.contact || customerPhone) && !isPickup) {
    lines.push(`Contact: ${details?.contact || customerPhone}`);
  }
  if (details?.notes) {
    lines.push(`Notes: ${details.notes}`);
  }
  return lines;
};

const normalizeDeliveryMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("delivery") ? "delivery" : "pickup";
};

const json = (event, statusCode, body, options = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, {
      methods: "POST,OPTIONS",
      ...options,
    }),
  },
  body: statusCode === 204 ? "" : JSON.stringify(body),
});

const pickAutoAssignee = async (client, organizationId) => {
  try {
    const result = await client.query(
      `SELECT
         u.id,
         COALESCE(o.open_orders, 0) + COALESCE(b.open_bookings, 0) AS load
       FROM "user" u
       LEFT JOIN (
         SELECT "assignedUserId" AS user_id, COUNT(*) AS open_orders
         FROM "order"
         WHERE "organizationId" = $1
           AND LOWER(status) NOT IN ('completed', 'delivered', 'cancelled', 'canceled')
         GROUP BY "assignedUserId"
       ) o ON o.user_id = u.id
       LEFT JOIN (
         SELECT "assignedUserId" AS user_id, COUNT(*) AS open_bookings
         FROM "booking"
         WHERE "organizationId" = $1
           AND LOWER(status) NOT IN ('completed', 'cancelled', 'canceled')
         GROUP BY "assignedUserId"
       ) b ON b.user_id = u.id
       WHERE u."organizationId" = $1
         AND LOWER(u.role) IN ('admin', 'manager', 'staff', 'sales')
       ORDER BY load ASC, u."updatedAt" DESC
       LIMIT 1`,
      [organizationId]
    );
    return result.rows?.[0]?.id || null;
  } catch (err) {
    console.warn("Auto-assign lookup failed:", err?.message || err);
    return null;
  }
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, {});
  }
  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed." });
  }
  if (event.httpMethod !== "POST") {
    return json(event, 405, { error: "Method Not Allowed" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(event, 400, { error: "Invalid JSON body." });
  }
  const {
    customerId,
    items,
    status,
    userName,
    userEmail,
    deliveryMethod,
    deliveryDetails,
    pickupDetails,
    paymentPreference,
    discount,
    source,
  } = payload;
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return json(event, 400, { error: "Missing customerId or items." });
  }

  const toCents = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  const normalizedItems = items
    .map((item) => ({
      productId: Number(item.productId),
      variantId: Number.isFinite(Number(item.variantId)) && Number(item.variantId) > 0
        ? Number(item.variantId)
        : null,
      digitString: String(item.digitString || item.numberSequence || item.digits || "")
        .replace(/\D/g, "")
        .slice(0, 40),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 0),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    }))
    .filter((item) => Number.isFinite(item.productId) && item.quantity > 0);
  if (normalizedItems.length === 0) {
    return json(event, 400, { error: "Missing order items." });
  }

  const sanitizedPickupDetails = sanitizeOrderLogisticsDetails(pickupDetails);
  const sanitizedDeliveryDetails = sanitizeOrderLogisticsDetails(deliveryDetails);
  const hasSubmittedPickupDetails = pickupDetails && typeof pickupDetails === "object";
  const hasSubmittedDeliveryDetails = deliveryDetails && typeof deliveryDetails === "object";
  if (hasSubmittedPickupDetails && !sanitizedPickupDetails) {
    return json(event, 400, { error: "Invalid pickup details." });
  }
  if (hasSubmittedDeliveryDetails && !sanitizedDeliveryDetails) {
    return json(event, 400, { error: "Invalid delivery details." });
  }
  const normalizedMethod = normalizeDeliveryMethod(deliveryMethod);
  const normalizedPaymentPreference = sanitizePaymentPreference(paymentPreference);
  const normalizedPickup = normalizedMethod === "pickup"
    ? sanitizedPickupDetails || sanitizedDeliveryDetails
    : null;
  const normalizedDelivery = normalizedMethod === "delivery" ? sanitizedDeliveryDetails : null;
  if (normalizedMethod === "delivery" && !normalizedDelivery) {
    return json(event, 400, { error: "Delivery details are required for delivery orders." });
  }
  if (normalizedMethod === "pickup" && (hasSubmittedPickupDetails || hasSubmittedDeliveryDetails) && !normalizedPickup) {
    return json(event, 400, { error: "Invalid pickup details." });
  }
  const ensureOrderColumns = async (dbClient) => {
    const statements = [
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryDetails" JSONB`,
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pickupDetails" JSONB`,
    ];
    for (const statement of statements) {
      try {
        await dbClient.query(statement);
      } catch (err) {
        console.warn("Order column check failed:", err?.message || err);
      }
    }
  };
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authUser = await requireUser(client, event);
    if (!authUser && source !== "checkout") {
      return json(event, 401, { error: "Unauthorized" });
    }
    const organizationId = authUser
      ? authUser.organizationId
      : await resolveOrganizationId(client, event, payload);
    await ensureAuditColumns(client);
    await ensureInventoryVariantSchema(client);
    await ensureOrderColumns(client);

    const actor = authUser
      ? { userId: authUser.id, userName: authUser.fullName, userEmail: authUser.email }
      : { userId: null, userName: userName || "Checkout", userEmail: userEmail || null };
    if (actor.userId) {
      const userRes = await client.query(
        `SELECT id FROM "user" WHERE id = $1 AND "organizationId" = $2`,
        [actor.userId, organizationId]
      );
      if (userRes.rowCount === 0) {
        actor.userId = null;
      }
    }
    if (!actor.userId) {
      actor.userName = actor.userName || "Guest";
    }
    if (actor.userId) {
      await backfillAuditDefaults(client, actor.userId, organizationId);
    }
    const assignedUserId = actor.userId || await pickAutoAssignee(client, organizationId);

    await client.query('BEGIN'); // Start transaction

    const digitExpandedItems = [];
    for (const item of normalizedItems) {
      if (!item.digitString || item.variantId) {
        digitExpandedItems.push(item);
        continue;
      }

      const digitRes = await client.query(
        `SELECT id, "variantNumber"
         FROM "inventoryVariant"
         WHERE "organizationId" = $1
           AND "inventoryItemId" = $2
           AND "variantNumber" = ANY($3::text[])
           AND lower(COALESCE(status, 'active')) = 'active'`,
        [organizationId, item.productId, [...new Set(item.digitString.split(""))]]
      );
      const variantByNumber = new Map(
        digitRes.rows.map((row) => [String(row.variantNumber), Number(row.id)])
      );
      for (const digit of item.digitString.split("")) {
        const digitVariantId = variantByNumber.get(digit);
        if (!digitVariantId) {
          await client.query("ROLLBACK");
          return json(event, 409, {
            error: `Number variant ${digit} is not configured for product ${item.productId}.`,
          });
        }
        digitExpandedItems.push({
          ...item,
          variantId: digitVariantId,
          digitString: "",
          quantity: 1,
        });
      }
    }

    const aggregatedItems = [];
    const aggregateMap = new Map();
    for (const item of digitExpandedItems) {
      const key = `${item.productId}:${item.variantId || ""}:${Number.isFinite(item.price) ? item.price : ""}`;
      const existing = aggregateMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        const next = { ...item };
        aggregateMap.set(key, next);
        aggregatedItems.push(next);
      }
    }

    const productIds = [...new Set(aggregatedItems.map((item) => item.productId))];
    const productRes = await client.query(
      `SELECT id, name, price, stock, "isActive", "itemType", "sourceCategoryCode"
       FROM "product"
       WHERE id = ANY($1::int[]) AND "organizationId" = $2
       FOR UPDATE`,
      [productIds, organizationId]
    );
    const productMap = new Map(
      (productRes.rows || []).map((row) => [Number(row.id), row])
    );
    if (productMap.size !== productIds.length) {
      await client.query("ROLLBACK");
      return json(event, 404, { error: "One or more products were not found." });
    }
    const variantIds = [
      ...new Set(
        aggregatedItems
          .map((item) => Number(item.variantId))
          .filter((value) => Number.isFinite(value) && value > 0)
      ),
    ];
    const variantMap = new Map();
    if (variantIds.length) {
      const variantRes = await client.query(
        `SELECT
           id,
           "inventoryItemId",
           sku,
           "variantNumber",
           color,
           size,
           "stockQty",
           "reservedQty",
           "priceOverride",
           status
         FROM "inventoryVariant"
         WHERE id = ANY($1::int[])
           AND "organizationId" = $2
         FOR UPDATE`,
        [variantIds, organizationId]
      );
      variantRes.rows.forEach((row) => variantMap.set(Number(row.id), row));
      if (variantMap.size !== variantIds.length) {
        await client.query("ROLLBACK");
        return json(event, 404, { error: "One or more variants were not found." });
      }
    }

    for (const item of aggregatedItems) {
      const product = productMap.get(item.productId);
      const dbPriceCents = Number(product?.price);
      const availableStock = Number(product?.stock ?? 0);
      const isActive = product?.isActive !== false;
      const itemType = String(product?.itemType || "STANDARD").toUpperCase();
      const sourceCode = String(product?.sourceCategoryCode || "").trim().toUpperCase();
      if (!Number.isFinite(dbPriceCents)) {
        await client.query("ROLLBACK");
        return json(event, 400, { error: `Invalid price for product ${item.productId}.` });
      }
      if (sourceCode === "RENTAL") {
        await client.query("ROLLBACK");
        return json(event, 400, { error: `"${product?.name || `Item ${item.productId}`}" is a rental item and cannot be added to an order. Use the bookings system instead.` });
      }
      if (!isActive) {
        await client.query("ROLLBACK");
        return json(event, 409, { error: `Product ${item.productId} is unavailable.` });
      }
      if (item.variantId) {
        const variant = variantMap.get(Number(item.variantId));
        if (!variant || Number(variant.inventoryItemId) !== Number(item.productId)) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `Variant ${item.variantId} does not belong to product ${item.productId}.` });
        }
        if (String(variant.status || "active").toLowerCase() !== "active") {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `Variant ${item.variantId} is unavailable.` });
        }
        const availableVariantStock = Math.max(
          Number(variant.stockQty || 0) - Number(variant.reservedQty || 0),
          0
        );
        if (availableVariantStock < item.quantity) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `Insufficient stock for ${formatVariantLabel(product.name, variant)}.` });
        }
        continue;
      }
      if (itemType === "VARIANT_PARENT") {
        await client.query("ROLLBACK");
        return json(event, 400, { error: `Choose a specific variant for ${product.name || `product ${item.productId}`}.` });
      }
      if (!Number.isFinite(availableStock) || availableStock < item.quantity) {
        await client.query("ROLLBACK");
        return json(event, 409, { error: `Insufficient stock for product ${item.productId}.` });
      }
    }

    const allowPriceOverride = Boolean(authUser);
    const pricedItems = aggregatedItems.map((item) => {
      const product = productMap.get(item.productId);
      const dbPriceCents = Number(product?.price);
      const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
      const variantPriceCents = Number(variant?.priceOverride);
      const overrideCents = allowPriceOverride && Number.isFinite(item.price)
        ? Math.max(0, toCents(item.price))
        : null;
      const unitPriceCents = Number.isFinite(overrideCents)
        ? overrideCents
        : Number.isFinite(variantPriceCents) && variantPriceCents >= 0
          ? variantPriceCents
          : dbPriceCents;
      return {
        ...item,
        unitPriceCents,
        variantLabel: variant ? formatVariantLabel(product?.name, variant) : null,
      };
    });
    const discountCents = allowPriceOverride ? Math.max(0, toCents(discount || 0)) : 0;
    const itemsTotalCents = pricedItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );
    const totalAmountCents = Math.max(0, itemsTotalCents - discountCents);

    await client.query(
      `SELECT setval(pg_get_serial_sequence('"order"', 'id'), COALESCE((SELECT MAX(id) FROM "order"), 0) + 1, false)`
    );

    const customerRes = await client.query(
      `SELECT name, email, phone FROM "customer" WHERE id = $1 AND "organizationId" = $2`,
      [customerId, organizationId]
    );
    if (customerRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return json(event, 404, { error: "Customer not found." });
    }
    const customerName = customerRes.rows[0].name;
    const customerEmail = customerRes.rows[0].email;
    const customerPhone = customerRes.rows[0].phone;
    const today = new Date();
    const dateStamp = today.toISOString().slice(0, 10).replace(/-/g, "");
    const sequenceRes = await client.query(
      `SELECT COUNT(*)::int + 1 AS next_number
       FROM "order"
       WHERE "orderDate"::date = CURRENT_DATE
         AND "organizationId" = $1`,
      [organizationId]
    );
    const nextNumber = sequenceRes.rows[0]?.next_number || 1;
    const orderNumber = `ORD-${dateStamp}-${String(nextNumber).padStart(3, "0")}`;

    // 2. Create the Order
    const orderStatus = authUser ? status || "pending" : "pending";
    const orderRes = await client.query(
      `INSERT INTO "order" (
         "organizationId",
         "orderNumber",
         "customerId",
         "customerName",
         "status",
         "deliveryMethod",
         "deliveryDetails",
         "pickupDetails",
         "total_amount",
         "orderDate",
         "createdAt",
         "updatedAt",
         "assignedUserId",
         "createdByUserId",
         "updatedByUserId",
         "lastModifiedAt"
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW(), $10, $11, $12, NOW()) RETURNING id`,
      [
        organizationId,
        orderNumber,
        customerId,
        customerName,
        orderStatus,
        normalizedMethod,
        normalizedDelivery,
        normalizedPickup,
        totalAmountCents,
        assignedUserId,
        actor.userId,
        actor.userId,
      ]
    );
    const orderId = orderRes.rows[0].id;

    // 3. Process each item
    for (const item of pricedItems) {
      const quantity = item.quantity;
      const unitPriceCents = item.unitPriceCents;
      const lineTotal = unitPriceCents * quantity;

      // Add to orderItem table
      await client.query(
        `INSERT INTO "orderItem" (
           "organizationId",
           "orderId",
           "productId",
           "variantId",
           "quantity",
           "unit_price",
           "total_amount"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [organizationId, orderId, item.productId, item.variantId || null, quantity, unitPriceCents, lineTotal]
      );

      const updateResult = item.variantId
        ? await client.query(
            `UPDATE "inventoryVariant"
             SET "stockQty" = "stockQty" - $1,
                 "updatedAt" = NOW()
             WHERE id = $2
               AND "organizationId" = $3
               AND GREATEST("stockQty" - "reservedQty", 0) >= $1`,
            [quantity, item.variantId, organizationId]
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
            [quantity, item.productId, actor.userId, organizationId]
          );
      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return json(event, 409, { error: `Unable to reserve stock for product ${item.productId}.` });
      }

      if (item.variantId) {
        await client.query(
          `UPDATE "product" p
           SET stock = COALESCE((
                 SELECT SUM(v."stockQty")::int
                 FROM "inventoryVariant" v
                 WHERE v."organizationId" = p."organizationId"
                   AND v."inventoryItemId" = p.id
                   AND lower(COALESCE(v.status, 'active')) <> 'inactive'
               ), p.stock),
               "lastUpdatedByUserId" = COALESCE($2, "lastUpdatedByUserId"),
               "lastUpdatedAt" = NOW(),
               "updatedAt" = NOW()
           WHERE p.id = $1 AND p."organizationId" = $3`,
          [item.productId, actor.userId, organizationId]
        );
      }

      // Record StockMovement (StockOut)
      await client.query(
        `INSERT INTO "stockMovement" (
           "organizationId",
           "productId",
           "variantId",
           "type",
           "quantity",
           "notes",
           "reference",
           "date",
           "performedByUserId",
           "performedByName",
           "performedByEmail",
           "createdAt"
         ) 
         VALUES ($1, $2, $3, 'StockOut', $4, $5, $6, NOW(), $7, $8, $9, NOW())`,
        [
          organizationId,
          item.productId,
          item.variantId || null,
          quantity,
          item.variantLabel ? `Sold in Order #${orderId}: ${item.variantLabel}` : `Sold in Order #${orderId}`,
          orderNumber,
          actor.userId,
          actor.userName,
          actor.userEmail,
        ]
      );
    }

    await client.query('COMMIT');
    const orderEmailPayload = {
      orderNumber,
      customerName,
      customerEmail,
      customerPhone,
      totalAmountCents,
      deliveryMethod: normalizedMethod,
      deliveryDetails: normalizedDelivery,
      pickupDetails: normalizedPickup,
      paymentPreference: normalizedPaymentPreference,
      items: pricedItems.map((item) => ({
        ...item,
        productName: item.variantLabel || productMap.get(item.productId)?.name || `Item ${item.productId}`,
      })),
    };
    try {
      await sendManagerWhatsApp({
        lines: buildWhatsAppLines({
          orderNumber,
          customerName,
          customerPhone,
          totalAmountCents,
          deliveryMethod: normalizedMethod,
          deliveryDetails: normalizedDelivery,
          pickupDetails: normalizedPickup,
          itemsCount: pricedItems.length,
        }),
      });
    } catch (err) {
      console.warn("WhatsApp notify failed:", err?.message || err);
    }
    try {
      await notifyManager(
        client,
        buildOrderNotification({
          orderId,
          orderNumber,
          customerName,
          customerPhone,
          totalAmountCents,
          itemsCount: pricedItems.length,
          deliveryMethod: normalizedMethod,
          deliveryDetails: normalizedDelivery,
          pickupDetails: normalizedPickup,
        })
      );
    } catch (err) {
      console.warn("Manager push failed:", err?.message || err);
    }
    const emailResults = await Promise.allSettled(
      [
        sendNotificationEmail({
          to: getNotificationCatchallEmail(),
          subject: `New order ${orderNumber}`,
          text: buildInternalOrderEmailText(orderEmailPayload),
          html: buildInternalOrderEmailHtml(orderEmailPayload),
        }),
        customerEmail
          ? sendNotificationEmail({
              to: customerEmail,
              subject: `We received your order ${orderNumber}`,
              text: buildCustomerOrderEmailText({
                ...orderEmailPayload,
                supportEmail: getNotificationCatchallEmail(),
              }),
              html: buildCustomerOrderEmailHtml({
                ...orderEmailPayload,
                supportEmail: getNotificationCatchallEmail(),
              }),
            })
          : null,
      ].filter(Boolean)
    );
    emailResults.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Order email failed:", result.reason?.message || result.reason);
      }
    });
    return json(event, 200, {
      message: "Order created successfully",
      orderId,
      orderNumber,
      assignedUserId,
      updatedByUserId: actor.userId,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return json(event, 500, { error: err.message || "Failed to create order." });
  } finally {
    await client.end().catch(() => {});
  }
}
