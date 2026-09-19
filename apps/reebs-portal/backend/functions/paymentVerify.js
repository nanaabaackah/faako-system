import { createDatabaseClient } from "./_shared/databaseClient.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { requirePermission, respond } from "./_shared/internalApi.js";
import { parseJsonBody } from "./_shared/shopOrders.js";
import { applyWindowRateLimit, getRequestClientIp } from "./_shared/requestRateLimit.js";
import { PAYMENT_PERMISSIONS } from "../modules/payments/paymentPolicy.js";
import { verifyPayment } from "../modules/payments/paymentService.js";

const METHODS = "POST,OPTIONS";
const OPTIONS = {
  methods: METHODS,
  allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token, X-Request-Id",
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
  const client = createDatabaseClient({ component: "payment-verify-database" });
  try {
    await client.connect();
    const authResult = await requirePermission(client, event, PAYMENT_PERMISSIONS.VERIFY, { methods: METHODS });
    if (authResult.errorResponse) return authResult.errorResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const reference = String(parsed.body?.reference || "").trim().slice(0, 160);
    if (!reference) return json(event, 400, { error: "Payment reference is required." });
    const rate = await applyWindowRateLimit(client, {
      scope: "payment-verify",
      identifier: `${authResult.organizationId}:${authResult.authUser.id}:${getRequestClientIp(event)}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) return json(event, 429, {
      error: "Too many verification requests. Please wait and try again.",
      code: "PAYMENT_RATE_LIMITED",
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    const result = await verifyPayment(client, {
      organizationId: authResult.organizationId,
      reference,
      actor: actorFrom(authResult.authUser),
      requestId: getEventHeader(event, "x-request-id"),
    });
    return json(event, 200, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to verify payment." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
