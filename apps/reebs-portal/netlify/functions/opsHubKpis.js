/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const parseUserId = (event) => {
  const raw =
    event?.queryStringParameters?.userId ||
    event?.headers?.["x-user-id"] ||
    event?.headers?.["X-User-Id"] ||
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isOwnerRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "owner" || normalized === "admin";
};

const countWithFallback = async (client, primarySql, fallbackSql) => {
  try {
    const result = await client.query(primarySql);
    return Number(result.rows[0]?.count || 0);
  } catch (err) {
    console.warn("Primary KPI query failed, falling back:", err?.message || err);
    const fallback = await client.query(fallbackSql);
    return Number(fallback.rows[0]?.count || 0);
  }
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

  const userId = parseUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: "userId is required" }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const roleRes = await client.query(
      `SELECT role FROM "user" WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const role = roleRes.rows[0]?.role || "";
    if (!isOwnerRole(role)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Owner access required" }),
      };
    }

    const [orgRes, userRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS count FROM "organization"`),
      client.query(`SELECT COUNT(*)::int AS count FROM "user"`),
    ]);

    const products = await countWithFallback(
      client,
      `SELECT COUNT(*)::int AS count
       FROM "product"
       WHERE COALESCE("isDeleted", false) = false
         AND COALESCE("isArchived", false) = false`,
      `SELECT COUNT(*)::int AS count FROM "product"`
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        organizations: Number(orgRes.rows[0]?.count || 0),
        users: Number(userRes.rows[0]?.count || 0),
        products,
      }),
    };
  } catch (err) {
    console.error("opsHubKpis error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to load KPI data" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
