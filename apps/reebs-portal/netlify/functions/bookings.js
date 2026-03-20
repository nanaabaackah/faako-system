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
import { resolveOrganizationId } from "./_shared/organization.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";
import { sanitizePaymentPreference } from "./_shared/paymentInstructions.js";
import {
  buildCustomerBookingEmailText,
  buildInternalBookingEmailText,
} from "./_shared/transactionEmailTemplates.js";

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

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

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
         AND LOWER(u.role) IN ('admin', 'manager', 'staff', 'sales')
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      },
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authUser = await requireUser(client, event);
    let data = null;
    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      try {
        data = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON body." });
      }
    }
    if (!authUser && event.httpMethod !== "POST") {
      return json(401, { error: "Unauthorized" });
    }
    const organizationId = authUser
      ? authUser.organizationId
      : await resolveOrganizationId(client, event, data);
    await ensureAuditColumns(client);
    const defaultActor = authUser
      ? { userId: authUser.id, userName: authUser.fullName, userEmail: authUser.email }
      : await resolveActor(client, normalizeActor({}), organizationId);
    if (defaultActor.userId) {
      await backfillAuditDefaults(client, defaultActor.userId, organizationId);
    }

    if (event.httpMethod === "GET") {
      const result = await client.query(
        `SELECT
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
                 'quantity', bi.quantity,
                 'price', bi.price,
                 'productName', p.name,
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
         WHERE b."organizationId" = $1
         GROUP BY b.id, c.id, assignee.id, updater.id, creator.id
         ORDER BY b."eventDate" DESC, b.id DESC`,
        [organizationId]
      );

      return json(200, result.rows);
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT") {
      return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" });
    }

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const customerId = Number(data.customerId);
    const eventDate = parseDate(data.eventDate);
    const startTime = typeof data.startTime === "string" ? data.startTime.trim() : null;
    const endTime = typeof data.endTime === "string" ? data.endTime.trim() : null;
    const venueAddress = typeof data.venueAddress === "string" ? data.venueAddress.trim() : "";
    const status = typeof data.status === "string" && data.status.trim() ? data.status.trim() : "pending";
    const assignedUserIdRaw = data.assignedUserId;
    const hasAssignedUser = Object.prototype.hasOwnProperty.call(data, "assignedUserId");
    const items = Array.isArray(data.items) ? data.items : [];
    const paymentPreference = sanitizePaymentPreference(data.paymentPreference);
    let discountValue = Number.isFinite(Number(data.discount)) ? Math.max(0, Number(data.discount)) : 0;
    const applyBundleDiscount = data.applyBundleDiscount === true;

    if (!Number.isFinite(customerId)) return json(400, { error: "customerId is required." });
    if (!eventDate) return json(400, { error: "eventDate is required." });
    if (!venueAddress) return json(400, { error: "venueAddress is required." });

    const normalizedItems = items
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        price: Number.isFinite(Number(item.price)) ? Math.max(0, Number(item.price)) : null,
      }))
      .filter((item) => Number.isFinite(item.productId));

    if (normalizedItems.length === 0) {
      return json(400, { error: "At least one booking item is required." });
    }

    let bundleEligible = normalizedItems.length >= BUNDLE_MIN_ITEMS;

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
        return json(404, { error: "Customer not found." });
      }

      const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
      const productRes = await client.query(
        `SELECT id, price, sku, "sourceCategoryCode"
         FROM "product"
         WHERE id = ANY($1::int[]) AND "organizationId" = $2`,
        [productIds, organizationId]
      );
      const productMap = new Map(productRes.rows.map((row) => [row.id, row]));

      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          await client.query("ROLLBACK");
          return json(404, { error: `Product ${item.productId} not found.` });
        }
        const sku = typeof product.sku === "string" ? product.sku.trim().toUpperCase() : "";
        const source = typeof product.sourceCategoryCode === "string"
          ? product.sourceCategoryCode.trim().toUpperCase()
          : "";
        if (source !== "RENTAL" && !sku.startsWith("RENT") && !sku.startsWith("PUM")) {
          await client.query("ROLLBACK");
          return json(400, { error: `Bookings can only include rental items. Item ${item.productId} is not a rental.` });
        }
      }

      const pricedItems = normalizedItems.filter((item) => {
        const product = productMap.get(item.productId);
        const priceCents = Number.isFinite(item.price)
          ? Math.round(item.price * 100)
          : product?.price || 0;
        return priceCents > 0;
      });
      bundleEligible = pricedItems.length >= BUNDLE_MIN_ITEMS;

      if (applyBundleDiscount) {
        if (bundleEligible) {
          const bundleSubtotalCents = pricedItems.reduce((sum, item) => {
            const product = productMap.get(item.productId);
            const priceCents = Number.isFinite(item.price)
              ? Math.round(item.price * 100)
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

      let finalItems = [...normalizedItems];
      const pumpQuantity = normalizedItems.reduce((sum, item) => {
        const motors = motorsMap.get(item.productId) || 0;
        return sum + motors * item.quantity;
      }, 0);

      if (pumpQuantity > 0) {
        const pumpRes = await client.query(
          `SELECT id, price, sku, "sourceCategoryCode"
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
          return json(500, { error: "Motor Pump product is missing. Import motor pumps first." });
        }
        const pumpSku = typeof pumpProduct.sku === "string" ? pumpProduct.sku.trim().toUpperCase() : "";
        const pumpSource = typeof pumpProduct.sourceCategoryCode === "string"
          ? pumpProduct.sourceCategoryCode.trim().toUpperCase()
          : "";
        if (pumpSource !== "RENTAL" && !pumpSku.startsWith("RENT") && !pumpSku.startsWith("PUM")) {
          await client.query("ROLLBACK");
          return json(500, { error: "Motor Pump product is not marked as a rental." });
        }
        productMap.set(pumpProduct.id, pumpProduct);
        const existingPump = finalItems.find((item) => item.productId === pumpProduct.id);
        if (existingPump) {
          existingPump.quantity = pumpQuantity;
        } else {
          finalItems.push({ productId: pumpProduct.id, quantity: pumpQuantity, price: null });
        }
      }

      const totalAmount = Math.max(
        0,
        finalItems.reduce((sum, item) => {
          const product = productMap.get(item.productId);
          const priceCents = Number.isFinite(item.price)
            ? Math.round(item.price * 100)
            : product.price;
          return sum + priceCents * item.quantity;
        }, 0) - Math.round(discountValue * 100)
      );

      let bookingId;

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
        bookingId = Number(data.id);
        if (!Number.isFinite(bookingId)) {
          await client.query("ROLLBACK");
          return json(400, { error: "id is required for update." });
        }

        const exists = await client.query(
          `SELECT id FROM "booking" WHERE id = $1 AND "organizationId" = $2`,
          [bookingId, organizationId]
        );
        if (exists.rowCount === 0) {
          await client.query("ROLLBACK");
          return json(404, { error: "Booking not found." });
        }

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
        const price = Number.isFinite(item.price) ? Math.round(item.price * 100) : fallbackPrice;
        await client.query(
          `INSERT INTO "bookingItem" ("organizationId", "bookingId", "productId", quantity, price)
           VALUES ($1,$2,$3,$4,$5)`,
          [organizationId, bookingId, item.productId, item.quantity, price]
        );
      }

      await client.query("COMMIT");

      const payload = await client.query(
        `SELECT
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
                 'quantity', bi.quantity,
                 'price', bi.price,
                 'productName', p.name,
                 'productImage', p."imageUrl"
               )
               ORDER BY bi.id
             ) FILTER (WHERE bi.id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM "booking" b
         JOIN "customer" c ON c.id = b."customerId"
         LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId"
         LEFT JOIN "user" updater ON updater.id = b."updatedByUserId"
         LEFT JOIN "user" creator ON creator.id = b."createdByUserId"
         LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id AND bi."organizationId" = b."organizationId"
         LEFT JOIN "product" p ON p.id = bi."productId" AND p."organizationId" = b."organizationId"
         WHERE b.id = $1 AND b."organizationId" = $2
         GROUP BY b.id, c.id, assignee.id, updater.id, creator.id`,
        [bookingId, organizationId]
      );

      if (event.httpMethod === "POST") {
        try {
          await sendManagerWhatsApp({
            lines: buildBookingWhatsAppLines(payload.rows[0]),
          });
        } catch (err) {
          console.warn("WhatsApp notify failed:", err?.message || err);
        }
        try {
          await notifyManager(client, buildBookingNotification(payload.rows[0]));
        } catch (err) {
          console.warn("Manager push failed:", err?.message || err);
        }
        const createdBooking = {
          ...payload.rows[0],
          paymentPreference,
        };
        const emailResults = await Promise.allSettled(
          [
            sendNotificationEmail({
              to: getNotificationCatchallEmail(),
              subject: `New booking #${createdBooking?.id || ""}`.trim(),
              text: buildInternalBookingEmailText(createdBooking),
            }),
            createdBooking?.customerEmail
              ? sendNotificationEmail({
                  to: createdBooking.customerEmail,
                  subject: `We received your booking #${createdBooking?.id || ""}`.trim(),
                  text: buildCustomerBookingEmailText(createdBooking, {
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

      return json(event.httpMethod === "POST" ? 201 : 200, payload.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error("❌ Database error:", err);
    return json(500, { error: err.message || "Database error" });
  } finally {
    await client.end().catch(() => {});
  }
}
