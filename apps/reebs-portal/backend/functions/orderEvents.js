/* eslint-disable no-undef */
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { createLogger } from "./_shared/logger.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";
const json = (event, statusCode, body) => respond(event, statusCode, body, { methods: METHODS });
const logger = createLogger("order-events");

const normalizeOrderId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method Not Allowed" });

  const orderId = normalizeOrderId(event.queryStringParameters?.orderId);
  if (!orderId) return json(event, 400, { error: "orderId is required." });

  const client = createDatabaseClient({ component: "order-events-database" });
  const requestLogger = logger.child({ requestId: getEventHeader(event, "x-request-id") || undefined });

  try {
    await client.connect();
    const authResult = await requirePermission(client, event, "orders:read", {
      methods: METHODS,
    });
    if (authResult.errorResponse) return authResult.errorResponse;

    const result = await client.query(
      `SELECT *
       FROM "orderEvent"
       WHERE "organizationId" = $1
         AND "orderId" = $2
       ORDER BY "createdAt" DESC, id DESC`,
      [authResult.organizationId, orderId]
    );
    return json(event, 200, result.rows || []);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      requestLogger.error({ err: error, code: error?.code }, "Order event request failed");
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to fetch order events." : error.message,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
