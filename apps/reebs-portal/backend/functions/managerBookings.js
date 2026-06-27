/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";

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

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed" });
  }

  const manager = getManagerFromEvent(event, {
    requiredScopes: ["manager:bookings:read"],
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
       JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
       LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id AND bi."organizationId" = b."organizationId"
       LEFT JOIN "product" p ON p.id = bi."productId" AND p."organizationId" = b."organizationId"
       WHERE b."organizationId" = $1
       GROUP BY b.id, c.id
       ORDER BY b."eventDate" DESC, b.id DESC
       LIMIT 200`,
      [organizationId]
    );
    return json(200, result.rows);
  } catch (err) {
    console.error("Manager bookings error", err);
    return json(500, { error: "Failed to load bookings." });
  } finally {
    await client.end().catch(() => {});
  }
}
