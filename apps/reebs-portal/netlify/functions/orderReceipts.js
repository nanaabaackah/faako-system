/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requirePermission, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";
const json = (event, statusCode, body) => respond(event, statusCode, body, { methods: METHODS });

const normalizeId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method Not Allowed" });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requirePermission(client, event, "orders:read", {
      methods: METHODS,
    });
    if (authResult.errorResponse) return authResult.errorResponse;
    const { organizationId } = authResult;

    const receiptId = normalizeId(event.queryStringParameters?.id);
    if (receiptId) {
      const result = await client.query(
        `SELECT *
         FROM "orderReceipt"
         WHERE id = $1
           AND "organizationId" = $2`,
        [receiptId, organizationId]
      );
      if (result.rowCount === 0) return json(event, 404, { error: "Receipt not found." });
      return json(event, 200, result.rows[0]);
    }

    const orderId = normalizeId(event.queryStringParameters?.orderId);
    if (!orderId) return json(event, 400, { error: "orderId is required." });
    const result = await client.query(
      `SELECT id, "receiptNumber", "orderId", "paymentId", "customerId", "amountCents",
              "pdfDocumentId", "issuedAt", "issuedByUserId", "createdAt"
       FROM "orderReceipt"
       WHERE "organizationId" = $1
         AND "orderId" = $2
       ORDER BY "issuedAt" DESC, id DESC`,
      [organizationId, orderId]
    );
    return json(event, 200, result.rows || []);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("orderReceipts error", { message: error?.message, code: error?.code });
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to fetch receipts." : error.message,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
