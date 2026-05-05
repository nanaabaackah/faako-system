/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";
import {
  ORDER_METHODS,
  parseJsonBody,
  recordOrderPayment,
} from "./_shared/shopOrders.js";

const METHODS = "GET,POST,OPTIONS";
const json = (event, statusCode, body) => respond(event, statusCode, body, { methods: METHODS });

const normalizeOrderId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildActor = (authUser = {}) => ({
  userId: authUser.id || null,
  userName: authUser.fullName || authUser.email || "User",
  userEmail: authUser.email || null,
});

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST"].includes(method)) return json(event, 405, { error: "Method Not Allowed" });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requirePermission(
      client,
      event,
      method === "GET" ? "orders:read" : "orders:write",
      { methods: ORDER_METHODS }
    );
    if (authResult.errorResponse) return authResult.errorResponse;
    const { authUser, organizationId } = authResult;

    if (method === "GET") {
      const orderId = normalizeOrderId(event.queryStringParameters?.orderId);
      if (!orderId) return json(event, 400, { error: "orderId is required." });
      const result = await client.query(
        `SELECT *
         FROM "orderPayment"
         WHERE "organizationId" = $1
           AND "orderId" = $2
         ORDER BY "paidAt" DESC, id DESC`,
        [organizationId, orderId]
      );
      return json(event, 200, result.rows || []);
    }

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const body = parsed.body || {};
    const orderId = normalizeOrderId(body.orderId);
    if (!orderId) return json(event, 400, { error: "orderId is required." });
    const amountCents = body.amountCents ?? Math.round(Number(body.amount || 0) * 100);

    await client.query("BEGIN");
    try {
      const result = await recordOrderPayment(client, {
        organizationId,
        orderId,
        amountCents,
        method: body.method,
        provider: body.provider || null,
        transactionReference: body.transactionReference || body.reference || null,
        phoneNumber: body.phoneNumber || null,
        confirmationStatus: body.confirmationStatus || null,
        notes: body.notes || null,
        actor: buildActor(authUser),
      });
      await writeAuditLog(client, {
        userId: authUser.id,
        organizationId,
        action: "ORDER_PAYMENT_RECORDED",
        targetType: "order",
        targetId: String(result.order.orderNumber || orderId),
        source: "api",
        category: "order",
        severity: "info",
        status: "ok",
        summary: `Recorded payment for ${result.order.orderNumber}.`,
        actorLabel: authUser.fullName || authUser.email || "User",
        requestId: getEventHeader(event, "x-request-id"),
        ipAddress: getEventIpAddress(event),
        metadata: {
          paymentId: result.payment.id,
          receiptId: result.receipt.id,
          amountCents: result.payment.amountCents,
        },
      });
      await client.query("COMMIT");
      return json(event, 201, result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("orderPayments error", { message: error?.message, code: error?.code });
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to process payment." : error.message,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
