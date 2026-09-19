/* eslint-disable no-undef */
import { createDatabaseClient } from "./_shared/databaseClient.js";
import {
  ensureCrmContactTables,
  upsertCrmCustomerFromContact,
} from "./_shared/crmContact.js";
import {
  buildResponseHeaders,
  isAllowedAppOrigin,
  isCrossSiteBrowserRequest,
  json,
} from "./_shared/http.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import {
  applyWindowRateLimit,
  getRequestClientIp,
} from "./_shared/requestRateLimit.js";
import { createLogger } from "./_shared/logger.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";
import { notifyManager } from "./_shared/managerPush.js";
import { createShopOrder, getHeaderValue, parseJsonBody } from "./_shared/shopOrders.js";
import { normalizeCheckoutQuoteFingerprint } from "./_shared/checkoutQuote.js";
import { normalizeGhanaPhone } from "../modules/customers/contactPolicy.js";
import {
  buildCustomerOrderPlacedText,
  buildInternalOrderPlacedText,
  buildOrderPlacedNotification,
} from "../modules/orders/orderNotifications.js";

const METHODS = "POST,OPTIONS";
const MAX_CHECKOUT_ITEMS = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logger = createLogger("public-orders");

const cleanText = (value, maxLength = 240) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

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

const publicOrderResponse = (order = {}) => ({
  orderNumber: order.orderNumber,
  reference: order.orderNumber,
  status: order.status,
  currency: "GHS",
  subtotalCents: Number(order.subtotalCents || 0),
  discountCents: Number(order.discountCents || 0),
  deliveryFeeCents: Number(order.deliveryFeeCents || 0),
  serviceFeeCents: Number(order.serviceFeeCents || 0),
  grandTotalCents: Number(order.grandTotalCents ?? order.total_amount ?? 0),
  paymentStatus: order.paymentStatus || "unpaid",
  fulfillmentMethod: order.fulfillmentMethod,
  idempotentReplay: Boolean(order.idempotentReplay),
});

const findPublicOrderByKey = async (client, organizationId, idempotencyKey) => {
  const result = await client.query(
    `SELECT "orderNumber", status, "subtotalCents", "discountCents", "deliveryFeeCents",
            "serviceFeeCents", "grandTotalCents", total_amount, "paymentStatus", "fulfillmentMethod"
     FROM "order"
     WHERE "organizationId" = $1
       AND "idempotencyKey" = $2
     LIMIT 1`,
    [organizationId, idempotencyKey]
  );
  return result.rows[0] || null;
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "POST").toUpperCase();
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildResponseHeaders(event, {
        methods: METHODS,
        allowHeaders: "Content-Type, X-Request-Id, Idempotency-Key",
      }),
      body: "",
    };
  }
  if (method !== "POST") return json(event, 405, { error: "Method Not Allowed" }, { methods: METHODS });

  const requestOrigin = getHeaderValue(event, "origin");
  if (
    (requestOrigin && !isAllowedAppOrigin(requestOrigin))
    || (isCrossSiteBrowserRequest(event) && requestOrigin && !isAllowedAppOrigin(requestOrigin))
  ) {
    return json(event, 403, {
      error: "Untrusted checkout origin.",
      code: "UNTRUSTED_CHECKOUT_ORIGIN",
    }, { methods: METHODS });
  }
  const contentType = getHeaderValue(event, "content-type").toLowerCase();
  if (contentType && !contentType.includes("application/json")) {
    return json(event, 415, { error: "Content-Type must be application/json." }, { methods: METHODS });
  }

  const idempotencyKey = cleanText(getHeaderValue(event, "idempotency-key"), 120);
  if (idempotencyKey.length < 8) {
    return json(event, 400, {
      error: "Idempotency-Key is required when creating an order.",
      code: "IDEMPOTENCY_KEY_REQUIRED",
    }, { methods: METHODS });
  }
  const parsed = parseJsonBody(event);
  if (parsed.error) return json(event, 400, { error: parsed.error }, { methods: METHODS });
  const body = parsed.body || {};
  const customerInput = body.customer && typeof body.customer === "object" ? body.customer : {};
  const customer = {
    name: cleanText(customerInput.name, 160),
    email: cleanText(customerInput.email, 240).toLowerCase(),
    phone: normalizeGhanaPhone(customerInput.phone),
  };
  if (!customer.name || (!customer.email && !customer.phone)) {
    return json(event, 400, {
      error: "Customer name and a valid email or phone number are required.",
      code: "ORDER_CUSTOMER_REQUIRED",
    }, { methods: METHODS });
  }
  if (customer.email && !EMAIL_PATTERN.test(customer.email)) {
    return json(event, 400, {
      error: "Enter a valid email address.",
      code: "INVALID_CUSTOMER_EMAIL",
    }, { methods: METHODS });
  }

  const requestId = getHeaderValue(event, "x-request-id") || undefined;
  const requestLogger = logger.child({ requestId });
  const client = createDatabaseClient({ component: "public-orders-database" });
  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);
    const rateLimit = await applyWindowRateLimit(client, {
      scope: `public-orders:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(event, 429, {
        error: "Too many order attempts. Try again later.",
        code: "ORDER_RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }, { methods: METHODS });
    }
    await ensureCrmContactTables(client);

    await client.query("BEGIN");
    try {
      const customerRecord = await upsertCrmCustomerFromContact(client, organizationId, {
        ...customer,
        segmentOverride: "active",
        matchByName: false,
      });
      const payload = sanitizePublicCheckoutPayload({
        ...body,
        customerId: customerRecord.id,
      });
      const result = await createShopOrder(client, {
        organizationId,
        payload,
        actor: { userId: null, userName: "Storefront customer", userEmail: customer.email || null },
        idempotencyKey,
        creationMode: "public_checkout",
      });
      const created = await findPublicOrderByKey(client, organizationId, idempotencyKey);
      await client.query("COMMIT");
      requestLogger.info({
        eventName: "public_order.created",
        organizationId,
        orderNumber: created?.orderNumber || result.orderNumber,
      }, "Public storefront order created");
      if (!result.idempotentReplay) {
        const notificationOrder = {
          ...(created || result),
          customerName: customer.name,
        };
        const supportEmail = getNotificationCatchallEmail();
        const notificationResults = await Promise.allSettled([
          notifyManager(client, buildOrderPlacedNotification(notificationOrder), { organizationId }),
          sendNotificationEmail({
            to: supportEmail,
            subject: `New storefront order ${notificationOrder.orderNumber || ""}`.trim(),
            text: buildInternalOrderPlacedText(notificationOrder),
          }),
          customer.email
            ? sendNotificationEmail({
                to: customer.email,
                subject: `We received your order ${notificationOrder.orderNumber || ""}`.trim(),
                text: buildCustomerOrderPlacedText(notificationOrder, { supportEmail }),
              })
            : Promise.resolve({ skipped: true, reason: "missing_customer_email" }),
        ]);
        notificationResults.forEach((notificationResult) => {
          if (notificationResult.status === "rejected") {
            requestLogger.warn({
              err: notificationResult.reason,
              eventName: "public_order.notification_failed",
            }, "Order notification failed");
          }
        });
      }
      return json(
        event,
        result.idempotentReplay ? 200 : 201,
        publicOrderResponse({ ...(created || result), idempotentReplay: result.idempotentReplay }),
        { methods: METHODS }
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    requestLogger.error({
      err: error,
      eventName: "public_order.failed",
      statusCode,
    }, "Public storefront order failed");
    return json(event, statusCode, {
      error: statusCode >= 500 ? "Failed to create order." : error.message,
      ...(error?.code ? { code: error.code } : {}),
    }, { methods: METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
