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

    const [columns, productColumns] = await Promise.all([
      loadTableColumns(client, "machines"),
      loadTableColumns(client, "product"),
    ]);
    if (!columns.size) {
      return {
        statusCode: 200,
        headers: responseHeaders(event),
        body: JSON.stringify([]),
      };
    }
    const hasColumn = (name) => columns.has(name);
    const hasProductColumn = (name) => productColumns.has(name);
    const machineColumn = (columnName) => `m."${columnName}"`;
    const selectExpr = (
      columnName,
      presentExpr = `${machineColumn(columnName)} AS "${columnName}"`,
      fallbackExpr = `NULL AS "${columnName}"`
    ) =>
      hasColumn(columnName) ? presentExpr : fallbackExpr;
    const availabilityExpr = hasColumn("availability")
      ? 'm."availability" AS availability'
      : hasColumn("status")
        ? 'm."status" AS availability'
        : "NULL AS availability";
    const imageExpr = hasColumn("image")
      ? hasProductColumn("imageUrl")
        ? 'COALESCE(NULLIF(m."image", \'\'), NULLIF(p."imageUrl", \'\')) AS image'
        : 'm."image" AS image'
      : hasProductColumn("imageUrl")
        ? 'p."imageUrl" AS image'
        : "NULL AS image";
    const productJoin = hasColumn("productId") && productColumns.size
      ? `LEFT JOIN "product" p
           ON p.id = m."productId"${
             hasColumn("organizationId") && hasProductColumn("organizationId")
               ? ' AND p."organizationId" = m."organizationId"'
               : ""
           }`
      : productColumns.size
        ? 'LEFT JOIN "product" p ON 1 = 0'
        : "";
    if (!hasColumn("organizationId")) {
      return {
        statusCode: 503,
        headers: responseHeaders(event),
        body: JSON.stringify({ error: "Machines catalog is missing organization scoping." }),
      };
    }
    const orderBy = hasColumn("id")
      ? 'ORDER BY m."id" ASC'
      : hasColumn("name")
        ? 'ORDER BY m."name" ASC'
        : "";

    const result = await client.query(`
      SELECT
        ${selectExpr("id")},
        ${selectExpr("name")},
        ${selectExpr("productId")},
        ${selectExpr("quantity")},
        ${selectExpr("price")},
        ${selectExpr("rate")},
        ${availabilityExpr},
        ${selectExpr("category")},
        ${imageExpr},
        ${selectExpr("page")},
        ${selectExpr("power")},
        ${selectExpr("footprint")},
        ${selectExpr("output")},
        ${selectExpr("notes")}
      FROM "machines" m
      ${productJoin}
      WHERE m."organizationId" = $1
      ${orderBy}
    `, [organizationId]);

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
    return json(event, err.statusCode || 500, { error: "Failed to fetch machines" }, { methods: "GET,OPTIONS" });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}
