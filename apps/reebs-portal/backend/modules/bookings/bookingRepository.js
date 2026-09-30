const COMPACT_BOOKING_SELECT = `
  SELECT
    b.id,
    b.reference,
    b."customerId",
    c.name AS "customerName",
    c.email AS "customerEmail",
    c.phone AS "customerPhone",
    b."eventDate",
    b."eventEndDate",
    b."startTime",
    b."endTime",
    b."venueAddress",
    b."venueGhanaPostGps",
    b.currency,
    b."subtotalCents",
    b."discountCents",
    b."feeCents",
    b."taxCents",
    b."depositRequiredCents",
    b."totalAmount",
    COALESCE(booking_payment."amountPaidCents", 0)::bigint AS "amountPaidCents",
    GREATEST(
      COALESCE(b."totalAmount", 0) - COALESCE(booking_payment."amountPaidCents", 0),
      0
    )::bigint AS "balanceDueCents",
    b.status,
    b."assignedUserId",
    assignee."fullName" AS "assignedUserName",
    b."createdAt",
    b."lastModifiedAt",
    b."updatedAt"
  FROM "booking" b
  JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
  LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId"
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(pa."amountCents") FILTER (WHERE pa.status = 'APPLIED'), 0)::bigint AS "amountPaidCents"
    FROM "paymentApplication" pa
    WHERE pa."organizationId" = b."organizationId"
      AND pa."payableType" = 'BOOKING'
      AND pa."payableId" = b.id
  ) booking_payment ON TRUE
`;

const FULL_BOOKING_SELECT = `
  SELECT
    b.id,
    b.reference,
    b."customerId",
    c.name AS "customerName",
    c.email AS "customerEmail",
    c.phone AS "customerPhone",
    b."eventDate",
    b."eventEndDate",
    b."startTime",
    b."endTime",
    b."venueAddress",
    b."venueGhanaPostGps",
    b."customerNotes",
    b."internalNotes",
    b.currency,
    b."subtotalCents",
    b."discountCents",
    b."feeCents",
    b."taxCents",
    b."depositRateBps",
    b."depositRequiredCents",
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
          'catalogPrice', bi."catalogPrice",
          'priceOverride', bi."priceOverride",
          'priceOverriddenByUserId', bi."priceOverriddenByUserId",
          'priceOverriddenAt', bi."priceOverriddenAt",
          'lineTotal', bi."lineTotal",
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

export async function listBookings(client, organizationId, { compact = false } = {}) {
  if (compact) {
    const result = await client.query(
      `${COMPACT_BOOKING_SELECT}
       WHERE b."organizationId" = $1
       ORDER BY b."eventDate" DESC, b.id DESC`,
      [organizationId]
    );
    return result.rows || [];
  }

  const result = await client.query(
    `${FULL_BOOKING_SELECT}
     WHERE b."organizationId" = $1
     GROUP BY b.id, c.id, assignee.id, updater.id, creator.id
     ORDER BY b."eventDate" DESC, b.id DESC`,
    [organizationId]
  );
  return result.rows || [];
}

export async function findBookingById(client, organizationId, bookingId) {
  const result = await client.query(
    `${FULL_BOOKING_SELECT}
     WHERE b.id = $1
       AND b."organizationId" = $2
     GROUP BY b.id, c.id, assignee.id, updater.id, creator.id
     LIMIT 1`,
    [bookingId, organizationId]
  );
  return result.rows[0] || null;
}

export async function synchronizeBookingSequence(client) {
  try {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('booking','id'),
        COALESCE((SELECT MAX(id) FROM "booking"), 0) + 1,
        false)`
    );
  } catch (error) {
    logger.warn({
      err: error,
      eventName: "booking.sequence_sync.failed",
    }, "Booking sequence synchronization failed");
  }
}

export async function resolveOrganizationUserId(client, userId, organizationId = null) {
  const parsedId = Number(userId);
  if (!Number.isFinite(parsedId)) return null;
  const hasOrganization = Number.isFinite(Number(organizationId));
  const result = await client.query(
    `SELECT id FROM "user" WHERE id = $1${hasOrganization ? ` AND "organizationId" = $2` : ""}`,
    hasOrganization ? [parsedId, organizationId] : [parsedId]
  );
  return result.rowCount > 0 ? parsedId : null;
}

export async function findLeastLoadedBookingAssignee(client, organizationId) {
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
  } catch (error) {
    logger.warn({
      err: error,
      organizationId,
      eventName: "booking.auto_assignment.failed",
    }, "Booking auto-assignment lookup failed");
    return null;
  }
}
import { createLogger } from "../../functions/_shared/logger.js";

const logger = createLogger("booking-repository");
