/* eslint-disable no-undef */
// Intentionally public: storefront catalog for the configured public organization only.
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { buildResponseHeaders, json } from "./_shared/http.js";
import { resolveConfiguredPublicOrganizationId } from "./_shared/organization.js";

const responseHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,OPTIONS",
  }),
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

export async function handler(event) {
  if (event?.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: responseHeaders(event),
      body: "",
    };
  }

  if (event?.httpMethod && event.httpMethod !== "GET") {
    return json(event, 405, { error: "Method not allowed" }, { methods: "GET,OPTIONS" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    const [bouncyColumns, productColumns] = await Promise.all([
      loadTableColumns(client, "bouncy_castles"),
      loadTableColumns(client, "product"),
    ]);
    if (!bouncyColumns.size) {
      return {
        statusCode: 200,
        headers: responseHeaders(event),
        body: JSON.stringify([]),
      };
    }

    const hasBouncyColumn = (name) => bouncyColumns.has(name);
    const hasProductColumn = (name) => productColumns.has(name);
    const bouncyColumn = (name) => `b."${name}"`;
    const selectExpr = (
      columnName,
      presentExpr = `${bouncyColumn(columnName)} AS "${columnName}"`,
      fallbackExpr = `NULL AS "${columnName}"`
    ) => (hasBouncyColumn(columnName) ? presentExpr : fallbackExpr);
    const productSelectExpr = (columnName, alias = columnName, fallback = `NULL AS "${alias}"`) =>
      hasProductColumn(columnName) ? `p."${columnName}" AS "${alias}"` : fallback;
    const imageExpr = hasBouncyColumn("images")
      ? hasBouncyColumn("image") && hasProductColumn("imageUrl")
        ? 'COALESCE(NULLIF(b."image", \'\'), NULLIF(b."images"[1], \'\'), NULLIF(p."imageUrl", \'\')) AS image'
        : hasBouncyColumn("image")
          ? 'COALESCE(NULLIF(b."image", \'\'), NULLIF(b."images"[1], \'\')) AS image'
          : 'NULLIF(b."images"[1], \'\') AS image'
      : hasBouncyColumn("image") && hasProductColumn("imageUrl")
        ? 'COALESCE(NULLIF(b."image", \'\'), NULLIF(p."imageUrl", \'\')) AS image'
        : hasBouncyColumn("image")
          ? 'b."image" AS image'
          : hasProductColumn("imageUrl")
            ? 'p."imageUrl" AS image'
            : "NULL AS image";
    const imagesExpr = hasBouncyColumn("images") ? 'b."images" AS images' : "ARRAY[]::text[] AS images";
    const productJoin = hasBouncyColumn("productId") && productColumns.size
      ? `LEFT JOIN "product" p
           ON p.id = b."productId"${
             hasBouncyColumn("organizationId") && hasProductColumn("organizationId")
               ? ' AND p."organizationId" = b."organizationId"'
               : ""
           }`
      : productColumns.size
        ? 'LEFT JOIN "product" p ON 1 = 0'
        : "";
    const availabilityExpr = productColumns.size
      ? `CASE
          WHEN p.id IS NULL THEN 'Available'
          WHEN ${hasProductColumn("isActive") ? 'COALESCE(p."isActive", true) = false' : "false"} THEN 'Unavailable'
          WHEN ${hasProductColumn("stock") ? 'p.stock IS NOT NULL AND p.stock <= 0' : "false"} THEN 'Unavailable'
          ELSE 'Available'
        END AS availability`
      : "'Available' AS availability";
    const filters = [];
    const queryValues = [];
    if (hasBouncyColumn("organizationId")) {
      queryValues.push(organizationId);
      filters.push(`b."organizationId" = $${queryValues.length}`);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const orderBy = hasBouncyColumn("id")
      ? 'ORDER BY b."id" ASC'
      : hasBouncyColumn("name")
        ? 'ORDER BY b."name" ASC'
        : "";

    const result = await client.query(`
      SELECT
        ${selectExpr("id")},
        ${selectExpr("bouncerId")},
        ${selectExpr("name")},
        ${selectExpr("productId")},
        ${selectExpr("capacity")},
        ${selectExpr("recommendedAge")},
        ${selectExpr("priceRange")},
        ${selectExpr("motorsToPump")},
        ${productSelectExpr("attendantsNeeded", "attendantsNeeded")},
        ${productSelectExpr("rate")},
        ${productSelectExpr("stock", "quantity")},
        ${productSelectExpr("isActive", "status", "NULL AS status")},
        ${availabilityExpr},
        ${selectExpr("bestFor")},
        ${selectExpr("features")},
        ${imageExpr},
        ${imagesExpr}
      FROM "bouncy_castles" b
      ${productJoin}
      ${whereClause}
      ${orderBy}
    `, queryValues);

    return {
      statusCode: 200,
      headers: responseHeaders(event),
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    if (err.code === "42P01") {
      return {
        statusCode: 200,
        headers: responseHeaders(event),
        body: JSON.stringify([]),
      };
    }
    console.error("❌ Database error:", err);
    return json(event, err.statusCode || 500, { error: "Failed to fetch bouncy castles" }, { methods: "GET,OPTIONS" });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}
