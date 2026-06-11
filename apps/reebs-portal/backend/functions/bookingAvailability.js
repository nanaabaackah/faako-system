/* eslint-disable no-undef */
// Filename: bookingAvailability.js
// GET /api/bookingAvailability?productId=X&variantId=Y&eventDate=2024-03-15
// Returns availability for a rental item on a specific date.
// Intentionally public: storefront rental availability for the configured public organization only.

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";

const METHODS = "GET,OPTIONS";

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

  if (!productId) return json(event, 400, { error: "productId is required." });
  if (!eventDate) return json(event, 400, { error: "eventDate is required (YYYY-MM-DD)." });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);

    // Fetch product to confirm it exists and is a rental.
    const productRes = await client.query(
      `SELECT id, name, stock, "sourceCategoryCode", "isActive", "isDeleted", "isArchived"
       FROM "product"
       WHERE id = $1 AND "organizationId" = $2`,
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

    if (variantId) {
      // Variant-level availability.
      const variantRes = await client.query(
        `SELECT id, "stockQty", status FROM "inventoryVariant"
         WHERE id = $1 AND "inventoryItemId" = $2 AND "organizationId" = $3`,
        [variantId, productId, organizationId]
      );
      if (variantRes.rowCount === 0) {
        return json(event, 404, { error: "Variant not found for that product." });
      }
      const variant = variantRes.rows[0];
      const totalUnits = Number(variant.stockQty || 0);

      const reservedRes = await client.query(
        `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
         FROM "bookingItem" bi
         JOIN "booking" b ON b.id = bi."bookingId"
         WHERE bi."variantId" = $1
           AND bi."organizationId" = $2
           AND LOWER(b.status) IN ('pending', 'confirmed')
           AND b."eventDate"::date = $3::date`,
        [variantId, organizationId, eventDate]
      );
      const reservedUnits = Number(reservedRes.rows[0]?.reserved || 0);
      const availableUnits = Math.max(totalUnits - reservedUnits, 0);

      return json(event, 200, {
        productId,
        variantId,
        eventDate: eventDate.toISOString().slice(0, 10),
        available: availableUnits > 0 && String(variant.status || "active").toLowerCase() === "active",
        totalUnits,
        reservedUnits,
        availableUnits,
        isRental,
      });
    }

    // Product-level (non-variant) availability.
    const totalUnits = Number(product.stock || 0);

    const reservedRes = await client.query(
      `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
       FROM "bookingItem" bi
       JOIN "booking" b ON b.id = bi."bookingId"
       WHERE bi."productId" = $1
         AND bi."variantId" IS NULL
         AND bi."organizationId" = $2
         AND LOWER(b.status) IN ('pending', 'confirmed')
         AND b."eventDate"::date = $3::date`,
      [productId, organizationId, eventDate]
    );
    const reservedUnits = Number(reservedRes.rows[0]?.reserved || 0);
    const availableUnits = Math.max(totalUnits - reservedUnits, 0);

    return json(event, 200, {
      productId,
      variantId: null,
      eventDate: eventDate.toISOString().slice(0, 10),
      available: availableUnits > 0,
      totalUnits,
      reservedUnits,
      availableUnits,
      isRental,
    });
  } catch (err) {
    console.error("bookingAvailability error:", err);
    return json(event, 500, { error: "Failed to check availability." });
  } finally {
    await client.end().catch(() => {});
  }
}
