/* eslint-disable no-undef */
// Intentionally public: storefront inventory counts for the configured public organization only.
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { buildResponseHeaders } from "./_shared/http.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";

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

const loadTableColumns = async (client, tableName) => {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ANY (current_schemas(false))
        AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: json(event, 200, {}).headers, body: "" };
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
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);
    const productColumns = await loadTableColumns(client, "product");
    if (!productColumns.size) {
      return json(event, 200, { rentals: 0, products: 0 });
    }

    const hasColumn = (name) => productColumns.has(name);
    const filters = [];
    const queryValues = [];
    if (hasColumn("organizationId")) {
      queryValues.push(organizationId);
      filters.push(`p."organizationId" = $${queryValues.length}`);
    }
    if (hasColumn("isDeleted")) filters.push(`COALESCE(p."isDeleted", false) = false`);
    if (hasColumn("isArchived")) filters.push(`COALESCE(p."isArchived", false) = false`);

    const rentalPredicate = hasColumn("sourceCategoryCode")
      ? `LOWER(COALESCE(p."sourceCategoryCode", '')) = 'rental'`
      : hasColumn("itemType")
        ? `LOWER(COALESCE(p."itemType", '')) = 'rental'`
        : "false";
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await client.query(
      `SELECT
         SUM(
           CASE
             WHEN ${rentalPredicate} THEN 1
             ELSE 0
           END
         )::int AS rentals,
         SUM(
           CASE
             WHEN ${rentalPredicate} THEN 0
             ELSE 1
           END
         )::int AS products
       FROM "product" p
       ${whereClause}`,
      queryValues
    );

    const rentals = Number(result.rows[0]?.rentals || 0);
    const products = Number(result.rows[0]?.products || 0);

    return json(event, 200, { rentals, products });
  } catch (err) {
    if (err.code === "42P01") {
      return json(event, 200, { rentals: 0, products: 0 });
    }
    console.error("inventoryCounts error:", err);
    return json(event, err.statusCode || 500, { error: "Failed to load inventory counts" });
  } finally {
    await client.end().catch(() => {});
  }
}
