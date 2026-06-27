/* eslint-disable no-undef */
// Filename: bookings.js
// Booking API for admin bookings page (Booking + BookingItem)

import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  ensureAuditColumns,
  resolveActor,
  backfillAuditDefaults,
  normalizeActor,
} from "./auditHelpers.js";
import { notifyManager } from "./_shared/managerPush.js";
import { sendManagerWhatsApp } from "./_shared/whatsapp.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import { requireInternalUser } from "./_shared/internalApi.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";
import { sanitizePaymentPreference } from "./_shared/paymentInstructions.js";
import { ensureInventoryVariantSchema, formatVariantLabel } from "./_shared/inventoryExtensions.js";
import { calculateAttendantChargeCents } from "./_shared/bookingCharges.js";
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
  buildCustomerBookingEmailHtml,
  buildCustomerBookingEmailText,
  buildInternalBookingEmailHtml,
  buildInternalBookingEmailText,
} from "./_shared/transactionEmailTemplates.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";

const BOOKING_METHODS = "GET,POST,PUT,OPTIONS";
const MAX_BOOKING_ITEMS = 100;
const ALLOWED_BOOKING_STATUSES = new Set(["pending", "confirmed", "completed", "cancelled"]);

const formatAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0.00";
  return (parsed / 100).toFixed(2);
};

const buildBookingNotification = (booking) => {
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const itemsCount = Array.isArray(booking?.items) ? booking.items.length : 0;
  const itemLabel = itemsCount === 1 ? "item" : "items";
  const dateLabel = booking?.eventDate || "Date TBD";

  const bodyParts = [
    booking?.customerName || "New customer",
    `GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `${itemsCount} ${itemLabel}`,
    `${dateLabel}${start}${end}`,
  ];

  if (booking?.venueAddress) {
    bodyParts.push(booking.venueAddress);
  }

  return {
    title: `New booking #${booking?.id || ""}`.trim(),
    body: bodyParts.filter(Boolean).join(" · "),
    data: {
      type: "booking",
      id: booking?.id,
    },
  };
};

const buildBookingWhatsAppLines = (booking) => {
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const items = Array.isArray(booking?.items) ? booking.items : [];
  const itemLines = items
    .map((item) => {
      const name = item?.productName || (item?.productId ? `Item ${item.productId}` : "");
      const qty = Number.isFinite(Number(item?.quantity)) ? ` x${item.quantity}` : "";
      return name ? `${name}${qty}` : "";
    })
    .filter(Boolean);

  const lines = [
    `New booking #${booking?.id || ""}`.trim(),
    `Customer: ${booking?.customerName || "Unknown"}`,
    `Total: GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `Event date: ${booking?.eventDate || "Date TBD"}${start}${end}`,
  ];

  if (booking?.venueAddress) {
    lines.push(`Venue: ${booking.venueAddress}`);
  }
  if (itemLines.length) {
    lines.push(`Items: ${items.length}`);
    lines.push(...itemLines.slice(0, 6));
    if (itemLines.length > 6) {
      lines.push(`+${itemLines.length - 6} more`);
    }
  }
  return lines;
};

const BUNDLE_MIN_ITEMS = 3;
const BUNDLE_DISCOUNT_RATE = 0.1;

const json = (event, statusCode, body, options = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, {
      methods: BOOKING_METHODS,
      ...options,
    }),
  },
  body: JSON.stringify(body),
});

const getHeaderValue = (event, key) => {
  const headers = event?.headers;
  if (!headers || typeof headers !== "object") return "";
  return String(
    headers[key]
      || headers[key.toLowerCase()]
      || headers[key.toUpperCase()]
      || ""
  ).trim();
};

const cleanText = (value, maxLength = 240) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizeBookingStatusValue = (value, fallback = "pending") => {
  const normalized = cleanText(value, 32).toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "canceled") return "cancelled";
  return ALLOWED_BOOKING_STATUSES.has(normalized) ? normalized : fallback;
};

const normalizeTimeValue = (value) => {
  const cleaned = cleanText(value, 32);
  return cleaned || null;
};

const compactSelectColumns = `
  SELECT
    b.id,
    b."customerId",
    c.name AS "customerName",
    c.email AS "customerEmail",
    c.phone AS "customerPhone",
    b."eventDate",
    b."startTime",
    b."endTime",
    b."venueAddress",
    b."totalAmount",
    b.status,
    b."createdAt",
    b."lastModifiedAt",
    b."updatedAt"
  FROM "booking" b
  JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
`;

const fullSelectColumns = `
  SELECT
    b.id,
    b."customerId",
    c.name AS "customerName",
    c.email AS "customerEmail",
    c.phone AS "customerPhone",
    b."eventDate",
    b."startTime",
    b."endTime",
    b."venueAddress",
    b."totalAmount",
    b.status,
    b."createdAt",
    b."lastModifiedAt",
    b."updatedAt",
    b."assignedUserId",
    b."createdByUserId",
    b."updatedByUserId",
    assignee."fullName" AS "assignedUserName",
    updater."fullName" AS "updatedByName",
    creator."fullName" AS "createdByName",
    COALESCE(
      json_agg(
        json_build_object(
          'id', bi.id,
          'productId', bi."productId",
          'variantId', bi."variantId",
          'quantity', bi.quantity,
          'price', bi.price,
          'productName', p.name,
          'sku', p.sku,
          'attendantsNeeded', p."attendantsNeeded",
          'variantLabel', CONCAT_WS(' / ', p.name, v."variantName", v."variantNumber", v.color, v.size),
          'productImage', p."imageUrl"
        )
        ORDER BY bi.id
      ) FILTER (WHERE bi.id IS NOT NULL),
      '[]'::json
    ) AS items
  FROM "booking" b
  JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
  LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId"
  LEFT JOIN "user" updater ON updater.id = b."updatedByUserId"
  LEFT JOIN "user" creator ON creator.id = b."createdByUserId"
  LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id AND bi."organizationId" = b."organizationId"
  LEFT JOIN "product" p ON p.id = bi."productId" AND p."organizationId" = b."organizationId"
  LEFT JOIN "inventoryVariant" v ON v.id = bi."variantId" AND v."organizationId" = b."organizationId"
`;

const selectBookings = async (client, organizationId, { compact = false } = {}) => {
  if (compact) {
    const result = await client.query(
      `${compactSelectColumns}
       WHERE b."organizationId" = $1
       ORDER BY b."eventDate" DESC, b.id DESC`,
      [organizationId]
    );
    return result.rows || [];
  }

  const result = await client.query(
    `${fullSelectColumns}
     WHERE b."organizationId" = $1
     GROUP BY b.id, c.id, assignee.id, updater.id, creator.id
     ORDER BY b."eventDate" DESC, b.id DESC`,
    [organizationId]
  );
  return result.rows || [];
};

const selectBookingById = async (client, organizationId, bookingId) => {
  const result = await client.query(
    `${fullSelectColumns}
     WHERE b.id = $1
       AND b."organizationId" = $2
     GROUP BY b.id, c.id, assignee.id, updater.id, creator.id
     LIMIT 1`,
    [bookingId, organizationId]
  );
  return result.rows[0] || null;
};

const ensureBookingSequence = async (client) => {
  try {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('booking','id'),
        COALESCE((SELECT MAX(id) FROM "booking"), 0) + 1,
        false)`
    );
  } catch (err) {
    console.warn("Booking sequence sync failed:", err?.message || err);
  }
};

const ensureValidUserId = async (client, userId, organizationId = null) => {
  const parsedId = Number(userId);
  if (!Number.isFinite(parsedId)) return null;
  const hasOrg = Number.isFinite(Number(organizationId));
  const res = await client.query(
    `SELECT id FROM "user" WHERE id = $1${hasOrg ? ` AND "organizationId" = $2` : ""}`,
    hasOrg ? [parsedId, organizationId] : [parsedId]
  );
  return res.rowCount > 0 ? parsedId : null;
};

const pickAutoAssignee = async (client, organizationId) => {
  try {
    const result = await client.query(
      `SELECT
         u.id,
         COALESCE(o.open_orders, 0) + COALESCE(b.open_bookings, 0) AS load
       FROM "user" u
       LEFT JOIN (
         SELECT "assignedUserId" AS user_id, COUNT(*) AS open_orders
         FROM "order"
         WHERE "organizationId" = $1
           AND LOWER(status) NOT IN ('completed', 'delivered', 'cancelled', 'canceled')
         GROUP BY "assignedUserId"
       ) o ON o.user_id = u.id
       LEFT JOIN (
         SELECT "assignedUserId" AS user_id, COUNT(*) AS open_bookings
         FROM "booking"
         WHERE "organizationId" = $1
           AND LOWER(status) NOT IN ('completed', 'cancelled', 'canceled')
         GROUP BY "assignedUserId"
       ) b ON b.user_id = u.id
       WHERE u."organizationId" = $1
         AND LOWER(u.role) IN ('admin', 'manager', 'staff')
       ORDER BY load ASC, u."updatedAt" DESC
       LIMIT 1`,
      [organizationId]
    );
    return result.rows?.[0]?.id || null;
  } catch (err) {
    console.warn("Auto-assign lookup failed:", err?.message || err);
    return null;
  }
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildResponseHeaders(event, {
        methods: BOOKING_METHODS,
        allowHeaders: "Content-Type, Authorization, X-Organization-Id",
      }),
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    let authUser = await requireUser(client, event);
    let data = null;
    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      const contentType = getHeaderValue(event, "content-type").toLowerCase();
      if (contentType && !contentType.includes("application/json")) {
        return json(event, 415, { error: "Content-Type must be application/json." });
      }
      try {
        data = JSON.parse(event.body || "{}");
      } catch {
        return json(event, 400, { error: "Invalid JSON body." });
      }
    }
    if (!authUser && event.httpMethod !== "POST") {
      return json(event, 401, { error: "Unauthorized" });
    }
    if (!authUser && event.httpMethod === "POST") {
      const requestOrigin = getHeaderValue(event, "origin");
      if (requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
        return json(event, 403, { error: "Untrusted booking origin." });
      }
      if (isCrossSiteBrowserRequest(event) && requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
        return json(event, 403, { error: "Cross-site bookings are not allowed." });
      }
    }
    let organizationId;
    if (authUser) {
      const internal = await requireInternalUser(client, event, {
        methods: BOOKING_METHODS,
        body: data,
      });
      if (internal.errorResponse) {
        return internal.errorResponse;
      }
      authUser = internal.authUser;
      organizationId = internal.organizationId;
    } else {
      organizationId = await resolveConfiguredPublicOrganizationId(client);
      await applyRequestOrganizationContext(client, organizationId);
    }
    if (!authUser && event.httpMethod === "POST") {
      const publicRateLimit = await applyWindowRateLimit(client, {
        scope: `public-bookings:${organizationId}:ip`,
        identifier: getRequestClientIp(event),
        limit: 12,
        windowMs: 15 * 60 * 1000,
      });
      if (!publicRateLimit.allowed) {
        return json(event, 429, { error: "Too many booking attempts. Try again later." });
      }
    }
    await ensureAuditColumns(client);
    await ensureInventoryVariantSchema(client);
    const defaultActor = authUser
      ? { userId: authUser.id, userName: authUser.fullName, userEmail: authUser.email }
      : await resolveActor(client, normalizeActor({}), organizationId);
    if (defaultActor.userId) {
      await backfillAuditDefaults(client, defaultActor.userId, organizationId);
    }

    if (event.httpMethod === "GET") {
      const bookingId = Number(event.queryStringParameters?.id);
      const compact = String(event.queryStringParameters?.compact || "").trim() === "1";
      if (Number.isFinite(bookingId) && bookingId > 0) {
        const booking = await selectBookingById(client, organizationId, bookingId);
        if (!booking) {
          return json(event, 404, { error: "Booking not found." });
        }
        return json(event, 200, booking);
      }
      const results = await selectBookings(client, organizationId, { compact });
      return json(event, 200, results);
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT") {
      return json(event, 405, { error: "Method Not Allowed" });
    }

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const hasItemsPayload = Array.isArray(data.items);
    const requestedCustomerId = Number(data.customerId);
    const requestedEventDate = parseDate(data.eventDate);
    const requestedStartTime = Object.prototype.hasOwnProperty.call(data, "startTime")
      ? normalizeTimeValue(data.startTime)
      : undefined;
    const requestedEndTime = Object.prototype.hasOwnProperty.call(data, "endTime")
      ? normalizeTimeValue(data.endTime)
      : undefined;
    const requestedVenueAddress = Object.prototype.hasOwnProperty.call(data, "venueAddress")
      ? cleanText(data.venueAddress, 240)
      : undefined;
    const requestedStatus = Object.prototype.hasOwnProperty.call(data, "status")
      ? normalizeBookingStatusValue(data.status)
      : undefined;
    const assignedUserIdRaw = data.assignedUserId;
    const hasAssignedUser = Object.prototype.hasOwnProperty.call(data, "assignedUserId");
    const items = Array.isArray(data.items) ? data.items : [];
    const paymentPreference = sanitizePaymentPreference(data.paymentPreference);
    let discountValue = 0;
    const applyBundleDiscount = data.applyBundleDiscount === true;

    const normalizedItems = items
      .slice(0, MAX_BOOKING_ITEMS)
      .map((item) => ({
        productId: Number(item.productId),
        variantId: Number.isFinite(Number(item.variantId)) && Number(item.variantId) > 0
          ? Number(item.variantId)
          : null,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      }))
      .filter((item) => Number.isFinite(item.productId));
    let bookingId = null;
    let existingBooking = null;

    if (event.httpMethod === "PUT") {
      bookingId = Number(data.id);
      if (!Number.isFinite(bookingId)) {
        return json(event, 400, { error: "id is required for update." });
      }
      existingBooking = await selectBookingById(client, organizationId, bookingId);
      if (!existingBooking) {
        return json(event, 404, { error: "Booking not found." });
      }
      if (normalizeBookingStatusValue(existingBooking.status, "pending") === "completed") {
        return json(event, 409, { error: "Completed bookings are locked and can't be edited." });
      }
    }

    const customerId = Number.isFinite(requestedCustomerId) ? requestedCustomerId : Number(existingBooking?.customerId);
    const eventDate = requestedEventDate || parseDate(existingBooking?.eventDate);
    const startTime =
      requestedStartTime !== undefined ? requestedStartTime : normalizeTimeValue(existingBooking?.startTime);
    const endTime =
      requestedEndTime !== undefined ? requestedEndTime : normalizeTimeValue(existingBooking?.endTime);
    const venueAddress =
      requestedVenueAddress !== undefined ? requestedVenueAddress : cleanText(existingBooking?.venueAddress, 240);
    const status = requestedStatus || normalizeBookingStatusValue(existingBooking?.status, "pending");
    const mergedItems = hasItemsPayload
      ? normalizedItems
      : (Array.isArray(existingBooking?.items) ? existingBooking.items : []).map((item) => ({
          productId: Number(item.productId),
          variantId: Number.isFinite(Number(item.variantId)) && Number(item.variantId) > 0
            ? Number(item.variantId)
            : null,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        }));

    if (!Number.isFinite(customerId)) return json(event, 400, { error: "customerId is required." });
    if (!eventDate) return json(event, 400, { error: "eventDate is required." });
    if (eventDate < new Date()) {
      // Allow same-day bookings; only block dates strictly in the past.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (eventDate < todayStart) {
        return json(event, 400, { error: "eventDate cannot be in the past." });
      }
    }
    if (!venueAddress) return json(event, 400, { error: "venueAddress is required." });
    if (mergedItems.length === 0) {
      return json(event, 400, { error: "At least one booking item is required." });
    }

    // Validate that endTime is after startTime when both are provided.
    if (startTime && endTime) {
      const parseTime = (value) => {
        const m = String(value || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (!m) return null;
        let hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const period = (m[3] || "").toUpperCase();
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      const startMinutes = parseTime(startTime);
      const endMinutes = parseTime(endTime);
      if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
        return json(event, 400, { error: "endTime must be after startTime." });
      }
    }

    let bundleEligible = mergedItems.length >= BUNDLE_MIN_ITEMS;

    const actor = authUser
      ? { userId: authUser.id, userName: authUser.fullName, userEmail: authUser.email }
      : await resolveActor(client, normalizeActor(data), organizationId);
    const actorUserId = await ensureValidUserId(client, actor.userId, organizationId);
    const assignedUserIdValue = hasAssignedUser
      ? assignedUserIdRaw === null
        ? null
        : await ensureValidUserId(client, assignedUserIdRaw, organizationId)
      : null;
    const autoAssignedUserId = hasAssignedUser
      ? assignedUserIdValue
      : actorUserId || await pickAutoAssignee(client, organizationId);

    await client.query("BEGIN");

    try {
      const customerCheck = await client.query(
        `SELECT id FROM "customer" WHERE id = $1 AND "organizationId" = $2`,
        [customerId, organizationId]
      );
      if (customerCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return json(event, 404, { error: "Customer not found." });
      }

      const productIds = [...new Set(mergedItems.map((item) => item.productId))];
      const productRes = await client.query(
        `SELECT id, name, price, stock, sku, "sourceCategoryCode", "itemType", "attendantsNeeded", "isActive", "isDeleted", "isArchived"
         FROM "product"
         WHERE id = ANY($1::int[]) AND "organizationId" = $2`,
        [productIds, organizationId]
      );
      const productMap = new Map(productRes.rows.map((row) => [row.id, row]));
      const variantIds = [
        ...new Set(
          mergedItems
            .map((item) => Number(item.variantId))
            .filter((value) => Number.isFinite(value) && value > 0)
        ),
      ];
      const variantMap = new Map();
      if (variantIds.length) {
        const variantRes = await client.query(
          `SELECT
             id,
             "inventoryItemId",
             sku,
             "variantNumber",
             color,
             size,
             "stockQty",
             "reservedQty",
             "priceOverride",
             status
           FROM "inventoryVariant"
           WHERE id = ANY($1::int[])
             AND "organizationId" = $2
           FOR UPDATE`,
          [variantIds, organizationId]
        );
        variantRes.rows.forEach((row) => variantMap.set(Number(row.id), row));
        if (variantMap.size !== variantIds.length) {
          await client.query("ROLLBACK");
          return json(event, 404, { error: "One or more variants were not found." });
        }
      }

      for (const item of mergedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          await client.query("ROLLBACK");
          return json(event, 404, { error: `Product ${item.productId} not found.` });
        }
        if (product.isDeleted || product.isArchived || product.isActive === false) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `${product.name || `Item ${item.productId}`} is unavailable.` });
        }
        const sku = typeof product.sku === "string" ? product.sku.trim().toUpperCase() : "";
        const source = typeof product.sourceCategoryCode === "string"
          ? product.sourceCategoryCode.trim().toUpperCase()
          : "";
        if (source !== "RENTAL" && !sku.startsWith("RENT") && !sku.startsWith("PUM")) {
          await client.query("ROLLBACK");
          return json(event, 400, { error: `Bookings can only include rental items. Item ${item.productId} is not a rental.` });
        }
        if (String(product.itemType || "STANDARD").toUpperCase() === "VARIANT_PARENT" && !item.variantId) {
          await client.query("ROLLBACK");
          return json(event, 400, { error: `Choose a specific variant for ${product.name || `item ${item.productId}`}.` });
        }
      }

      const pricedItems = mergedItems.filter((item) => {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
        const variantPriceCents = Number(variant?.priceOverride);
        const priceCents = Number.isFinite(variantPriceCents) && variantPriceCents >= 0
          ? variantPriceCents
          : product?.price || 0;
        return priceCents > 0;
      });
      bundleEligible = pricedItems.length >= BUNDLE_MIN_ITEMS;

      if (applyBundleDiscount) {
        if (bundleEligible) {
          const bundleSubtotalCents = pricedItems.reduce((sum, item) => {
            const product = productMap.get(item.productId);
            const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
            const variantPriceCents = Number(variant?.priceOverride);
            const priceCents = Number.isFinite(variantPriceCents) && variantPriceCents >= 0
              ? variantPriceCents
              : product.price;
            return sum + priceCents * item.quantity;
          }, 0);
          discountValue = bundleSubtotalCents > 0
            ? Math.round(bundleSubtotalCents * BUNDLE_DISCOUNT_RATE) / 100
            : 0;
        } else {
          discountValue = 0;
        }
      }

      const motorsRes = await client.query(
        `SELECT "productId", COALESCE("motorsToPump", 0) AS motors
         FROM "bouncy_castles"
         WHERE "productId" = ANY($1::int[]) AND "organizationId" = $2`,
        [productIds, organizationId]
      );
      const motorsMap = new Map(
        motorsRes.rows.map((row) => [Number(row.productId), Number(row.motors) || 0])
      );

      let finalItems = [...mergedItems];
      const pumpQuantity = mergedItems.reduce((sum, item) => {
        const motors = motorsMap.get(item.productId) || 0;
        return sum + motors * item.quantity;
      }, 0);

      if (pumpQuantity > 0) {
        const pumpRes = await client.query(
          `SELECT id, name, price, stock, sku, "sourceCategoryCode", "itemType", "attendantsNeeded", "isActive", "isDeleted", "isArchived"
           FROM "product"
           WHERE (LOWER(name) LIKE '%motor pump%' OR UPPER(sku) LIKE 'PUM-%')
             AND "organizationId" = $1
           ORDER BY id
           LIMIT 1`,
          [organizationId]
        );
        const pumpProduct = pumpRes.rows[0];
        if (!pumpProduct) {
          await client.query("ROLLBACK");
          return json(event, 500, { error: "Motor Pump product is missing. Import motor pumps first." });
        }
        const pumpSku = typeof pumpProduct.sku === "string" ? pumpProduct.sku.trim().toUpperCase() : "";
        const pumpSource = typeof pumpProduct.sourceCategoryCode === "string"
          ? pumpProduct.sourceCategoryCode.trim().toUpperCase()
          : "";
        if (pumpProduct.isDeleted || pumpProduct.isArchived || pumpProduct.isActive === false) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: "Motor Pump product is unavailable." });
        }
        if (pumpSource !== "RENTAL" && !pumpSku.startsWith("RENT") && !pumpSku.startsWith("PUM")) {
          await client.query("ROLLBACK");
          return json(event, 500, { error: "Motor Pump product is not marked as a rental." });
        }
        productMap.set(pumpProduct.id, pumpProduct);
        const existingPump = finalItems.find((item) => item.productId === pumpProduct.id);
        if (existingPump) {
          existingPump.quantity = pumpQuantity;
        } else {
          finalItems.push({ productId: pumpProduct.id, quantity: pumpQuantity });
        }
      }

      const finalProductIds = [...new Set(finalItems.map((item) => Number(item.productId)).filter(Number.isFinite))];
      const maintenanceRes = await client.query(
        `SELECT "productId"
         FROM "maintenanceLog"
         WHERE "productId" = ANY($1::int[])
           AND "organizationId" = $2
           AND "resolvedAt" IS NULL
           AND LOWER(COALESCE(status, 'open')) NOT IN ('closed', 'resolved', 'complete', 'completed', 'cancelled', 'canceled')`,
        [finalProductIds, organizationId]
      );
      const productsInMaintenance = new Set(maintenanceRes.rows.map((row) => Number(row.productId)));

      const shouldReserveVariants = !["completed", "cancelled"].includes(status);
      const releaseExistingReservations = event.httpMethod === "PUT"
        && existingBooking
        && !["completed", "cancelled"].includes(normalizeBookingStatusValue(existingBooking.status, "pending"));
      if (releaseExistingReservations) {
        const existingVariantItems = await client.query(
          `SELECT "variantId", quantity
           FROM "bookingItem"
           WHERE "bookingId" = $1
             AND "organizationId" = $2
             AND "variantId" IS NOT NULL
           FOR UPDATE`,
          [bookingId, organizationId]
        );
        for (const row of existingVariantItems.rows) {
          await client.query(
            `UPDATE "inventoryVariant"
             SET "reservedQty" = GREATEST("reservedQty" - $1, 0),
                 "updatedAt" = NOW()
             WHERE id = $2 AND "organizationId" = $3`,
            [row.quantity, row.variantId, organizationId]
          );
        }
      }

      for (const item of finalItems) {
        const product = productMap.get(item.productId);
        if (productsInMaintenance.has(Number(item.productId))) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `${product?.name || `Item ${item.productId}`} is currently in maintenance.` });
        }

        if (item.variantId) {
          const variant = variantMap.get(Number(item.variantId));
          if (!variant || Number(variant.inventoryItemId) !== Number(item.productId)) {
            await client.query("ROLLBACK");
            return json(event, 409, { error: `Variant ${item.variantId} does not belong to product ${item.productId}.` });
          }
          if (String(variant.status || "active").toLowerCase() !== "active") {
            await client.query("ROLLBACK");
            return json(event, 409, { error: `Variant ${item.variantId} is unavailable.` });
          }
          if (shouldReserveVariants) {
            // Date-specific check: count units already booked for this exact event date,
            // excluding the current booking being edited (if PUT).
            const dateReservedRes = await client.query(
              `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
               FROM "bookingItem" bi
               JOIN "booking" b ON b.id = bi."bookingId"
               WHERE bi."variantId" = $1
                 AND bi."organizationId" = $2
                 AND LOWER(b.status) IN ('pending', 'confirmed')
                 AND b."eventDate"::date = $3::date
                 ${bookingId ? `AND b.id != ${Number(bookingId)}` : ""}`,
              [item.variantId, organizationId, eventDate]
            );
            const reservedOnDate = Number(dateReservedRes.rows[0]?.reserved || 0);
            const totalUnits = Math.max(Number(variant.stockQty || 0), Number(item.quantity) || 1);
            const availableOnDate = Math.max(totalUnits - reservedOnDate, 0);
            if (availableOnDate < item.quantity) {
              await client.query("ROLLBACK");
              return json(event, 409, { error: `Insufficient availability on this date for ${formatVariantLabel(product?.name, variant)}.` });
            }
          }
        } else {
          // Non-variant rental item: check date-specific reservations at product level.
          if (shouldReserveVariants) {
            // Acquire an advisory lock keyed on (productId, eventDate) so concurrent
            // requests for the same item on the same date serialize here. Variant items
            // are already serialized by the FOR UPDATE lock on inventoryVariant above.
            await client.query(
              `SELECT pg_advisory_xact_lock(hashtext($1))`,
              [`booking_avail:${item.productId}:${eventDate.toISOString().slice(0, 10)}`]
            );
            const productDateRes = await client.query(
              `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
               FROM "bookingItem" bi
               JOIN "booking" b ON b.id = bi."bookingId"
               WHERE bi."productId" = $1
                 AND bi."variantId" IS NULL
                 AND bi."organizationId" = $2
                 AND LOWER(b.status) IN ('pending', 'confirmed')
                 AND b."eventDate"::date = $3::date
                 ${bookingId ? `AND b.id != ${Number(bookingId)}` : ""}`,
              [item.productId, organizationId, eventDate]
            );
            const reservedOnDate = Number(productDateRes.rows[0]?.reserved || 0);
            const totalUnits = Math.max(Number(product?.stock ?? 0), Number(item.quantity) || 1);
            const availableOnDate = Math.max(totalUnits - reservedOnDate, 0);
            if (availableOnDate < item.quantity) {
              await client.query("ROLLBACK");
              return json(event, 409, { error: `Insufficient availability on this date for "${product?.name || `item ${item.productId}`}".` });
            }
          }
        }
      }

      const attendantCharge = calculateAttendantChargeCents(
        finalItems.map((item) => ({
          ...item,
          attendantsNeeded: productMap.get(item.productId)?.attendantsNeeded,
        }))
      );

      const totalAmount = Math.max(
        0,
        finalItems.reduce((sum, item) => {
          const product = productMap.get(item.productId);
          const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
          const variantPrice = Number(variant?.priceOverride);
          const priceCents = Number.isFinite(variantPrice) && variantPrice >= 0
              ? variantPrice
              : product.price;
          return sum + priceCents * item.quantity;
        }, 0) - Math.round(discountValue * 100) + attendantCharge.totalCents
      );

      if (event.httpMethod === "POST") {
        await ensureBookingSequence(client);
        const bookingRes = await client.query(
          `INSERT INTO "booking" (
             "organizationId",
             "customerId",
             "eventDate",
             "startTime",
             "endTime",
             "venueAddress",
             "totalAmount",
             "status",
             "createdAt",
             "updatedAt",
             "lastModifiedAt",
             "createdByUserId",
             "updatedByUserId",
             "assignedUserId"
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW(),NOW(),$9,$9,$10)
           RETURNING id`,
          [
            organizationId,
            customerId,
            eventDate,
            startTime || null,
            endTime || null,
            venueAddress,
            totalAmount,
            status,
            actorUserId,
            autoAssignedUserId,
          ]
        );
        bookingId = bookingRes.rows[0].id;
      } else {
        await client.query(
          `UPDATE "booking"
           SET "customerId" = $1,
               "eventDate" = $2,
               "startTime" = $3,
               "endTime" = $4,
               "venueAddress" = $5,
               "totalAmount" = $6,
               "status" = $7,
               "updatedAt" = NOW(),
               "lastModifiedAt" = NOW(),
               "updatedByUserId" = $9,
               "assignedUserId" = CASE WHEN $10 THEN $11 ELSE "assignedUserId" END
           WHERE id = $8 AND "organizationId" = $12`,
          [
            customerId,
            eventDate,
            startTime || null,
            endTime || null,
            venueAddress,
            totalAmount,
            status,
            bookingId,
            actorUserId,
            hasAssignedUser,
            assignedUserIdValue,
            organizationId,
          ]
        );

        await client.query(
          `DELETE FROM "bookingItem" WHERE "bookingId" = $1 AND "organizationId" = $2`,
          [bookingId, organizationId]
        );
      }

      for (const item of finalItems) {
        const fallbackPrice = productMap.get(item.productId)?.price;
        const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
        const variantPrice = Number(variant?.priceOverride);
        const price = Number.isFinite(variantPrice) && variantPrice >= 0
            ? variantPrice
            : fallbackPrice;
        await client.query(
          `INSERT INTO "bookingItem" ("organizationId", "bookingId", "productId", "variantId", quantity, price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [organizationId, bookingId, item.productId, item.variantId || null, item.quantity, price]
        );
        if (shouldReserveVariants && item.variantId) {
          // Keep reservedQty counter in sync for display purposes (date check already done above).
          await client.query(
            `UPDATE "inventoryVariant"
             SET "reservedQty" = "reservedQty" + $1,
                 "updatedAt" = NOW()
             WHERE id = $2
               AND "organizationId" = $3`,
            [item.quantity, item.variantId, organizationId]
          );
        }
      }

      await client.query("COMMIT");

      const persistedBooking = await selectBookingById(client, organizationId, bookingId);

      if (event.httpMethod === "POST") {
        try {
          await sendManagerWhatsApp({
            lines: buildBookingWhatsAppLines(persistedBooking),
          });
        } catch (err) {
          console.warn("WhatsApp notify failed:", err?.message || err);
        }
        try {
          await notifyManager(client, buildBookingNotification(persistedBooking), {
            organizationId,
          });
        } catch (err) {
          console.warn("Manager push failed:", err?.message || err);
        }
        const createdBooking = {
          ...persistedBooking,
          paymentPreference,
        };
        const emailResults = await Promise.allSettled(
          [
            sendNotificationEmail({
              to: getNotificationCatchallEmail(),
              subject: `New booking #${createdBooking?.id || ""}`.trim(),
              text: buildInternalBookingEmailText(createdBooking),
              html: buildInternalBookingEmailHtml(createdBooking),
            }),
            createdBooking?.customerEmail
              ? sendNotificationEmail({
                  to: createdBooking.customerEmail,
                  subject: `We received your booking #${createdBooking?.id || ""}`.trim(),
                  text: buildCustomerBookingEmailText(createdBooking, {
                    supportEmail: getNotificationCatchallEmail(),
                  }),
                  html: buildCustomerBookingEmailHtml(createdBooking, {
                    supportEmail: getNotificationCatchallEmail(),
                  }),
                })
              : null,
          ].filter(Boolean)
        );
        emailResults.forEach((result) => {
          if (result.status === "rejected") {
            console.warn("Booking email failed:", result.reason?.message || result.reason);
          }
        });
      }

      await writeAuditLog(client, {
        userId: actorUserId,
        organizationId,
        action: event.httpMethod === "POST" ? "BOOKING_CREATED" : "BOOKING_UPDATED",
        targetType: "booking",
        targetId: String(persistedBooking?.id || bookingId),
        source: authUser ? "api" : "integration",
        category: "booking",
        severity: "info",
        status: "ok",
        summary:
          event.httpMethod === "POST"
            ? `Created booking ${persistedBooking?.id || bookingId}.`
            : `Updated booking ${persistedBooking?.id || bookingId}.`,
        actorLabel: actor.userName || actor.userEmail || "Guest",
        requestId: getEventHeader(event, "x-request-id"),
        ipAddress: getEventIpAddress(event),
        metadata: {
          customerId,
          itemCount: finalItems.length,
          totalAmount,
          status,
        },
      });

      return json(event, event.httpMethod === "POST" ? 201 : 200, persistedBooking);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(event, 500, { error: "Failed to process booking request." });
  } finally {
    await client.end().catch(() => {});
  }
}
