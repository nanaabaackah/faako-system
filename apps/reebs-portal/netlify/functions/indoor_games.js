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

    const result = await client.query(`
      SELECT
        ig.id,
        ig.name,
        ig."productId",
        ig.quantity,
        ig.price,
        ig.rate,
        ig.availability,
        ig.category,
        COALESCE(NULLIF(ig.image, ''), NULLIF(p."imageUrl", '')) AS image,
        ig.page,
        ig."piecesTotal",
        ig."piecesMissing"
      FROM "indoor_games" ig
      LEFT JOIN "product" p
        ON p.id = ig."productId"
       AND p."organizationId" = ig."organizationId"
      ORDER BY ig.id ASC
    `);

    return {
      statusCode: 200,
      headers: responseHeaders(event),
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(event, 500, { error: "Failed to fetch indoor games" }, { methods: "GET,OPTIONS" });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}
