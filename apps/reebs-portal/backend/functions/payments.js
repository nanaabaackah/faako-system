import { createDatabaseClient } from "./_shared/databaseClient.js";
import { createLogger } from "./_shared/logger.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";
import { listCorePayments } from "../modules/payments/paymentRepository.js";
import { PAYMENT_PERMISSIONS } from "../modules/payments/paymentPolicy.js";

const METHODS = "GET,OPTIONS";
const json = (event, statusCode, body) =>
  respond(event, statusCode, body, {
    methods: METHODS,
    allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-Request-Id",
  });
const logger = createLogger("payments");

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method Not Allowed" });

  const client = createDatabaseClient({ component: "payments-database" });
  const requestLogger = logger.child({
    requestId: getEventHeader(event, "x-request-id") || undefined,
  });
  try {
    await client.connect();
    const authResult = await requirePermission(
      client,
      event,
      PAYMENT_PERMISSIONS.VIEW,
      { methods: METHODS }
    );
    if (authResult.errorResponse) return authResult.errorResponse;
    const result = await listCorePayments(client, {
      organizationId: authResult.organizationId,
      query: event.queryStringParameters || {},
    });
    return json(event, 200, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      requestLogger.error(
        { err: error, code: error?.code, eventName: "payments.list_failed" },
        "Payments list failed"
      );
    }
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to load payments." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
