/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";
import {
  hasAnyRole,
  requirePermission,
  respond,
} from "./_shared/internalApi.js";
import {
  ORDER_METHODS,
  cancelOrder,
  createShopOrder,
  fetchOrderDetail,
  fetchOrdersList,
  getHeaderValue,
  parseJsonBody,
  recordOrderPayment,
  updateOrderMetadata,
} from "./_shared/shopOrders.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: ORDER_METHODS });

const getOrderIdFromEvent = (event, body = {}) => {
  const raw =
    event?.queryStringParameters?.id ||
    event?.queryStringParameters?.orderId ||
    body?.id ||
    body?.orderId;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildActor = (authUser = {}) => ({
  userId: authUser.id || null,
  userName: authUser.fullName || authUser.name || authUser.email || "User",
  userEmail: authUser.email || null,
});

const writeMutationAudit = async (client, event, {
  action,
  organizationId,
  authUser,
  order,
  summary,
  metadata = {},
}) => {
  await writeAuditLog(client, {
    userId: authUser.id,
    organizationId,
    action,
    targetType: "order",
    targetId: String(order?.orderNumber || order?.id || ""),
    source: "api",
    category: "order",
    severity: "info",
    status: "ok",
    summary,
    actorLabel: authUser.fullName || authUser.email || "User",
    requestId: getEventHeader(event, "x-request-id"),
    ipAddress: getEventIpAddress(event),
    metadata,
  });
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const permission = method === "GET" ? "orders:read" : "orders:write";
    const authResult = await requirePermission(client, event, permission, {
      methods: ORDER_METHODS,
    });
    if (authResult.errorResponse) return authResult.errorResponse;

    const { authUser, organizationId } = authResult;
    const actor = buildActor(authUser);

    if (method === "GET") {
      const orderId = getOrderIdFromEvent(event);
      if (orderId) {
        const detail = await fetchOrderDetail(client, { organizationId, orderId });
        if (!detail) return json(event, 404, { error: "Order not found." });
        return json(event, 200, detail);
      }
      const orders = await fetchOrdersList(client, {
        organizationId,
        query: event.queryStringParameters || {},
      });
      return json(event, 200, orders);
    }

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const body = parsed.body || {};

    if (method === "POST") {
      const idempotencyKey = getHeaderValue(event, "Idempotency-Key");
      await client.query("BEGIN");
      try {
        const result = await createShopOrder(client, {
          organizationId,
          payload: body,
          actor,
          idempotencyKey,
        });
        await writeMutationAudit(client, event, {
          action: result.idempotentReplay ? "ORDER_IDEMPOTENT_REPLAY" : "ORDER_CREATED",
          organizationId,
          authUser,
          order: result,
          summary: result.idempotentReplay
            ? `Replayed order ${result.orderNumber}.`
            : `Created order ${result.orderNumber}.`,
          metadata: {
            idempotencyKey: idempotencyKey || null,
            paymentId: result.paymentId || null,
            receiptId: result.receiptId || null,
          },
        });
        await client.query("COMMIT");
        return json(event, result.idempotentReplay ? 200 : 201, result);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (String(error?.code) === "23505" && idempotencyKey) {
          const replay = await client.query(
            `SELECT id, "orderNumber"
             FROM "order"
             WHERE "organizationId" = $1
               AND "idempotencyKey" = $2
             LIMIT 1`,
            [organizationId, idempotencyKey]
          );
          if (replay.rowCount > 0) {
            return json(event, 200, {
              ...replay.rows[0],
              orderId: replay.rows[0].id,
              idempotentReplay: true,
            });
          }
        }
        throw error;
      }
    }

    if (method === "PATCH" || method === "PUT") {
      const orderId = getOrderIdFromEvent(event, body);
      if (!orderId) return json(event, 400, { error: "Order id is required." });

      const requestedStatus = String(body.status || "").trim().toLowerCase().replace(/\s+/g, "_");
      if (["cancelled", "canceled"].includes(requestedStatus)) {
        const paidCheck = await client.query(
          `SELECT "amountPaidCents", "paymentStatus"
           FROM "order"
           WHERE id = $1
             AND "organizationId" = $2`,
          [orderId, organizationId]
        );
        if (paidCheck.rowCount === 0) return json(event, 404, { error: "Order not found." });
        const hasPayment = Number(paidCheck.rows[0]?.amountPaidCents || 0) > 0
          || ["paid", "partially_paid", "overpaid"].includes(
            String(paidCheck.rows[0]?.paymentStatus || "").toLowerCase()
          );
        if (hasPayment && !hasAnyRole(authUser, ["owner", "admin"])) {
          return json(event, 403, {
            error: "Only owners and admins can cancel paid orders.",
          });
        }
        await client.query("BEGIN");
        try {
          const cancelled = await cancelOrder(client, {
            organizationId,
            orderId,
            reason: body.cancelReason || body.reason || "",
            actor,
          });
          await writeMutationAudit(client, event, {
            action: "ORDER_CANCELLED",
            organizationId,
            authUser,
            order: cancelled,
            summary: `Cancelled order ${cancelled.orderNumber}.`,
            metadata: { paidOrder: hasPayment },
          });
          await client.query("COMMIT");
          return json(event, 200, cancelled);
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        }
      }

      if (body.payment || body.recordPayment) {
        const paymentPayload = body.payment || body.recordPayment || {};
        const paymentIdempotencyKey = getHeaderValue(event, "Idempotency-Key");
        if (!paymentIdempotencyKey) {
          return json(event, 400, { error: "Idempotency-Key is required for payment writes." });
        }
        await client.query("BEGIN");
        try {
          const result = await recordOrderPayment(client, {
            organizationId,
            orderId,
            amountCents: paymentPayload.amountCents ?? Math.round(Number(paymentPayload.amount || 0) * 100),
            method: paymentPayload.method,
            provider: paymentPayload.provider || null,
            transactionReference: paymentPayload.transactionReference || paymentPayload.reference || null,
            phoneNumber: paymentPayload.phoneNumber || null,
            confirmationStatus: paymentPayload.confirmationStatus || null,
            notes: paymentPayload.notes || null,
            actor,
            idempotencyKey: paymentIdempotencyKey,
          });
          await writeMutationAudit(client, event, {
            action: "ORDER_PAYMENT_RECORDED",
            organizationId,
            authUser,
            order: result.order,
            summary: `Recorded payment for ${result.order.orderNumber}.`,
            metadata: {
              paymentId: result.payment.id,
              receiptId: result.receipt.id,
              amountCents: result.payment.amountCents,
            },
          });
          await client.query("COMMIT");
          return json(event, 200, result);
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        }
      }

      await client.query("BEGIN");
      try {
        const updated = await updateOrderMetadata(client, {
          organizationId,
          orderId,
          payload: body,
          actor,
        });
        await writeMutationAudit(client, event, {
          action: "ORDER_UPDATED",
          organizationId,
          authUser,
          order: updated,
          summary: `Updated order ${updated.orderNumber}.`,
          metadata: { fields: Object.keys(body || {}) },
        });
        await client.query("COMMIT");
        return json(event, 200, updated);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    if (method === "DELETE") {
      const orderId = getOrderIdFromEvent(event, body);
      if (!orderId) return json(event, 400, { error: "Order id is required." });

      const paidCheck = await client.query(
        `SELECT "amountPaidCents", "paymentStatus"
         FROM "order"
         WHERE id = $1
           AND "organizationId" = $2`,
        [orderId, organizationId]
      );
      if (paidCheck.rowCount === 0) return json(event, 404, { error: "Order not found." });
      const hasPayment = Number(paidCheck.rows[0]?.amountPaidCents || 0) > 0
        || ["paid", "partially_paid", "overpaid"].includes(
          String(paidCheck.rows[0]?.paymentStatus || "").toLowerCase()
        );
      if (hasPayment && !hasAnyRole(authUser, ["owner", "admin"])) {
        return json(event, 403, {
          error: "Only owners and admins can cancel paid orders.",
        });
      }

      await client.query("BEGIN");
      try {
        const cancelled = await cancelOrder(client, {
          organizationId,
          orderId,
          reason: body.cancelReason || body.reason || event.queryStringParameters?.reason || "",
          actor,
        });
        await writeMutationAudit(client, event, {
          action: "ORDER_CANCELLED",
          organizationId,
          authUser,
          order: cancelled,
          summary: `Cancelled order ${cancelled.orderNumber}.`,
          metadata: { paidOrder: hasPayment },
        });
        await client.query("COMMIT");
        return json(event, 200, cancelled);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    return json(event, 405, { error: "Method Not Allowed" });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("orders error", {
        message: error?.message,
        code: error?.code,
      });
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to process order request." : error.message,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
