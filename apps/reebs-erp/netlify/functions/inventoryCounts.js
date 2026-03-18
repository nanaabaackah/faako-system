/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT
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
      WHERE COALESCE(p."isDeleted", false) = false
        AND COALESCE(p."isArchived", false) = false
    `);

    const rentals = Number(result.rows[0]?.rentals || 0);
    const products = Number(result.rows[0]?.products || 0);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ rentals, products }),
    };
  } catch (err) {
    console.error("❌ inventoryCounts error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to load inventory counts" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
