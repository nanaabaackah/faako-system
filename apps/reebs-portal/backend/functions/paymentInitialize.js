import { createDatabaseClient } from "./_shared/databaseClient.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";
import { parseJsonBody } from "./_shared/shopOrders.js";
import { applyWindowRateLimit, getRequestClientIp } from "./_shared/requestRateLimit.js";
import { PAYMENT_PERMISSIONS } from "../modules/payments/paymentPolicy.js";
import { initializePayment } from "../modules/payments/paymentService.js";

const METHODS = "POST,OPTIONS";
const OPTIONS = {
  methods: METHODS,
  allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token, X-Request-Id, Idempotency-Key",
};
const json = (event, statusCode, body) => respond(event, statusCode, body, OPTIONS);

const actorFrom = (user = {}) => ({
  userId: user.id || null,
  userName: user.fullName || user.email || "Internal user",
  userEmail: user.email || null,
});

export async function handler(event = {}) {
  const method = String(event.httpMethod || "POST").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "POST") return json(event, 405, { error: "Method Not Allowed" });
  const client = createDatabaseClient({ component: "payment-initialize-database" });
  try {
    await client.connect();
    const authResult = await requirePermission(client, event, PAYMENT_PERMISSIONS.VERIFY, { methods: METHODS });
    if (authResult.errorResponse) return authResult.errorResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const rate = await applyWindowRateLimit(client, {
      scope: "payment-initialize",
      identifier: `${authResult.organizationId}:${authResult.authUser.id}:${getRequestClientIp(event)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) return json(event, 429, {
      error: "Too many payment initialization requests. Please wait and try again.",
      code: "PAYMENT_RATE_LIMITED",
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    const result = await initializePayment(client, {
      organizationId: authResult.organizationId,
      payableType: parsed.body?.payableType,
      payableId: parsed.body?.payableId,
      purpose: parsed.body?.purpose,
      provider: "PAYSTACK",
      idempotencyKey: getEventHeader(event, "idempotency-key"),
      actor: actorFrom(authResult.authUser),
    });
    return json(event, result.initializing ? 202 : 200, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to initialize payment." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
