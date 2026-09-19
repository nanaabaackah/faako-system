/* eslint-disable no-undef */
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { createLogger } from "./_shared/logger.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";
import {
  ORDER_METHODS,
  getHeaderValue,
  parseJsonBody,
} from "./_shared/shopOrders.js";
import { recordManualPayment } from "../modules/payments/paymentService.js";
import { toPaymentAdminDto } from "../modules/payments/paymentDomain.js";
import { PAYMENT_PERMISSIONS } from "../modules/payments/paymentPolicy.js";

const METHODS = "GET,POST,OPTIONS";
const RESPONSE_OPTIONS = {
  methods: METHODS,
  allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token, X-Request-Id, Idempotency-Key",
};
const json = (event, statusCode, body) => respond(event, statusCode, body, RESPONSE_OPTIONS);
const logger = createLogger("order-payments");

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

  const client = createDatabaseClient({ component: "order-payments-database" });
  const requestLogger = logger.child({ requestId: getEventHeader(event, "x-request-id") || undefined });

  try {
    await client.connect();
    const authResult = await requirePermission(
      client,
      event,
      method === "GET" ? PAYMENT_PERMISSIONS.VIEW : PAYMENT_PERMISSIONS.RECORD_MANUAL,
      { methods: ORDER_METHODS }
    );
    if (authResult.errorResponse) return authResult.errorResponse;
    const { authUser, organizationId } = authResult;

    if (method === "GET") {
      const orderId = normalizeOrderId(event.queryStringParameters?.orderId);
      if (!orderId) return json(event, 400, { error: "orderId is required." });
      const result = await client.query(
        `SELECT
           p.id, p."orderId", p."customerId", p."amountCents", p.method, p.provider,
           p."transactionReference", p."confirmationStatus", p.status, p."paidAt",
           p."recordedByUserId", p.notes, p."createdAt",
           o."orderNumber", o.currency, o."customerName", c.phone AS "customerPhone"
         FROM "orderPayment" p
         JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
         LEFT JOIN "customer" c ON c.id = p."customerId" AND c."organizationId" = p."organizationId"
         WHERE p."organizationId" = $1
           AND p."orderId" = $2
           AND COALESCE(o."businessUnit", 'REEBS_CORE') = 'REEBS_CORE'
         ORDER BY p."paidAt" DESC, p.id DESC
         LIMIT 100`,
        [organizationId, orderId]
      );
      return json(event, 200, (result.rows || []).map(toPaymentAdminDto));
    }

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const body = parsed.body || {};
    const orderId = normalizeOrderId(body.orderId);
    if (!orderId) return json(event, 400, { error: "orderId is required." });
    const idempotencyKey = getHeaderValue(event, "idempotency-key");
    if (idempotencyKey.length < 8) {
      return json(event, 400, {
        error: "Idempotency-Key is required when recording a payment.",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      });
    }
    const amountCents = body.amountCents ?? Math.round(Number(body.amount || 0) * 100);

    const result = await recordManualPayment(client, {
        organizationId,
        payableType: "ORDER",
        payableId: orderId,
        amountCents,
        method: body.method,
        provider: body.provider || null,
        transactionReference: body.transactionReference || body.reference || null,
        phoneNumber: body.phoneNumber || null,
        notes: body.notes || null,
        idempotencyKey,
        actor: buildActor(authUser),
        requestId: getEventHeader(event, "x-request-id"),
      });
    return json(event, result.idempotentReplay ? 200 : 201, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      requestLogger.error({
        err: error,
        code: error?.code,
        eventName: "order_payment.request_failed",
      }, "Order payment request failed");
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to process payment." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
