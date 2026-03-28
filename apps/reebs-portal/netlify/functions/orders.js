/* eslint-disable no-undef */
// Filename: orders.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns, backfillAuditDefaults } from "./auditHelpers.js";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { sanitizeOrderLogisticsDetails } from "./_shared/orderDetails.js";

const ORDER_METHODS = "GET,PUT,OPTIONS";

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
    return respond(event, 204, {}, { methods: ORDER_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureAuditColumns(client);
    await ensureOrderColumns(client);
    const authResult = await requireInternalUser(client, event, {
      methods: ORDER_METHODS,
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;
    let payload = null;
    if (event.httpMethod === "PUT") {
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return respond(event, 400, { error: "Invalid JSON body." }, { methods: ORDER_METHODS });
      }
    }
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
         LEFT JOIN "user" assignee
           ON assignee.id = o."assignedUserId"
          AND assignee."organizationId" = o."organizationId"
         LEFT JOIN "user" updater
           ON updater.id = o."updatedByUserId"
          AND updater."organizationId" = o."organizationId"
         WHERE o."organizationId" = $1
         ${hasOrderId ? `AND o.id = $2` : ""}
         ORDER BY o."orderDate" DESC, o."id" DESC`
      ,
        params
      );

      if (hasOrderId) {
        if (result.rowCount === 0) {
          return respond(event, 404, { error: "Order not found." }, { methods: ORDER_METHODS });
        }
        return respond(event, 200, withDeliveryTotals(result.rows[0]), { methods: ORDER_METHODS });
      }

      return respond(event, 200, (result.rows || []).map(withDeliveryTotals), {
        methods: ORDER_METHODS,
      });
    }

    if (event.httpMethod !== "PUT") {
      return respond(event, 405, { error: "Method Not Allowed" }, { methods: ORDER_METHODS });
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
      return respond(event, 400, { error: "Order id is required." }, { methods: ORDER_METHODS });
    }
    if (hasStatusField && !nextStatus) {
      return respond(event, 400, { error: "Status is required." }, { methods: ORDER_METHODS });
    }
    if (!wantsStatusUpdate && !hasLogisticsField) {
      return respond(event, 400, { error: "No updates provided." }, { methods: ORDER_METHODS });
    }
    if (hasMethodField && !normalizedMethod) {
      return respond(event, 400, { error: "Invalid delivery method." }, { methods: ORDER_METHODS });
    }
    if (hasPickupField && payload.pickupDetails && !normalizedPickup) {
      return respond(event, 400, { error: "Invalid pickup details." }, { methods: ORDER_METHODS });
    }
    if (hasDeliveryField && payload.deliveryDetails && !normalizedDelivery) {
      return respond(event, 400, { error: "Invalid delivery details." }, { methods: ORDER_METHODS });
    }

    const orderRes = await client.query(
      `SELECT id, status, "orderNumber", "deliveryMethod", "deliveryDetails", "pickupDetails"
       FROM "order"
       WHERE id = $1 AND "organizationId" = $2`,
      [orderId, organizationId]
    );
    if (orderRes.rowCount === 0) {
      return respond(event, 404, { error: "Order not found." }, { methods: ORDER_METHODS });
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
      return respond(
        event,
        400,
        { error: "Cannot reopen a cancelled order. Create a new order instead." },
        { methods: ORDER_METHODS }
      );
    }
    if (hasLogisticsField && effectiveMethod === "pickup" && !nextPickupDetails) {
      return respond(
        event,
        400,
        { error: "Pickup details are required for pickup orders." },
        { methods: ORDER_METHODS }
      );
    }
    if (hasLogisticsField && effectiveMethod === "delivery" && !nextDeliveryDetails) {
      return respond(
        event,
        400,
        { error: "Delivery details are required for delivery orders." },
        { methods: ORDER_METHODS }
      );
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
      return respond(event, 200, updatedRes.rows[0] || { id: orderId, status: nextStatus }, {
        methods: ORDER_METHODS,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("❌ Database error:", err);
    return respond(event, 500, { error: "Failed to process order update" }, {
      methods: ORDER_METHODS,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
