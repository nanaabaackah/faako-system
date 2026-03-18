/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { resolveOrganizationId } from "./_shared/organization.js";
import { buildResponseHeaders } from "./_shared/http.js";

const responseHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,OPTIONS",
  }),
});

const json = (event, statusCode, body) => ({
  statusCode,
  headers: responseHeaders(event),
  body: JSON.stringify(body),
});

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: responseHeaders(event), body: "" };
  }
  if (method !== "GET") {
    return json(event, 405, { error: "Method not allowed" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const organizationId = await resolveOrganizationId(client, event, null);

    const [inventoryRes, bookingsRes, ordersRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "product"
         WHERE "organizationId" = $1
           AND COALESCE("isDeleted", false) = false
           AND COALESCE("isArchived", false) = false`,
        [organizationId]
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "booking"
         WHERE "organizationId" = $1
           AND COALESCE(status, '') NOT ILIKE 'cancelled'
           AND COALESCE(status, '') NOT ILIKE 'canceled'`,
        [organizationId]
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "order"
         WHERE "organizationId" = $1`,
        [organizationId]
      ),
    ]);

    return json(event, 200, {
      inventoryCount: Number(inventoryRes.rows[0]?.count || 0),
      bookingCount: Number(bookingsRes.rows[0]?.count || 0),
      orderCount: Number(ordersRes.rows[0]?.count || 0),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("publicStats error", err);
    return json(event, 500, { error: "Failed to load public stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
