/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

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

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "GET,OPTIONS" });
  }

  const manager = getManagerFromEvent(event);
  if (!manager) {
    return json(401, { error: "Unauthorized" });
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
         (o."total_amount"::numeric / 100) AS total,
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
       LEFT JOIN "orderItem" oi ON oi."orderId" = o.id
       LEFT JOIN "product" p ON p.id = oi."productId"
       GROUP BY o.id
       ORDER BY o."orderDate" DESC, o.id DESC
       LIMIT 200`
    );
    return json(200, (result.rows || []).map(withDeliveryTotals));
  } catch (err) {
    console.error("Manager orders error", err);
    return json(500, { error: "Failed to load orders." });
  } finally {
    await client.end().catch(() => {});
  }
}
