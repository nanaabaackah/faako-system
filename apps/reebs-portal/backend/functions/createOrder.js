/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import {
  applyWindowRateLimit,
  getRequestClientIp,
} from "./_shared/requestRateLimit.js";
import {
  buildResponseHeaders,
  isAllowedAppOrigin,
  isCrossSiteBrowserRequest,
} from "./_shared/http.js";
import {
  createShopOrder,
  getHeaderValue,
  parseJsonBody,
} from "./_shared/shopOrders.js";
import { normalizeCheckoutQuoteFingerprint } from "./_shared/checkoutQuote.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";

const CHECKOUT_METHODS = "POST,OPTIONS";
const MAX_CHECKOUT_ITEMS = 100;

const json = (event, statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    ...buildResponseHeaders(event, {
      methods: CHECKOUT_METHODS,
      headers: "Content-Type,Idempotency-Key,X-Request-Id",
    }),
    "Content-Type": "application/json",
    ...extraHeaders,
  },
  body: statusCode === 204 ? "" : JSON.stringify(body),
});

const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const optionalNonNegativeCents = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
};

export const sanitizePublicCheckoutPayload = (body = {}) => {
  const customerId = positiveInteger(body?.customerId);
  if (!customerId) {
    const error = new Error("Customer is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > MAX_CHECKOUT_ITEMS) {
    const error = new Error(`Checkout requires between 1 and ${MAX_CHECKOUT_ITEMS} items.`);
    error.statusCode = 400;
    throw error;
  }

  const items = body.items.map((item) => {
    const productId = positiveInteger(item?.productId || item?.inventoryItemId);
    const quantity = positiveInteger(item?.quantity);
    const variantId = item?.variantId == null || item?.variantId === ""
      ? null
      : positiveInteger(item.variantId);
    const expectedUnitPriceCents = optionalNonNegativeCents(item?.expectedUnitPriceCents);
    if (
      !productId
      || !quantity
      || (item?.variantId != null && item?.variantId !== "" && !variantId)
      || Number.isNaN(expectedUnitPriceCents)
    ) {
      const error = new Error("Each checkout item requires a valid product, variant, and quantity.");
      error.statusCode = 400;
      throw error;
    }
    return {
      productId,
      variantId,
      quantity,
      digitString: typeof item?.digitString === "string" ? item.digitString : "",
      ...(expectedUnitPriceCents !== null ? { expectedUnitPriceCents } : {}),
    };
  });

  const deliveryMethod = String(body?.deliveryMethod || "pickup").trim().toLowerCase();
  if (!new Set(["delivery", "pickup"]).has(deliveryMethod)) {
    const error = new Error("Delivery method must be delivery or pickup.");
    error.statusCode = 400;
    throw error;
  }

  const paymentPreference = body?.paymentPreference && typeof body.paymentPreference === "object"
    ? {
        method: String(body.paymentPreference.method || "pay-later").trim(),
        momoProvider: String(body.paymentPreference.momoProvider || "").trim(),
        payLater: true,
      }
    : { method: "pay-later", payLater: true };
  const submittedQuoteFingerprint = body?.quoteFingerprint;
  const quoteFingerprint = normalizeCheckoutQuoteFingerprint(submittedQuoteFingerprint);
  if (submittedQuoteFingerprint != null && !quoteFingerprint) {
    const error = new Error("Checkout quote is invalid. Refresh the quote and try again.");
    error.statusCode = 400;
    error.code = "CHECKOUT_QUOTE_INVALID";
    throw error;
  }
  if (!quoteFingerprint) {
    const error = new Error("A current checkout quote is required. Refresh the quote and try again.");
    error.statusCode = 409;
    error.code = "CHECKOUT_QUOTE_REQUIRED";
    throw error;
  }

  // Public checkout can identify products and fulfilment only. Prices, discounts,
  // fees, status, source, totals, and tenant context are owned by the server.
  return {
    customerId,
    items,
    deliveryMethod,
    deliveryDetails: deliveryMethod === "delivery" ? body.deliveryDetails || null : null,
    pickupDetails: deliveryMethod === "pickup" ? body.pickupDetails || null : null,
    paymentPreference,
    source: "checkout",
    purchaseChannel: "website",
    fulfillmentMethod: deliveryMethod,
    deliveryRequired: deliveryMethod === "delivery",
    isPosOrder: false,
    status: "pending_payment",
    quoteFingerprint,
    acknowledgePriceChanges: body?.acknowledgePriceChanges === true,
  };
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "POST") return json(event, 405, { error: "Method Not Allowed" });

  const requestOrigin = getHeaderValue(event, "origin");
  if (requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
    return json(event, 403, { error: "Untrusted checkout origin." });
  }
  if (isCrossSiteBrowserRequest(event) && requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
    return json(event, 403, { error: "Cross-site checkout is not allowed." });
  }

  const contentType = getHeaderValue(event, "content-type").toLowerCase();
  if (contentType && !contentType.includes("application/json")) {
    return json(event, 415, { error: "Content-Type must be application/json." });
  }
  const parsed = parseJsonBody(event);
  if (parsed.error) return json(event, 400, { error: parsed.error });

  let payload;
  try {
    payload = sanitizePublicCheckoutPayload(parsed.body);
  } catch (error) {
    return json(event, error?.statusCode || 400, {
      error: error?.message || "Invalid checkout.",
      ...(error?.code ? { code: error.code } : {}),
    });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);
    const rateLimit = await applyWindowRateLimit(client, {
      scope: `public-checkout:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(
        event,
        429,
        { error: "Too many checkout attempts. Try again later." },
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const idempotencyKey = getHeaderValue(event, "idempotency-key");
    await client.query("BEGIN");
    try {
      const result = await createShopOrder(client, {
        organizationId,
        payload,
        actor: { userId: null, userName: "Website checkout", userEmail: null },
        idempotencyKey,
      });
      await writeAuditLog(client, {
        organizationId,
        action: result.idempotentReplay ? "PUBLIC_ORDER_IDEMPOTENT_REPLAY" : "PUBLIC_ORDER_CREATED",
        targetType: "order",
        targetId: String(result.orderNumber || result.orderId || ""),
        source: "website",
        category: "order",
        severity: "info",
        status: "ok",
        summary: result.idempotentReplay
          ? `Replayed website order ${result.orderNumber}.`
          : `Created website order ${result.orderNumber}.`,
        actorType: "customer",
        actorLabel: "Website checkout",
        requestId: getEventHeader(event, "x-request-id"),
        ipAddress: getEventIpAddress(event),
        metadata: {
          itemCount: payload.items.length,
          priceChangeAcknowledged: payload.acknowledgePriceChanges,
          quoteFingerprint: payload.quoteFingerprint || null,
        },
      });
      await client.query("COMMIT");
      return json(event, result.idempotentReplay ? 200 : 201, result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Public checkout failed:", error?.message || error);
    return json(event, error?.statusCode || 500, {
      error: error?.statusCode ? error.message : "Unable to create the order.",
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.quote ? { quote: error.quote } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
