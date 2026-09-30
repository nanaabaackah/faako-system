import { createDatabaseClient } from "./_shared/databaseClient.js";
import { respond } from "./_shared/internalApi.js";
import { createPaystackProvider } from "../modules/payments/providers/paystackProvider.js";
import { finalizeVerifiedPayment } from "../modules/payments/paymentService.js";
import {
  fingerprintProviderEvent,
  parsePaymentReferenceOrganizationId,
} from "../modules/payments/paymentPersistence.js";

const METHODS = "POST,OPTIONS";
const json = (event, statusCode, body) => respond(event, statusCode, body, { methods: METHODS });
const header = (event, name) => String(
  event?.headers?.[name]
  || event?.headers?.[name.toLowerCase()]
  || event?.headers?.[name.toUpperCase()]
  || ""
).trim();

export async function handler(event = {}) {
  const method = String(event.httpMethod || "POST").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "POST") return json(event, 405, { error: "Method Not Allowed" });
  const rawBody = event.isBase64Encoded
    ? Buffer.from(String(event.body || ""), "base64").toString("utf8")
    : String(event.body || "");
  let provider;
  try {
    provider = createPaystackProvider();
  } catch {
    return json(event, 503, { error: "Payment webhook is not configured." });
  }
  let webhook;
  try {
    webhook = provider.processWebhook({
      rawBody,
      signature: header(event, "x-paystack-signature"),
    });
  } catch (error) {
    return json(event, Number(error?.statusCode) || 400, { error: error.message });
  }
  if (!webhook.supported) {
    return json(event, 200, { received: true, ignored: true });
  }
  const transaction = webhook.transaction;
  if (!transaction.providerReference) {
    return json(event, 400, { error: "Webhook payment reference is missing." });
  }
  const organizationId = parsePaymentReferenceOrganizationId(transaction.providerReference);
  if (!organizationId) {
    return json(event, 400, { error: "Webhook payment reference is invalid." });
  }
  const client = createDatabaseClient({ component: "paystack-webhook-database" });
  try {
    await client.connect();
    const result = await finalizeVerifiedPayment(client, {
      organizationId,
      reference: transaction.providerReference,
      transaction,
      requestId: header(event, "x-request-id") || null,
      event: {
        type: webhook.eventType,
        fingerprint: fingerprintProviderEvent(rawBody),
      },
    });
    return json(event, 200, { received: true, applied: !result.idempotentReplay });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Webhook processing failed." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
