import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { buildResponseHeaders, json } from "./_shared/http.js";

const responseHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,OPTIONS",
  }),
});

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

    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ANY (current_schemas(false))
        AND table_name = 'machines'
    `);
    const columns = new Set(columnsResult.rows.map((row) => row.column_name));
    const hasColumn = (name) => columns.has(name);
    const selectExpr = (columnName, presentExpr, fallbackExpr = `NULL AS "${columnName}"`) =>
      hasColumn(columnName) ? presentExpr : fallbackExpr;
    const availabilityExpr = hasColumn("availability")
      ? "availability"
      : hasColumn("status")
        ? 'status AS availability'
        : "NULL AS availability";
    const orderBy = hasColumn("id")
      ? "ORDER BY id ASC"
      : hasColumn("name")
        ? "ORDER BY name ASC"
        : "";

    const result = await client.query(`
      SELECT
        ${selectExpr("id", "id", "NULL AS id")},
        ${selectExpr("name", "name", "NULL AS name")},
        ${selectExpr("productId", '"productId"')},
        ${selectExpr("quantity", "quantity")},
        ${selectExpr("price", "price")},
        ${selectExpr("rate", "rate")},
        ${availabilityExpr},
        ${selectExpr("category", "category")},
        ${selectExpr("image", "image")},
        ${selectExpr("page", "page")},
        ${selectExpr("power", "power")},
        ${selectExpr("footprint", "footprint")},
        ${selectExpr("output", "output")},
        ${selectExpr("notes", "notes")}
      FROM "machines"
      ${orderBy}
    `);

    return {
      statusCode: 200,
      headers: responseHeaders(event),
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(event, 500, { error: "Failed to fetch machines" }, { methods: "GET,OPTIONS" });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}
