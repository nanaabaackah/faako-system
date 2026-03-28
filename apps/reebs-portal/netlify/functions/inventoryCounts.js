/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { buildResponseHeaders } from "./_shared/http.js";

const resolvePublicOrganizationId = () => {
  const raw =
    process.env.PUBLIC_ORGANIZATION_ID ||
    process.env.REEBS_PUBLIC_ORGANIZATION_ID ||
    "1";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const json = (event, statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, {
      methods: "GET,OPTIONS",
      allowHeaders: "Content-Type",
      cacheControl: "public, max-age=300",
    }),
  },
  body: JSON.stringify(body),
});

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: json(event, 200, {}).headers, body: "" };
  }
  if (method !== "GET") {
    return json(event, 405, { error: "Method not allowed" });
  }

  const organizationId = resolvePublicOrganizationId();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT
         SUM(
           CASE
             WHEN LOWER(COALESCE(p."sourceCategoryCode", '')) = 'rental' THEN 1
             ELSE 0
           END
         )::int AS rentals,
         SUM(
           CASE
             WHEN LOWER(COALESCE(p."sourceCategoryCode", '')) = 'rental' THEN 0
             ELSE 1
           END
         )::int AS products
       FROM "product" p
       WHERE p."organizationId" = $1
         AND COALESCE(p."isDeleted", false) = false
         AND COALESCE(p."isArchived", false) = false`,
      [organizationId]
    );

    const rentals = Number(result.rows[0]?.rentals || 0);
    const products = Number(result.rows[0]?.products || 0);

    return json(event, 200, { rentals, products });
  } catch (err) {
    console.error("inventoryCounts error:", err);
    return json(event, 500, { error: "Failed to load inventory counts" });
  } finally {
    await client.end().catch(() => {});
  }
}
