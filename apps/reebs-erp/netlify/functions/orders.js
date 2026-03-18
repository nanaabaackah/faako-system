/* eslint-disable no-undef */
// Filename: orders.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns, backfillAuditDefaults } from "./auditHelpers.js";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { sanitizeOrderLogisticsDetails } from "./_shared/orderDetails.js";
import { requireUser } from "./_shared/userAuth.js";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const normalizeStatus = (status) =>
  typeof status === "string" ? status.trim().toLowerCase() : "";

const isCancelledStatus = (status) =>
  ["cancelled", "canceled"].includes(normalizeStatus(status));

const normalizeDeliveryMethod = (value) => {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("delivery")) return "delivery";
  if (normalized.includes("pickup")) return "pickup";
  return "";
};

const withDeliveryTotals = (order) => {
  const baseTotal = Number(order?.total || 0);
  const { distanceKm, feeCents } = getDeliveryFeeDetails(
    order?.deliveryMethod,
    order?.deliveryDetails
  );
  const deliveryFee = feeCents / 100;
  return {
    ...order,
    itemsTotal: baseTotal,
    deliveryFee,
    deliveryFeeCents: feeCents,
    deliveryDistanceKm: distanceKm || 0,
    total: baseTotal + deliveryFee,
  };
};

const ensureOrderColumns = async (client) => {
  const statements = [
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryDetails" JSONB`,
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pickupDetails" JSONB`,
  ];
  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Order column check failed:", err?.message || err);
    }
  }
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      },
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureAuditColumns(client);
    await ensureOrderColumns(client);
    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(401, { error: "Unauthorized" });
    }
    let payload = null;
    if (event.httpMethod === "PUT") {
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON body." });
      }
    }
    const organizationId = authUser.organizationId;
    await backfillAuditDefaults(client, authUser.id, organizationId);

    if (event.httpMethod === "GET") {
      const orderId = Number(event.queryStringParameters?.orderId);
      const hasOrderId = Number.isFinite(orderId) && orderId > 0;
      const params = [organizationId];
      if (hasOrderId) params.push(orderId);
      const result = await client.query(
        `SELECT
           o.id,
           o."orderNumber",
           o."customerName",
           o.status,
           o."deliveryMethod",
           o."deliveryDetails",
           o."pickupDetails",
           (o."total_amount"::numeric / 100) AS total,
           o."orderDate",
           o."deliveryDate",
           o."lastModifiedAt",
           o."assignedUserId",
           o."updatedByUserId",
           assignee."fullName" AS "assignedUserName",
           updater."fullName" AS "updatedByName",
           (
             SELECT COALESCE(json_agg(json_build_object(
               'id', oi.id,
               'productId', oi."productId",
               'productName', p.name,
               'sku', p.sku,
               'quantity', oi.quantity,
               'unitPrice', oi.unit_price,
               'total', oi.total_amount,
               'imageUrl', p."imageUrl"
             )), '[]'::json)
             FROM "orderItem" oi
             LEFT JOIN "product" p ON p.id = oi."productId" AND p."organizationId" = o."organizationId"
             WHERE oi."orderId" = o.id
               AND oi."organizationId" = o."organizationId"
           ) AS items
         FROM "order" o
         LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId"
         LEFT JOIN "user" updater ON updater.id = o."updatedByUserId"
         WHERE o."organizationId" = $1
         ${hasOrderId ? `AND o.id = $2` : ""}
         ORDER BY o."orderDate" DESC, o."id" DESC`
      ,
        params
      );

      if (hasOrderId) {
        if (result.rowCount === 0) {
          return json(404, { error: "Order not found." });
        }
        return json(200, withDeliveryTotals(result.rows[0]));
      }

      return json(200, (result.rows || []).map(withDeliveryTotals));
    }

    if (event.httpMethod !== "PUT") {
      return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "GET,PUT,OPTIONS" });
    }

    const orderId = Number(payload.id);
    const hasStatusField = Object.prototype.hasOwnProperty.call(payload, "status");
    const nextStatus = normalizeStatus(payload.status);
    const wantsStatusUpdate = hasStatusField && Boolean(nextStatus);
    const hasPickupField = Object.prototype.hasOwnProperty.call(payload, "pickupDetails");
    const hasDeliveryField = Object.prototype.hasOwnProperty.call(payload, "deliveryDetails");
    const hasMethodField = Object.prototype.hasOwnProperty.call(payload, "deliveryMethod");
    const hasLogisticsField = hasPickupField || hasDeliveryField || hasMethodField;
    const normalizedPickup = sanitizeOrderLogisticsDetails(payload.pickupDetails);
    const normalizedDelivery = sanitizeOrderLogisticsDetails(payload.deliveryDetails);
    const normalizedMethod = hasMethodField ? normalizeDeliveryMethod(payload.deliveryMethod) : "";
    if (!Number.isFinite(orderId)) {
      return json(400, { error: "Order id is required." });
    }
    if (hasStatusField && !nextStatus) {
      return json(400, { error: "Status is required." });
    }
    if (!wantsStatusUpdate && !hasLogisticsField) {
      return json(400, { error: "No updates provided." });
    }
    if (hasMethodField && !normalizedMethod) {
      return json(400, { error: "Invalid delivery method." });
    }
    if (hasPickupField && payload.pickupDetails && !normalizedPickup) {
      return json(400, { error: "Invalid pickup details." });
    }
    if (hasDeliveryField && payload.deliveryDetails && !normalizedDelivery) {
      return json(400, { error: "Invalid delivery details." });
    }

    const orderRes = await client.query(
      `SELECT id, status, "orderNumber", "deliveryMethod", "deliveryDetails", "pickupDetails"
       FROM "order"
       WHERE id = $1 AND "organizationId" = $2`,
      [orderId, organizationId]
    );
    if (orderRes.rowCount === 0) {
      return json(404, { error: "Order not found." });
    }

    const currentStatus = normalizeStatus(orderRes.rows[0].status);
    const orderNumber = orderRes.rows[0].orderNumber;
    const currentMethod =
      normalizeDeliveryMethod(orderRes.rows[0].deliveryMethod) || "pickup";
    const effectiveMethod = normalizedMethod || currentMethod;
    const nextPickupDetails = hasPickupField
      ? normalizedPickup
      : orderRes.rows[0].pickupDetails;
    const nextDeliveryDetails = hasDeliveryField
      ? normalizedDelivery
      : orderRes.rows[0].deliveryDetails;
    const cancelling = wantsStatusUpdate ? isCancelledStatus(nextStatus) : false;
    const alreadyCancelled = isCancelledStatus(currentStatus);

    if (wantsStatusUpdate && alreadyCancelled && !cancelling) {
      return json(400, { error: "Cannot reopen a cancelled order. Create a new order instead." });
    }
    if (hasLogisticsField && effectiveMethod === "pickup" && !nextPickupDetails) {
      return json(400, { error: "Pickup details are required for pickup orders." });
    }
    if (hasLogisticsField && effectiveMethod === "delivery" && !nextDeliveryDetails) {
      return json(400, { error: "Delivery details are required for delivery orders." });
    }

    const actor = {
      userId: authUser.id,
      userName: authUser.fullName,
      userEmail: authUser.email,
    };

    await client.query("BEGIN");
    try {
      const updateParts = [];
      const params = [];
      if (wantsStatusUpdate) {
        params.push(nextStatus);
        updateParts.push(`status = $${params.length}`);
      }
      if (hasLogisticsField) {
        params.push(effectiveMethod);
        updateParts.push(`"deliveryMethod" = $${params.length}`);
        if (effectiveMethod === "delivery") {
          params.push(nextDeliveryDetails);
          updateParts.push(`"deliveryDetails" = $${params.length}`);
          updateParts.push(`"pickupDetails" = NULL`);
        } else {
          params.push(nextPickupDetails);
          updateParts.push(`"pickupDetails" = $${params.length}`);
          updateParts.push(`"deliveryDetails" = NULL`);
        }
      }
      params.push(actor.userId);
      updateParts.push(`"updatedByUserId" = $${params.length}`);
      updateParts.push(`"lastModifiedAt" = NOW()`);
      updateParts.push(`"updatedAt" = NOW()`);
      params.push(orderId, organizationId);

      await client.query(
        `UPDATE "order"
         SET ${updateParts.join(", ")}
         WHERE id = $${params.length - 1} AND "organizationId" = $${params.length}`,
        params
      );

      if (cancelling && !alreadyCancelled) {
        const itemsRes = await client.query(
          `SELECT "productId", quantity FROM "orderItem"
           WHERE "orderId" = $1 AND "organizationId" = $2`,
          [orderId, organizationId]
        );

        for (const item of itemsRes.rows) {
          await client.query(
            `UPDATE "product"
             SET stock = stock + $1,
                 "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
                 "lastUpdatedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $2 AND "organizationId" = $4`,
            [item.quantity, item.productId, actor.userId, organizationId]
          );

          await client.query(
            `INSERT INTO "stockMovement" (
               "organizationId",
               "productId",
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
             VALUES ($1, $2, 'StockIn', $3, $4, $5, NOW(), $6, $7, $8, NOW())`,
            [
              organizationId,
              item.productId,
              item.quantity,
              `Order #${orderNumber} cancelled`,
              orderNumber,
              actor.userId,
              actor.userName,
              actor.userEmail,
            ]
          );
        }
      }

      const updatedRes = await client.query(
        `SELECT id, status, "deliveryMethod", "deliveryDetails", "pickupDetails", "lastModifiedAt"
         FROM "order"
         WHERE id = $1 AND "organizationId" = $2`,
        [orderId, organizationId]
      );
      await client.query("COMMIT");
      return json(200, updatedRes.rows[0] || { id: orderId, status: nextStatus });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(500, { error: "Failed to process order update" });
  } finally {
    await client.end().catch(() => {});
  }
}
