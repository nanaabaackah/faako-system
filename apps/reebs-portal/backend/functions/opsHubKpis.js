/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,OPTIONS" });

const countWithFallback = async (
  client,
  primarySql,
  primaryParams,
  fallbackSql,
  fallbackParams = primaryParams
) => {
  try {
    const result = await client.query(primarySql, primaryParams);
    return Number(result.rows[0]?.count || 0);
  } catch (err) {
    console.warn("Primary KPI query failed, falling back:", err?.message || err);
    const fallback = await client.query(fallbackSql, fallbackParams);
    return Number(fallback.rows[0]?.count || 0);
  }
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
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
    const internal = await requireInternalUser(client, event, {
      methods: "GET,OPTIONS",
      roles: ["owner", "admin"],
      roleError: "Admin access required.",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const { organizationId } = internal;
    const [orgRes, userRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "organization"
         WHERE id = $1`,
        [organizationId]
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "user"
         WHERE "organizationId" = $1`,
        [organizationId]
      ),
    ]);

    const products = await countWithFallback(
      client,
      `SELECT COUNT(*)::int AS count
       FROM "product"
       WHERE "organizationId" = $1
         AND COALESCE("isDeleted", false) = false
         AND COALESCE("isArchived", false) = false`,
      [organizationId],
      `SELECT COUNT(*)::int AS count
       FROM "product"
       WHERE "organizationId" = $1`,
      [organizationId]
    );

    return json(event, 200, {
      organizations: Number(orgRes.rows[0]?.count || 0),
      users: Number(userRes.rows[0]?.count || 0),
      products,
    });
  } catch (err) {
    console.error("opsHubKpis error:", err);
    return json(event, 500, { error: "Failed to load KPI data" });
  } finally {
    await client.end().catch(() => {});
  }
}
