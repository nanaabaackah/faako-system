/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";
import { getRecordedDeliveryDistanceKm } from "./_shared/deliveryFee.js";

const MANAGER_ORIGIN = String(process.env.MANAGER_APP_ORIGIN || process.env.URL || "").trim();
const allowedOrigin = MANAGER_ORIGIN || null;

const corsHeaders = (extraAllow = "GET,OPTIONS") => ({
  ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token",
  "Access-Control-Allow-Methods": extraAllow,
  "Vary": "Origin",
});

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders(),
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const withDeliveryTotals = (order) => {
  const grandTotal = Number(order?.total || 0);
  const feeCents = Number(order?.deliveryFeeCents || 0);
  const itemsTotal = Number.isFinite(Number(order?.subtotalCents))
    ? Number(order.subtotalCents) / 100
    : Math.max(0, grandTotal - feeCents / 100);
  const distanceKm = getRecordedDeliveryDistanceKm(
    order?.deliveryMethod,
    order?.deliveryDetails
  );
  const deliveryFee = feeCents / 100;
  return {
    ...order,
    itemsTotal,
    deliveryFee,
    deliveryFeeCents: feeCents,
    deliveryDistanceKm: distanceKm || 0,
    total: grandTotal,
  };
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed" });
  }

  const manager = getManagerFromEvent(event, {
    requiredScopes: ["manager:orders:read"],
  });
  if (!manager) {
    return json(401, { error: "Unauthorized" });
  }

  const organizationId = Number(manager.organizationId);
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return json(403, { error: "Manager token is missing organization context." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureManagerDeviceTable(client);
    const result = await client.query(
      `SELECT
         o.id,
         o."orderNumber",
         o."customerName",
         o.status,
         o."deliveryMethod",
         o."deliveryDetails",
         o."pickupDetails",
         o."subtotalCents",
         o."deliveryFeeCents",
         (COALESCE(o."grandTotalCents", o."total_amount")::numeric / 100) AS total,
         o."orderDate",
         o."lastModifiedAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'productId', p.id,
               'productName', p.name,
               'sku', p.sku,
               'quantity', oi.quantity,
               'unitPrice', oi.unit_price,
               'total', oi.total_amount,
               'imageUrl', p."imageUrl"
             )
             ORDER BY oi.id
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "order" o
       LEFT JOIN "orderItem" oi ON oi."orderId" = o.id AND oi."organizationId" = o."organizationId"
       LEFT JOIN "product" p ON p.id = oi."productId" AND p."organizationId" = o."organizationId"
       WHERE o."organizationId" = $1
       GROUP BY o.id
       ORDER BY o."orderDate" DESC, o.id DESC
       LIMIT 200`,
      [organizationId]
    );
    return json(200, (result.rows || []).map(withDeliveryTotals));
  } catch (err) {
    console.error("Manager orders error", err);
    return json(500, { error: "Failed to load orders." });
  } finally {
    await client.end().catch(() => {});
  }
}
