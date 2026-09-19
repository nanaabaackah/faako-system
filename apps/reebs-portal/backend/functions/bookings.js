// Filename: bookings.js
// Booking API for admin bookings page (Booking + BookingItem)

import {
  ensureAuditColumns,
  resolveActor,
  backfillAuditDefaults,
  normalizeActor,
} from "./auditHelpers.js";
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { notifyManager } from "./_shared/managerPush.js";
import { sendManagerWhatsApp } from "./_shared/whatsapp.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import { hasPermission, requirePermission } from "./_shared/internalApi.js";
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
import { createLogger } from "./_shared/logger.js";
import {
  buildBookingReference,
  canTransitionBooking,
  isBookingLocked,
  isBookingReservationActive,
  normalizeBookingStatus,
  normalizeGhanaPhone,
  validateBookingDateRange,
} from "../modules/bookings/bookingPolicy.js";
import { loadBookingCommercialRules } from "../modules/bookings/commercialRules.js";
import {
  findBookingById,
  findLeastLoadedBookingAssignee,
  listBookings,
  resolveOrganizationUserId,
  synchronizeBookingSequence,
} from "../modules/bookings/bookingRepository.js";
import {
  buildBookingNotification,
  buildBookingWhatsAppLines,
} from "../modules/bookings/bookingNotifications.js";

const BOOKING_METHODS = "GET,POST,PUT,OPTIONS";
const MAX_BOOKING_ITEMS = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logger = createLogger("bookings");

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
  return normalizeBookingStatus(cleanText(value, 32), fallback);
};

const errorResponse = (event, statusCode, code, error, details = undefined) =>
  json(event, statusCode, {
    error,
    code,
    ...(details ? { details } : {}),
  });

const getIdempotencyKey = (event) => cleanText(getHeaderValue(event, "idempotency-key"), 120);

const toPublicBookingResponse = (booking) => ({
  reference: booking?.reference || buildBookingReference(booking || {}),
  eventDate: booking?.eventDate,
  eventEndDate: booking?.eventEndDate,
  startTime: booking?.startTime,
  endTime: booking?.endTime,
  venueAddress: booking?.venueAddress,
  venueGhanaPostGps: booking?.venueGhanaPostGps || null,
  currency: booking?.currency || "GHS",
  subtotalCents: Number(booking?.subtotalCents || 0),
  discountCents: Number(booking?.discountCents || 0),
  feeCents: Number(booking?.feeCents || 0),
  taxCents: Number(booking?.taxCents || 0),
  depositRateBps: booking?.depositRateBps ?? null,
  depositRequiredCents: booking?.depositRequiredCents ?? null,
  totalAmount: Number(booking?.totalAmount || 0),
  status: booking?.status || "pending",
  items: (Array.isArray(booking?.items) ? booking.items : []).map((item) => ({
    productId: item.productId,
    variantId: item.variantId || null,
    productName: item.productName,
    variantLabel: item.variantLabel,
    quantity: item.quantity,
    price: item.price,
    lineTotal: item.lineTotal,
    productImage: item.productImage,
  })),
});

const normalizeTimeValue = (value) => {
  const cleaned = cleanText(value, 32);
  return cleaned || null;
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildResponseHeaders(event, {
        methods: BOOKING_METHODS,
        allowHeaders: "Content-Type, Authorization, X-Organization-Id, Idempotency-Key",
      }),
      body: "",
    };
  }

  const requestId = getEventHeader(event, "x-request-id") || undefined;
  const requestLogger = logger.child({ requestId });
  const client = createDatabaseClient({ component: "bookings-database" });

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
      const permission = event.httpMethod === "GET" ? "bookings:read" : "bookings:write";
      const internal = await requirePermission(client, event, permission, {
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
    const idempotencyKey = event.httpMethod === "POST" ? getIdempotencyKey(event) : "";
    if (event.httpMethod === "POST" && !idempotencyKey) {
      return errorResponse(
        event,
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key is required when creating a booking."
      );
    }
    if (event.httpMethod === "POST" && idempotencyKey) {
      const replay = await client.query(
        `SELECT id FROM "booking"
         WHERE "organizationId" = $1 AND "idempotencyKey" = $2
         LIMIT 1`,
        [organizationId, idempotencyKey]
      );
      if (replay.rowCount > 0) {
        const booking = await findBookingById(client, organizationId, replay.rows[0].id);
        return json(event, 200, authUser ? booking : toPublicBookingResponse(booking));
      }
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
        const booking = await findBookingById(client, organizationId, bookingId);
        if (!booking) {
          return json(event, 404, { error: "Booking not found." });
        }
        return json(event, 200, booking);
      }
      const results = await listBookings(client, organizationId, { compact });
      return json(event, 200, results);
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT") {
      return json(event, 405, { error: "Method Not Allowed" });
    }

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const hasItemsPayload = Array.isArray(data.items);
    const requestedCustomerId = Number(data.customerId);
    const requestedEventDate = parseDate(data.eventDate);
    const requestedEventEndDate = Object.prototype.hasOwnProperty.call(data, "eventEndDate")
      ? parseDate(data.eventEndDate)
      : undefined;
    const requestedStartTime = Object.prototype.hasOwnProperty.call(data, "startTime")
      ? normalizeTimeValue(data.startTime)
      : undefined;
    const requestedEndTime = Object.prototype.hasOwnProperty.call(data, "endTime")
      ? normalizeTimeValue(data.endTime)
      : undefined;
    const requestedVenueAddress = Object.prototype.hasOwnProperty.call(data, "venueAddress")
      ? cleanText(data.venueAddress, 240)
      : undefined;
    const requestedVenueGhanaPostGps = Object.prototype.hasOwnProperty.call(data, "venueGhanaPostGps")
      ? cleanText(data.venueGhanaPostGps, 32).toUpperCase()
      : undefined;
    const requestedCustomerNotes = Object.prototype.hasOwnProperty.call(data, "customerNotes")
      ? cleanText(data.customerNotes, 2000)
      : undefined;
    const requestedInternalNotes = Object.prototype.hasOwnProperty.call(data, "internalNotes")
      ? cleanText(data.internalNotes, 4000)
      : undefined;
    const hasRequestedStatus = Object.prototype.hasOwnProperty.call(data, "status");
    const rawRequestedStatus = hasRequestedStatus ? cleanText(data.status, 32).toLowerCase() : "";
    if (hasRequestedStatus && !["pending", "confirmed", "completed", "cancelled", "canceled"].includes(rawRequestedStatus)) {
      return errorResponse(event, 400, "INVALID_BOOKING_STATUS", "Booking status is invalid.");
    }
    const requestedStatus = hasRequestedStatus
      ? normalizeBookingStatusValue(data.status)
      : undefined;
    const assignedUserIdRaw = data.assignedUserId;
    const hasAssignedUser = Object.prototype.hasOwnProperty.call(data, "assignedUserId");
    const items = Array.isArray(data.items) ? data.items : [];
    const paymentPreference = sanitizePaymentPreference(data.paymentPreference);
    const applyBundleDiscount = data.applyBundleDiscount === true;
    const requestedDiscountCents = Number.isInteger(Number(data.discountCents))
      ? Math.max(0, Number(data.discountCents))
      : Number.isFinite(Number(data.discount))
        ? Math.max(0, Math.round(Number(data.discount) * 100))
        : null;

    const normalizedItems = items
      .slice(0, MAX_BOOKING_ITEMS)
      .map((item) => ({
        productId: Number(item.productId),
        variantId: Number.isFinite(Number(item.variantId)) && Number(item.variantId) > 0
          ? Number(item.variantId)
          : null,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        requestedUnitPriceCents:
          Number.isInteger(Number(item.unitPriceCents)) && Number(item.unitPriceCents) >= 0
            ? Number(item.unitPriceCents)
            : null,
      }))
      .filter((item) => Number.isFinite(item.productId));
    let bookingId = null;
    let existingBooking = null;

    if (event.httpMethod === "PUT") {
      bookingId = Number(data.id);
      if (!Number.isFinite(bookingId)) {
        return json(event, 400, { error: "id is required for update." });
      }
      existingBooking = await findBookingById(client, organizationId, bookingId);
      if (!existingBooking) {
        return json(event, 404, { error: "Booking not found." });
      }
      if (isBookingLocked(existingBooking.status)) {
        return errorResponse(event, 409, "BOOKING_LOCKED", "Completed and cancelled bookings are locked.");
      }
    }

    let customerId = Number.isFinite(requestedCustomerId) ? requestedCustomerId : Number(existingBooking?.customerId);
    const eventDate = requestedEventDate || parseDate(existingBooking?.eventDate);
    const eventEndDate = requestedEventEndDate !== undefined
      ? requestedEventEndDate
      : parseDate(existingBooking?.eventEndDate || existingBooking?.eventDate);
    const startTime =
      requestedStartTime !== undefined ? requestedStartTime : normalizeTimeValue(existingBooking?.startTime);
    const endTime =
      requestedEndTime !== undefined ? requestedEndTime : normalizeTimeValue(existingBooking?.endTime);
    const venueAddress =
      requestedVenueAddress !== undefined ? requestedVenueAddress : cleanText(existingBooking?.venueAddress, 240);
    const venueGhanaPostGps = requestedVenueGhanaPostGps !== undefined
      ? requestedVenueGhanaPostGps || null
      : cleanText(existingBooking?.venueGhanaPostGps, 32) || null;
    const customerNotes = requestedCustomerNotes !== undefined
      ? requestedCustomerNotes || null
      : cleanText(existingBooking?.customerNotes, 2000) || null;
    const internalNotes = authUser
      ? requestedInternalNotes !== undefined
        ? requestedInternalNotes || null
        : cleanText(existingBooking?.internalNotes, 4000) || null
      : null;
    const status = requestedStatus || normalizeBookingStatusValue(existingBooking?.status, "pending");
    const existingItemsByKey = new Map(
      (Array.isArray(existingBooking?.items) ? existingBooking.items : []).map((item) => [
        `${Number(item.productId)}:${Number(item.variantId) || "standard"}`,
        item,
      ])
    );
    const mergedItems = hasItemsPayload
      ? normalizedItems.map((item) => {
          const existingItem = existingItemsByKey.get(
            `${Number(item.productId)}:${Number(item.variantId) || "standard"}`
          );
          if (!existingItem || Number(existingItem.price) !== Number(item.requestedUnitPriceCents)) {
            return item;
          }
          return {
            ...item,
            requestedUnitPriceCents: Number(existingItem.price),
            catalogPriceCents: Number(existingItem.catalogPrice ?? existingItem.price),
            priceOverrideCents:
              existingItem.priceOverride === null ? null : Number(existingItem.priceOverride),
            priceOverriddenByUserId: existingItem.priceOverriddenByUserId || null,
            priceOverriddenAt: existingItem.priceOverriddenAt || null,
            preservePriceSnapshot: true,
          };
        })
      : (Array.isArray(existingBooking?.items) ? existingBooking.items : []).map((item) => ({
          productId: Number(item.productId),
          variantId: Number.isFinite(Number(item.variantId)) && Number(item.variantId) > 0
            ? Number(item.variantId)
            : null,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          requestedUnitPriceCents: Number(item.price),
          catalogPriceCents: Number(item.catalogPrice ?? item.price),
          priceOverrideCents: item.priceOverride === null ? null : Number(item.priceOverride),
          preservePriceSnapshot: true,
        }));
    const itemsChanged = event.httpMethod === "POST" || (
      hasItemsPayload
      && (
        normalizedItems.length !== existingItemsByKey.size
        || normalizedItems.some((item) => {
          const existingItem = existingItemsByKey.get(
            `${Number(item.productId)}:${Number(item.variantId) || "standard"}`
          );
          return !existingItem
            || Number(existingItem.quantity) !== Number(item.quantity)
            || Number(existingItem.price) !== Number(item.requestedUnitPriceCents);
        })
      )
    );

    const publicCustomer = !authUser && data.customer && typeof data.customer === "object"
      ? {
          name: cleanText(data.customer.name, 160),
          email: cleanText(data.customer.email, 240).toLowerCase(),
          phone: normalizeGhanaPhone(data.customer.phone),
        }
      : null;
    if (!authUser && !publicCustomer) {
      return errorResponse(event, 400, "BOOKING_CUSTOMER_REQUIRED", "Customer details are required.");
    }
    if (publicCustomer) {
      if (!publicCustomer.name) {
        return errorResponse(event, 400, "BOOKING_CUSTOMER_REQUIRED", "Customer name is required.");
      }
      if (publicCustomer.email && !EMAIL_PATTERN.test(publicCustomer.email)) {
        return errorResponse(event, 400, "INVALID_CUSTOMER_EMAIL", "Enter a valid email address.");
      }
      if (!publicCustomer.email && !publicCustomer.phone) {
        return errorResponse(event, 400, "INVALID_CUSTOMER_CONTACT", "A valid phone number or email is required.");
      }
    }
    if (authUser && !Number.isFinite(customerId)) {
      return errorResponse(event, 400, "BOOKING_CUSTOMER_REQUIRED", "customerId is required.");
    }
    if (!eventDate) return errorResponse(event, 400, "INVALID_BOOKING_DATE", "eventDate is required.");
    const dateRange = validateBookingDateRange(eventDate.toISOString(), eventEndDate?.toISOString());
    if (!dateRange.valid) {
      return errorResponse(
        event,
        400,
        dateRange.code,
        dateRange.code === "INVALID_BOOKING_DATE_RANGE"
          ? "Rental end date cannot be before the event date."
          : "Enter a valid booking date range."
      );
    }
    if (eventDate < new Date()) {
      // Allow same-day bookings; only block dates strictly in the past.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (eventDate < todayStart) {
        return errorResponse(event, 400, "BOOKING_DATE_IN_PAST", "eventDate cannot be in the past.");
      }
    }
    if (!venueAddress) return errorResponse(event, 400, "BOOKING_ADDRESS_REQUIRED", "venueAddress is required.");
    if (mergedItems.length === 0) {
      return errorResponse(event, 400, "BOOKING_ITEMS_REQUIRED", "At least one booking item is required.");
    }

    if (!authUser && status !== "pending") {
      return errorResponse(event, 403, "INVALID_BOOKING_TRANSITION", "Public booking requests must start as pending.");
    }
    if (!existingBooking && authUser && !["pending", "confirmed"].includes(status)) {
      return errorResponse(event, 409, "INVALID_BOOKING_TRANSITION", "New bookings must start as pending or confirmed.");
    }
    if (
      existingBooking
      && requestedStatus
      && !canTransitionBooking(existingBooking.status, requestedStatus)
    ) {
      return errorResponse(event, 409, "INVALID_BOOKING_TRANSITION", "That booking status change is not allowed.", {
        currentStatus: normalizeBookingStatus(existingBooking.status),
        requestedStatus,
      });
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

    let bundleEligible = false;

    const actor = authUser
      ? { userId: authUser.id, userName: authUser.fullName, userEmail: authUser.email }
      : await resolveActor(client, normalizeActor(data), organizationId);
    const actorUserId = await resolveOrganizationUserId(client, actor.userId, organizationId);
    const assignedUserIdValue = hasAssignedUser
      ? assignedUserIdRaw === null
        ? null
        : await resolveOrganizationUserId(client, assignedUserIdRaw, organizationId)
      : null;
    const autoAssignedUserId = hasAssignedUser
      ? assignedUserIdValue
      : actorUserId || await findLeastLoadedBookingAssignee(client, organizationId);

    await client.query("BEGIN");

    try {
      if (publicCustomer) {
        const phoneDigits = publicCustomer.phone.replace(/\D/g, "");
        const localPhone = phoneDigits.startsWith("233") ? `0${phoneDigits.slice(3)}` : phoneDigits;
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          [`booking_customer:${organizationId}:${publicCustomer.email || phoneDigits}`]
        );
        const customerMatch = await client.query(
          `SELECT id
           FROM "customer"
           WHERE "organizationId" = $1
             AND (
               ($2 <> '' AND LOWER(TRIM(email)) = LOWER(TRIM($2)))
               OR ($3 <> '' AND regexp_replace(phone, '[^0-9]+', '', 'g') = ANY($4::text[]))
             )
           ORDER BY id
           LIMIT 1
           FOR UPDATE`,
          [
            organizationId,
            publicCustomer.email,
            phoneDigits,
            [phoneDigits, localPhone].filter(Boolean),
          ]
        );
        if (customerMatch.rowCount > 0) {
          customerId = Number(customerMatch.rows[0].id);
        } else {
          const createdCustomer = await client.query(
            `INSERT INTO "customer" (
               "organizationId", name, email, phone, "createdAt", "updatedAt"
             )
             VALUES ($1,$2,$3,$4,NOW(),NOW())
             RETURNING id`,
            [
              organizationId,
              publicCustomer.name,
              publicCustomer.email || null,
              publicCustomer.phone || null,
            ]
          );
          customerId = Number(createdCustomer.rows[0].id);
        }
      } else {
        const customerCheck = await client.query(
          `SELECT id FROM "customer" WHERE id = $1 AND "organizationId" = $2`,
          [customerId, organizationId]
        );
        if (customerCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return errorResponse(event, 404, "BOOKING_CUSTOMER_NOT_FOUND", "Customer not found.");
        }
      }

      const commercialRules = await loadBookingCommercialRules(client, organizationId, eventDate);

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
        if (!item.preservePriceSnapshot && (product.isDeleted || product.isArchived || product.isActive === false)) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `${product.name || `Item ${item.productId}`} is unavailable.` });
        }
        const sku = typeof product.sku === "string" ? product.sku.trim().toUpperCase() : "";
        const source = typeof product.sourceCategoryCode === "string"
          ? product.sourceCategoryCode.trim().toUpperCase()
          : "";
        if (!item.preservePriceSnapshot && source !== "RENTAL" && !sku.startsWith("RENT") && !sku.startsWith("PUM")) {
          await client.query("ROLLBACK");
          return json(event, 400, { error: `Bookings can only include rental items. Item ${item.productId} is not a rental.` });
        }
        if (!item.preservePriceSnapshot && String(product.itemType || "STANDARD").toUpperCase() === "VARIANT_PARENT" && !item.variantId) {
          await client.query("ROLLBACK");
          return json(event, 400, { error: `Choose a specific variant for ${product.name || `item ${item.productId}`}.` });
        }
      }

      const resolveCatalogPriceCents = (item) => {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(Number(item.variantId)) : null;
        const variantPriceCents = Number(variant?.priceOverride);
        return Number.isFinite(variantPriceCents) && variantPriceCents >= 0
          ? variantPriceCents
          : Number(product?.price || 0);
      };

      const priceItem = (item) => {
        const currentCatalogPriceCents = resolveCatalogPriceCents(item);
        const catalogPriceCents = item.preservePriceSnapshot
          ? Number(item.catalogPriceCents ?? item.requestedUnitPriceCents ?? currentCatalogPriceCents)
          : currentCatalogPriceCents;
        const requestedPriceCents = Number(item.requestedUnitPriceCents);
        const hasRequestedPrice = Number.isInteger(requestedPriceCents) && requestedPriceCents >= 0;
        const isOverride = !item.preservePriceSnapshot
          && hasRequestedPrice
          && requestedPriceCents !== currentCatalogPriceCents;
        if (isOverride && !authUser) {
          const error = new Error("Public booking prices cannot be overridden.");
          error.statusCode = 403;
          error.code = "BOOKING_PRICE_OVERRIDE_FORBIDDEN";
          throw error;
        }
        if (isOverride && !hasPermission(authUser, "bookings:price_override")) {
          const error = new Error("You do not have permission to override booking prices.");
          error.statusCode = 403;
          error.code = "BOOKING_PRICE_OVERRIDE_FORBIDDEN";
          throw error;
        }
        const effectivePriceCents = item.preservePriceSnapshot
          ? Math.max(0, Number(item.requestedUnitPriceCents || 0))
          : isOverride
            ? requestedPriceCents
            : currentCatalogPriceCents;
        if (!item.preservePriceSnapshot && effectivePriceCents <= 0) {
          const error = new Error("A selected rental does not have a valid selling price. Ask an authorized manager to review it.");
          error.statusCode = 409;
          error.code = "BOOKING_PRICE_UNAVAILABLE";
          throw error;
        }
        return {
          ...item,
          catalogPriceCents,
          effectivePriceCents,
          priceOverrideCents: item.preservePriceSnapshot
            ? item.priceOverrideCents ?? null
            : isOverride
              ? requestedPriceCents
              : null,
          priceOverriddenByUserId: isOverride ? actorUserId : item.priceOverriddenByUserId || null,
          priceOverriddenAt: isOverride ? new Date() : item.priceOverriddenAt || null,
        };
      };

      const pricedMergedItems = mergedItems.map(priceItem);
      const bundleItems = pricedMergedItems.filter((item) => item.effectivePriceCents > 0);
      bundleEligible = bundleItems.length >= commercialRules.bundleMinItems;

      const motorsRes = await client.query(
        `SELECT "productId", COALESCE("motorsToPump", 0) AS motors
         FROM "bouncy_castles"
         WHERE "productId" = ANY($1::int[]) AND "organizationId" = $2`,
        [productIds, organizationId]
      );
      const motorsMap = new Map(
        motorsRes.rows.map((row) => [Number(row.productId), Number(row.motors) || 0])
      );

      let finalItems = [...pricedMergedItems];
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
          finalItems.push(priceItem({ productId: pumpProduct.id, variantId: null, quantity: pumpQuantity }));
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

      const shouldReserveVariants = isBookingReservationActive(status);
      const scheduleOrItemsChanged = itemsChanged
        || Boolean(requestedEventDate)
        || requestedEventEndDate !== undefined;
      const releaseExistingReservations = event.httpMethod === "PUT"
        && existingBooking
        && isBookingReservationActive(existingBooking.status)
        && (scheduleOrItemsChanged || !shouldReserveVariants);
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
        if (shouldReserveVariants && productsInMaintenance.has(Number(item.productId))) {
          await client.query("ROLLBACK");
          return json(event, 409, { error: `${product?.name || `Item ${item.productId}`} is currently in maintenance.` });
        }

        if (item.variantId) {
          const variant = variantMap.get(Number(item.variantId));
          if (!variant || Number(variant.inventoryItemId) !== Number(item.productId)) {
            await client.query("ROLLBACK");
            return json(event, 409, { error: `Variant ${item.variantId} does not belong to product ${item.productId}.` });
          }
          if (shouldReserveVariants && String(variant.status || "active").toLowerCase() !== "active") {
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
                 AND b."eventDate"::date <= $4::date
                 AND b."eventEndDate"::date >= $3::date
                 ${bookingId ? `AND b.id != ${Number(bookingId)}` : ""}`,
              [item.variantId, organizationId, eventDate, eventEndDate]
            );
            const reservedOnDate = Number(dateReservedRes.rows[0]?.reserved || 0);
            const totalUnits = Math.max(Number(variant.stockQty || 0), 1);
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
              [`booking_avail:${organizationId}:${item.productId}`]
            );
            const productDateRes = await client.query(
              `SELECT COALESCE(SUM(bi.quantity), 0)::int AS reserved
               FROM "bookingItem" bi
               JOIN "booking" b ON b.id = bi."bookingId"
               WHERE bi."productId" = $1
                 AND bi."variantId" IS NULL
                 AND bi."organizationId" = $2
                 AND LOWER(b.status) IN ('pending', 'confirmed')
                 AND b."eventDate"::date <= $4::date
                 AND b."eventEndDate"::date >= $3::date
                 ${bookingId ? `AND b.id != ${Number(bookingId)}` : ""}`,
              [item.productId, organizationId, eventDate, eventEndDate]
            );
            const reservedOnDate = Number(productDateRes.rows[0]?.reserved || 0);
            const totalUnits = Math.max(Number(product?.stock ?? 0), 1);
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
        })),
        commercialRules.attendantUnitFeeCents
      );
      const linePricingChanged = event.httpMethod === "POST" || itemsChanged;
      const subtotalCents = linePricingChanged
        ? finalItems.reduce(
            (sum, item) => sum + item.effectivePriceCents * item.quantity,
            0
          )
        : Number(existingBooking?.subtotalCents ?? existingBooking?.totalAmount ?? 0);
      const feeCents = linePricingChanged
        ? attendantCharge.totalCents
        : Number(existingBooking?.feeCents || 0);
      const taxCents = event.httpMethod === "POST" ? 0 : Number(existingBooking?.taxCents || 0);
      let discountCents = Number(existingBooking?.discountCents || 0);
      if (applyBundleDiscount) {
        discountCents = bundleEligible
          ? Math.round(
              bundleItems.reduce(
                (sum, item) => sum + item.effectivePriceCents * item.quantity,
                0
              ) * commercialRules.bundleDiscountBps / 10000
            )
          : 0;
      } else if (requestedDiscountCents !== null) {
        if (requestedDiscountCents > 0 && !hasPermission(authUser, "bookings:discount")) {
          const error = new Error("You do not have permission to discount bookings.");
          error.statusCode = 403;
          error.code = "BOOKING_DISCOUNT_FORBIDDEN";
          throw error;
        }
        discountCents = requestedDiscountCents;
      } else if (event.httpMethod === "POST") {
        discountCents = 0;
      }
      const grossCents = subtotalCents + feeCents + taxCents;
      if (discountCents > grossCents) {
        const error = new Error("Booking discount cannot exceed the booking subtotal and fees.");
        error.statusCode = 400;
        error.code = "INVALID_BOOKING_DISCOUNT";
        throw error;
      }
      const totalAmount = grossCents - discountCents;
      const depositRateBps = event.httpMethod === "POST"
        ? commercialRules.serviceDepositBps
        : existingBooking?.depositRateBps === null || existingBooking?.depositRateBps === undefined
          ? null
          : Number(existingBooking.depositRateBps);
      const depositRequiredCents = depositRateBps === null
        ? existingBooking?.depositRequiredCents ?? null
        : Math.round(totalAmount * depositRateBps / 10000);

      if (event.httpMethod === "POST") {
        await synchronizeBookingSequence(client);
        const bookingRes = await client.query(
          `INSERT INTO "booking" (
             "organizationId",
             "customerId",
             "reference",
             "idempotencyKey",
             "eventDate",
             "eventEndDate",
             "startTime",
             "endTime",
             "venueAddress",
             "venueGhanaPostGps",
             "customerNotes",
             "internalNotes",
             "currency",
             "subtotalCents",
             "discountCents",
             "feeCents",
             "taxCents",
             "depositRateBps",
             "depositRequiredCents",
             "totalAmount",
             "status",
             "createdAt",
             "updatedAt",
             "lastModifiedAt",
             "createdByUserId",
             "updatedByUserId",
             "assignedUserId"
           )
           VALUES ($1,$2,'PENDING-' || $3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW(),NOW(),$21,$21,$22)
           RETURNING id, "createdAt"`,
          [
            organizationId,
            customerId,
            idempotencyKey,
            eventDate,
            eventEndDate,
            startTime || null,
            endTime || null,
            venueAddress,
            venueGhanaPostGps,
            customerNotes,
            internalNotes,
            commercialRules.currency,
            subtotalCents,
            discountCents,
            feeCents,
            taxCents,
            depositRateBps,
            depositRequiredCents,
            totalAmount,
            status,
            actorUserId,
            autoAssignedUserId,
          ]
        );
        bookingId = bookingRes.rows[0].id;
        await client.query(
          `UPDATE "booking" SET reference = $1 WHERE id = $2 AND "organizationId" = $3`,
          [buildBookingReference(bookingRes.rows[0]), bookingId, organizationId]
        );
      } else {
        await client.query(
          `UPDATE "booking"
           SET "customerId" = $1,
               "eventDate" = $2,
               "eventEndDate" = $3,
               "startTime" = $4,
               "endTime" = $5,
               "venueAddress" = $6,
               "venueGhanaPostGps" = $7,
               "customerNotes" = $8,
               "internalNotes" = $9,
               "currency" = $10,
               "subtotalCents" = $11,
               "discountCents" = $12,
               "feeCents" = $13,
               "taxCents" = $14,
               "depositRateBps" = $15,
               "depositRequiredCents" = $16,
               "totalAmount" = $17,
               "status" = $18,
               "updatedAt" = NOW(),
               "lastModifiedAt" = NOW(),
               "updatedByUserId" = $20,
               "assignedUserId" = CASE WHEN $21 THEN $22 ELSE "assignedUserId" END
           WHERE id = $19 AND "organizationId" = $23`,
          [
            customerId,
            eventDate,
            eventEndDate,
            startTime || null,
            endTime || null,
            venueAddress,
            venueGhanaPostGps,
            customerNotes,
            internalNotes,
            existingBooking?.currency || commercialRules.currency,
            subtotalCents,
            discountCents,
            feeCents,
            taxCents,
            depositRateBps,
            depositRequiredCents,
            totalAmount,
            status,
            bookingId,
            actorUserId,
            hasAssignedUser,
            assignedUserIdValue,
            organizationId,
          ]
        );

        if (itemsChanged) {
          await client.query(
            `DELETE FROM "bookingItem" WHERE "bookingId" = $1 AND "organizationId" = $2`,
            [bookingId, organizationId]
          );
        }
      }

      for (const item of finalItems) {
        if (event.httpMethod === "POST" || itemsChanged) {
          await client.query(
            `INSERT INTO "bookingItem" (
               "organizationId", "bookingId", "productId", "variantId", quantity, price,
               "catalogPrice", "priceOverride", "priceOverriddenByUserId", "priceOverriddenAt", "lineTotal"
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              organizationId,
              bookingId,
              item.productId,
              item.variantId || null,
              item.quantity,
              item.effectivePriceCents,
              item.catalogPriceCents,
              item.priceOverrideCents,
              item.priceOverriddenByUserId,
              item.priceOverriddenAt,
              item.effectivePriceCents * item.quantity,
            ]
          );
        }
        if (
          shouldReserveVariants
          && item.variantId
          && (event.httpMethod === "POST" || releaseExistingReservations)
        ) {
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

      const persistedBooking = await findBookingById(client, organizationId, bookingId);

      if (event.httpMethod === "POST") {
        try {
          await sendManagerWhatsApp({
            lines: buildBookingWhatsAppLines(persistedBooking),
          });
        } catch (err) {
          requestLogger.warn({
            err,
            eventName: "booking.notification.whatsapp_failed",
          }, "Booking WhatsApp notification failed");
        }
        try {
          await notifyManager(client, buildBookingNotification(persistedBooking), {
            organizationId,
          });
        } catch (err) {
          requestLogger.warn({
            err,
            eventName: "booking.notification.push_failed",
          }, "Booking manager push notification failed");
        }
        const createdBooking = {
          ...persistedBooking,
          paymentPreference,
        };
        const emailResults = await Promise.allSettled(
          [
            sendNotificationEmail({
              to: getNotificationCatchallEmail(),
              subject: `New booking ${createdBooking?.reference || ""}`.trim(),
              text: buildInternalBookingEmailText(createdBooking),
              html: buildInternalBookingEmailHtml(createdBooking),
            }),
            createdBooking?.customerEmail
              ? sendNotificationEmail({
                  to: createdBooking.customerEmail,
                  subject: `We received your booking ${createdBooking?.reference || ""}`.trim(),
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
            requestLogger.warn({
              err: result.reason,
              eventName: "booking.notification.email_failed",
            }, "Booking email notification failed");
          }
        });
      }

      const previousStatus = normalizeBookingStatus(existingBooking?.status, "");
      const statusChanged = Boolean(previousStatus && previousStatus !== status);
      const auditAction = event.httpMethod === "POST"
        ? "BOOKING_CREATED"
        : statusChanged && status === "cancelled"
          ? "BOOKING_CANCELLED"
          : statusChanged && status === "completed"
            ? "BOOKING_COMPLETED"
            : statusChanged && status === "confirmed"
              ? "BOOKING_CONFIRMED"
              : "BOOKING_UPDATED";
      await writeAuditLog(client, {
        userId: actorUserId,
        organizationId,
        action: auditAction,
        targetType: "booking",
        targetId: String(persistedBooking?.reference || bookingId),
        source: authUser ? "api" : "integration",
        category: "booking",
        severity: "info",
        status: "ok",
        summary:
          event.httpMethod === "POST"
            ? `Created booking ${persistedBooking?.reference || bookingId}.`
            : `${statusChanged ? "Changed status for" : "Updated"} booking ${persistedBooking?.reference || bookingId}.`,
        actorLabel: actor.userName || actor.userEmail || "Guest",
        requestId,
        ipAddress: getEventIpAddress(event),
        metadata: {
          customerId,
          itemCount: finalItems.length,
          totalAmount,
          status,
          previousStatus: previousStatus || null,
          reservationActive: shouldReserveVariants,
        },
      });

      const priceOverrides = finalItems.filter((item) => item.priceOverrideCents !== null && !item.preservePriceSnapshot);
      for (const item of priceOverrides) {
        await writeAuditLog(client, {
          userId: actorUserId,
          organizationId,
          action: "BOOKING_PRICE_OVERRIDE",
          targetType: "booking",
          targetId: String(persistedBooking?.reference || bookingId),
          source: "api",
          category: "booking",
          severity: "info",
          status: "ok",
          summary: `Overrode a rental line price for booking ${persistedBooking?.reference || bookingId}.`,
          actorLabel: actor.userName || actor.userEmail || "User",
          requestId,
          ipAddress: getEventIpAddress(event),
          metadata: {
            productId: item.productId,
            variantId: item.variantId || null,
            catalogPriceCents: item.catalogPriceCents,
            overridePriceCents: item.priceOverrideCents,
          },
        });
      }

      return json(
        event,
        event.httpMethod === "POST" ? 201 : 200,
        authUser ? persistedBooking : toPublicBookingResponse(persistedBooking)
      );
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505" && idempotencyKey) {
        const replay = await client.query(
          `SELECT id FROM "booking"
           WHERE "organizationId" = $1 AND "idempotencyKey" = $2
           LIMIT 1`,
          [organizationId, idempotencyKey]
        );
        if (replay.rowCount > 0) {
          const booking = await findBookingById(client, organizationId, replay.rows[0].id);
          return json(event, 200, authUser ? booking : toPublicBookingResponse(booking));
        }
      }
      throw err;
    }
  } catch (err) {
    if (Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500) {
      return errorResponse(
        event,
        err.statusCode,
        err.code || "BOOKING_REQUEST_INVALID",
        err.message || "Booking request is invalid."
      );
    }
    requestLogger.error({
      err,
      eventName: "booking.request.failed",
    }, "Booking request failed");
    return errorResponse(event, 500, "BOOKING_REQUEST_FAILED", "Failed to process booking request.");
  } finally {
    await client.end().catch(() => {});
  }
}
