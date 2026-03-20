/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns, findDefaultAdmin, backfillAuditDefaults } from "./auditHelpers.js";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";

export async function handler(event) {
  const userId = Number(event.queryStringParameters?.userId || 0);
  const includeDetails =
    ["1", "true", "yes"].includes((event.queryStringParameters?.details || "").toLowerCase()) ||
    ["1", "true", "yes"].includes((event.queryStringParameters?.includeDetails || "").toLowerCase());
  if (!userId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "userId is required" }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureAuditColumns(client);
    const admin = await findDefaultAdmin(client);
    if (admin?.id) {
      await backfillAuditDefaults(client, admin.id);
    }

    const orderDetailsPromise = client.query(
      `SELECT
         o.id,
         o."orderNumber",
         o."customerName",
         o.status,
         o."total_amount",
         o."deliveryMethod",
         o."deliveryDetails",
         o."orderDate",
         o."deliveryDate",
         o."lastModifiedAt",
         o."assignedUserId",
         o."updatedByUserId",
         assignee."fullName" AS "assignedUserName",
         updater."fullName" AS "updatedByName"
       FROM "order" o
       LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId"
       LEFT JOIN "user" updater ON updater.id = o."updatedByUserId"
       WHERE $1 = COALESCE(o."assignedUserId", o."createdByUserId")
          OR $1 = o."updatedByUserId"
       ORDER BY o."lastModifiedAt" DESC NULLS LAST, o."orderDate" DESC, o."id" DESC`,
      [userId]
    );

    const basePromises = [
      orderDetailsPromise,
      client.query(
        `SELECT
           COUNT(*)::int AS bookings,
           COALESCE(SUM("totalAmount"), 0) AS revenue_cents
         FROM "booking"
         WHERE $1 = COALESCE("assignedUserId", "createdByUserId")
            OR $1 = "updatedByUserId"`,
        [userId]
      ),
      client.query(
        `SELECT COALESCE(COUNT(*),0)::int AS movements
         FROM "stockMovement"
         WHERE $1 = "performedByUserId"`,
        [userId]
      ),
    ];

    const detailPromises = includeDetails
      ? [
          client.query(
            `SELECT
               b.id,
               b."customerId",
               c.name AS "customerName",
               b."eventDate",
               b."startTime",
               b."endTime",
               b."venueAddress",
               b."totalAmount",
               b.status,
               b."lastModifiedAt",
               b."assignedUserId",
               b."createdByUserId",
               b."updatedByUserId",
               assignee."fullName" AS "assignedUserName",
               updater."fullName" AS "updatedByName",
               creator."fullName" AS "createdByName"
             FROM "booking" b
             JOIN "customer" c ON c.id = b."customerId"
             LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId"
             LEFT JOIN "user" updater ON updater.id = b."updatedByUserId"
             LEFT JOIN "user" creator ON creator.id = b."createdByUserId"
             WHERE $1 = COALESCE(b."assignedUserId", b."createdByUserId")
                OR $1 = b."updatedByUserId"
             ORDER BY b."eventDate" DESC, b."id" DESC`,
            [userId]
          ),
          client.query(
            `SELECT
               sm.id,
               sm."productId",
               p.name AS "productName",
               sm.type,
               sm.quantity,
               sm.reference,
               sm.notes,
               sm.date,
               sm."createdAt",
               sm."performedByUserId",
               sm."performedByName"
             FROM "stockMovement" sm
             LEFT JOIN "product" p ON p.id = sm."productId"
             WHERE $1 = sm."performedByUserId"
             ORDER BY sm.date DESC NULLS LAST, sm.id DESC`,
            [userId]
          ),
        ]
      : [];

    const results = await Promise.all([...basePromises, ...detailPromises]);
    const [orderDetails, bookingRows, stockRows, bookingDetails, stockDetails] = results;
    const orderRows = orderDetails?.rows || [];
    let orderRevenueCents = 0;
    const orderDetailList = orderRows.map((row) => {
      const baseCents = Number(row.total_amount || 0);
      const { distanceKm, feeCents } = getDeliveryFeeDetails(
        row.deliveryMethod,
        row.deliveryDetails
      );
      const totalCents = baseCents + feeCents;
      orderRevenueCents += totalCents;
      return {
        ...row,
        itemsTotal: baseCents / 100,
        deliveryFee: feeCents / 100,
        deliveryFeeCents: feeCents,
        deliveryDistanceKm: distanceKm || 0,
        total: totalCents / 100,
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        orders: orderRows.length,
        orderRevenue: orderRevenueCents / 100,
        bookings: bookingRows.rows[0]?.bookings || 0,
        bookingRevenue: Number(bookingRows.rows[0]?.revenue_cents || 0) / 100,
        stockMovements: stockRows.rows[0]?.movements || 0,
        details: includeDetails
          ? {
              orders: orderDetailList,
              bookings: bookingDetails?.rows || [],
              stockMovements: stockDetails?.rows || [],
            }
          : undefined,
      }),
    };
  } catch (err) {
    console.error("❌ userStats error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch user stats" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
