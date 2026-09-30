// Filename: bookingAvailability.js
// GET /api/bookingAvailability?productId=X&variantId=Y&eventDate=2024-03-15&eventEndDate=2024-03-16
// Returns availability for a rental item over an inclusive date range.
// Intentionally public: storefront rental availability for the configured public organization only.

import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { createLogger } from "./_shared/logger.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import { validateBookingDateRange } from "../modules/bookings/bookingPolicy.js";

const METHODS = "GET,OPTIONS";
const logger = createLogger("booking-availability");

const json = (event, statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, { methods: METHODS }),
  },
  body: statusCode === 204 ? "" : JSON.stringify(payload),
});

const parsePositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") return json(event, 204, "");
  if (event.httpMethod !== "GET") return json(event, 405, { error: "Method not allowed." });

  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const params = event.queryStringParameters || {};
  const productId = parsePositiveInt(params.productId);
  const variantId = parsePositiveInt(params.variantId);
  const eventDate = parseDate(params.eventDate);
  const eventEndDate = parseDate(params.eventEndDate || params.eventDate);

  if (!productId) return json(event, 400, { error: "productId is required." });
  if (!eventDate) return json(event, 400, { error: "eventDate is required (YYYY-MM-DD)." });
  const dateRange = validateBookingDateRange(params.eventDate, params.eventEndDate || params.eventDate);
  if (!dateRange.valid) {
    return json(event, 400, {
      error: dateRange.code === "INVALID_BOOKING_DATE_RANGE"
        ? "eventEndDate cannot be before eventDate."
        : "A valid event date range is required.",
      code: dateRange.code,
    });
  }

  const requestLogger = logger.child({
    requestId: getEventHeader(event, "x-request-id") || undefined,
  });
  const client = createDatabaseClient({ component: "booking-availability-database" });

  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);

    const productRes = await client.query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.stock,
         p."sourceCategoryCode",
         p."isActive",
         p."isDeleted",
         p."isArchived",
         EXISTS (
           SELECT 1
           FROM "maintenanceLog" ml
           WHERE ml."productId" = p.id
             AND ml."organizationId" = p."organizationId"
             AND ml."resolvedAt" IS NULL
             AND LOWER(COALESCE(ml.status, 'open')) NOT IN (
               'closed', 'resolved', 'complete', 'completed', 'cancelled', 'canceled'
             )
         ) AS "hasOpenMaintenance"
       FROM "product" p
       WHERE p.id = $1 AND p."organizationId" = $2`,
      [productId, organizationId]
    );
    if (productRes.rowCount === 0) {
      return json(event, 404, { error: "Product not found." });
    }
    const product = productRes.rows[0];

    if (
      product.isDeleted ||
      product.isArchived ||
      product.isActive === false
    ) {
      return json(event, 200, {
        productId,
        variantId: variantId || null,
        eventDate: eventDate.toISOString().slice(0, 10),
        eventEndDate: eventEndDate.toISOString().slice(0, 10),
        available: false,
        totalUnits: 0,
        reservedUnits: 0,
        availableUnits: 0,
        reason: "Item is unavailable.",
      });
    }

    const sourceCode = String(product.sourceCategoryCode || "").trim().toUpperCase();
    const sku = String(product.sku || "").trim().toUpperCase();
    const isRental = sourceCode === "RENTAL" || sku.startsWith("RENT") || sku.startsWith("REN-");

    if (isRental && product.hasOpenMaintenance) {
      return json(event, 200, {
        productId,
        variantId: variantId || null,
        eventDate: eventDate.toISOString().slice(0, 10),
        eventEndDate: eventEndDate.toISOString().slice(0, 10),
        available: false,
        totalUnits: 0,
        reservedUnits: 0,
        availableUnits: 0,
        isRental,
        reason: "Item is in maintenance.",
      });
    }

    if (variantId) {
      const variantRes = await client.query(
        `SELECT id, "stockQty", status FROM "inventoryVariant"
         WHERE id = $1 AND "inventoryItemId" = $2 AND "organizationId" = $3`,
        [variantId, productId, organizationId]
      );
      if (variantRes.rowCount === 0) {
        return json(event, 404, { error: "Variant not found for that product." });
      }
      const variant = variantRes.rows[0];
      const totalUnits = isRental
        ? Math.max(Number(variant.stockQty || 0), 1)
        : Number(variant.stockQty || 0);

      const reservedRes = await client.query(
        `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
         FROM "bookingItem" bi
         JOIN "booking" b ON b.id = bi."bookingId"
         WHERE bi."variantId" = $1
           AND bi."organizationId" = $2
           AND LOWER(b.status) IN ('pending', 'confirmed')
           AND b."eventDate"::date <= $4::date
           AND b."eventEndDate"::date >= $3::date`,
        [variantId, organizationId, eventDate, eventEndDate]
      );
      const reservedUnits = Number(reservedRes.rows[0]?.reserved || 0);
      const availableUnits = Math.max(totalUnits - reservedUnits, 0);

      return json(event, 200, {
        productId,
        variantId,
        eventDate: eventDate.toISOString().slice(0, 10),
        eventEndDate: eventEndDate.toISOString().slice(0, 10),
        available: availableUnits > 0 && String(variant.status || "active").toLowerCase() === "active",
        totalUnits,
        reservedUnits,
        availableUnits,
        isRental,
      });
    }

    const totalUnits = isRental
      ? Math.max(Number(product.stock || 0), 1)
      : Number(product.stock || 0);

    const reservedRes = await client.query(
      `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
       FROM "bookingItem" bi
       JOIN "booking" b ON b.id = bi."bookingId"
       WHERE bi."productId" = $1
         AND bi."variantId" IS NULL
         AND bi."organizationId" = $2
         AND LOWER(b.status) IN ('pending', 'confirmed')
         AND b."eventDate"::date <= $4::date
         AND b."eventEndDate"::date >= $3::date`,
      [productId, organizationId, eventDate, eventEndDate]
    );
    const reservedUnits = Number(reservedRes.rows[0]?.reserved || 0);
    const availableUnits = Math.max(totalUnits - reservedUnits, 0);

    return json(event, 200, {
      productId,
      variantId: null,
      eventDate: eventDate.toISOString().slice(0, 10),
      eventEndDate: eventEndDate.toISOString().slice(0, 10),
      available: availableUnits > 0,
      totalUnits,
      reservedUnits,
      availableUnits,
      isRental,
    });
  } catch (err) {
    requestLogger.error({
      err,
      eventName: "booking.availability.failed",
    }, "Booking availability request failed");
    return json(event, 500, { error: "Failed to check availability." });
  } finally {
    await client.end().catch(() => {});
  }
}
