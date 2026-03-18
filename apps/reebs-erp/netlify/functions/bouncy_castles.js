/* eslint-disable no-undef */
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
        b.id,
        b."bouncerId",
        b.name,
        b."productId",
        b.capacity,
        b."recommendedAge",
        b."priceRange",
        b."motorsToPump",
        p."attendantsNeeded" AS "attendantsNeeded",
        p.rate AS rate,
        p.stock AS quantity,
        p."isActive" AS status,
        CASE
          WHEN p.id IS NULL THEN 'Available'
          WHEN COALESCE(p."isActive", true) = false THEN 'Unavailable'
          WHEN p.stock IS NOT NULL AND p.stock <= 0 THEN 'Unavailable'
          ELSE 'Available'
        END AS availability,
        b."bestFor",
        b.features,
        b.image,
        b.images
      FROM "bouncy_castles" b
      LEFT JOIN "product" p ON p.id = b."productId"
      ORDER BY b.id ASC
    `);

    return {
      statusCode: 200,
      headers: responseHeaders(event),
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(event, 500, { error: "Failed to fetch bouncy castles" }, { methods: "GET,OPTIONS" });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}
