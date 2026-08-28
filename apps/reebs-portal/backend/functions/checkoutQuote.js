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
  getHeaderValue,
  parseJsonBody,
  quoteShopOrder,
} from "./_shared/shopOrders.js";
import { buildPublicCheckoutQuote } from "./_shared/checkoutQuote.js";

const QUOTE_METHODS = "POST,OPTIONS";
const MAX_CHECKOUT_ITEMS = 100;

const json = (event, statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    ...buildResponseHeaders(event, {
      methods: QUOTE_METHODS,
      headers: "Content-Type,X-Request-Id",
    }),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
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

export const sanitizePublicCheckoutQuotePayload = (body = {}) => {
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > MAX_CHECKOUT_ITEMS) {
    const error = new Error(`Checkout quote requires between 1 and ${MAX_CHECKOUT_ITEMS} items.`);
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
      const error = new Error("Each quote item requires a valid product, variant, quantity, and expected price.");
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

  // Totals, discounts, service fees, delivery fees, tenant and business scope
  // are intentionally absent: the server resolves every commercial value.
  return {
    items,
    deliveryMethod,
    deliveryDetails: deliveryMethod === "delivery" ? body.deliveryDetails || null : null,
    pickupDetails: deliveryMethod === "pickup" ? body.pickupDetails || null : null,
    source: "checkout",
    purchaseChannel: "website",
    fulfillmentMethod: deliveryMethod,
    deliveryRequired: deliveryMethod === "delivery",
    isPosOrder: false,
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
    payload = sanitizePublicCheckoutQuotePayload(parsed.body);
  } catch (error) {
    return json(event, error?.statusCode || 400, { error: error?.message || "Invalid quote request." });
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
      scope: `public-checkout-quote:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(
        event,
        429,
        { error: "Too many quote attempts. Try again later." },
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const quotedAt = new Date();
    const quote = await quoteShopOrder(client, {
      organizationId,
      payload,
      at: quotedAt,
    });
    return json(event, 200, {
      ...buildPublicCheckoutQuote({
        organizationId,
        quote,
        expectedItems: payload.items,
      }),
      quotedAt: quotedAt.toISOString(),
    });
  } catch (error) {
    console.error("Public checkout quote failed:", error?.message || error);
    return json(event, error?.statusCode || 500, {
      error: error?.statusCode ? error.message : "Unable to verify current shop prices.",
      ...(error?.code ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}

