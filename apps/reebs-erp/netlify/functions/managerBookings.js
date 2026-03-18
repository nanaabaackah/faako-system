/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

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
         b.id,
         b."customerId",
         c.name AS "customerName",
         b."eventDate",
         b."startTime",
         b."endTime",
         b."venueAddress",
         (b."totalAmount"::numeric / 100) AS total,
         b.status,
         b."createdAt",
         b."lastModifiedAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', bi.id,
               'productId', bi."productId",
               'quantity', bi.quantity,
               'price', bi.price,
               'productName', p.name,
               'productImage', p."imageUrl"
             )
             ORDER BY bi.id
           ) FILTER (WHERE bi.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "booking" b
       JOIN "customer" c ON c.id = b."customerId"
       LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id
       LEFT JOIN "product" p ON p.id = bi."productId"
       GROUP BY b.id, c.id
       ORDER BY b."eventDate" DESC, b.id DESC
       LIMIT 200`
    );
    return json(200, result.rows);
  } catch (err) {
    console.error("Manager bookings error", err);
    return json(500, { error: "Failed to load bookings." });
  } finally {
    await client.end().catch(() => {});
  }
}
