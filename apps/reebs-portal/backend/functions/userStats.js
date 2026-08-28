import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns, backfillAuditDefaults } from "./auditHelpers.js";
import { getRecordedDeliveryDistanceKm } from "./_shared/deliveryFee.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { serializePgClientQueries } from "./_shared/serializedPgClient.js";
import { requireUser } from "./_shared/userAuth.js";
import { hasPermission } from "./_shared/accessControl.js";

const responseHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,OPTIONS",
  }),
});

const json = (event, statusCode, payload) => ({
  statusCode,
  headers: responseHeaders(event),
  body: statusCode === 204 ? "" : JSON.stringify(payload),
});

const hasColumn = async (client, tableName, columnName, schema = "public") => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
     LIMIT 1`,
    [schema, tableName, columnName]
  );
  return result.rowCount > 0;
};

const canInspectOtherUsers = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "manager";
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, "");
  }

  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed" });
  }

  const includeDetails =
    ["1", "true", "yes"].includes((event.queryStringParameters?.details || "").toLowerCase()) ||
    ["1", "true", "yes"].includes((event.queryStringParameters?.includeDetails || "").toLowerCase());

  const client = serializePgClientQueries(new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  }));

  try {
    await client.connect();
    await ensureAuditColumns(client);

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(event, 401, { error: "Unauthorized" });
    }
    if (!hasPermission(authUser, "orders:read") || !hasPermission(authUser, "bookings:read")) {
      return json(event, 403, { error: "Core operations permission is required." });
    }

    const organizationId = Number(authUser.organizationId);
    const authUserId = Number(authUser.id);
    const requestedScope = String(event.queryStringParameters?.scope || "mine").trim().toLowerCase();
    if (requestedScope === "team" && !canInspectOtherUsers(authUser.role)) {
      return json(event, 403, { error: "Only admins and managers can view team activity." });
    }
    const activityScope = requestedScope === "team" ? "team" : "mine";
    const shouldIncludeDetails = includeDetails || activityScope === "team";
    const requestedUserId = Number(event.queryStringParameters?.userId || authUserId);
    const targetUserId = activityScope === "team"
      ? authUserId
      : Number.isFinite(requestedUserId) && requestedUserId > 0
        ? requestedUserId
        : authUserId;

    if (activityScope !== "team" && targetUserId !== authUserId && !canInspectOtherUsers(authUser.role)) {
      return json(event, 403, { error: "Only admins and managers can view another user's activity." });
    }

    await backfillAuditDefaults(client, authUserId, organizationId);

    const [
      orderHasOrg,
      bookingHasOrg,
      stockMovementHasOrg,
      customerHasOrg,
      productHasOrg,
      userHasOrg,
    ] = await Promise.all([
      hasColumn(client, "order", "organizationId"),
      hasColumn(client, "booking", "organizationId"),
      hasColumn(client, "stockMovement", "organizationId"),
      hasColumn(client, "customer", "organizationId"),
      hasColumn(client, "product", "organizationId"),
      hasColumn(client, "user", "organizationId"),
    ]);

    const targetUserParams = userHasOrg ? [targetUserId, organizationId] : [targetUserId];
    const targetUserRes = await client.query(
      `SELECT id
       FROM "user"
       WHERE id = $1${userHasOrg ? ` AND "organizationId" = $2` : ""}
       LIMIT 1`,
      targetUserParams
    );
    if (targetUserRes.rowCount === 0) {
      return json(event, 404, { error: "User not found." });
    }

    const activityLimitRaw = Number(event.queryStringParameters?.limit || 18);
    const activityLimit = Number.isFinite(activityLimitRaw)
      ? Math.max(6, Math.min(60, Math.round(activityLimitRaw)))
      : 18;

    const orderOrgFilter = orderHasOrg ? `AND o."organizationId" = $2` : "";
    const bookingOrgFilter = bookingHasOrg ? `AND b."organizationId" = $2` : "";
    const stockMovementOrgFilter = stockMovementHasOrg ? `AND sm."organizationId" = $2` : "";
    const orderUserJoinOrg = orderHasOrg && userHasOrg ? `AND assignee."organizationId" = o."organizationId"` : "";
    const orderUpdaterJoinOrg = orderHasOrg && userHasOrg ? `AND updater."organizationId" = o."organizationId"` : "";
    const orderCreatorJoinOrg = orderHasOrg && userHasOrg ? `AND creator."organizationId" = o."organizationId"` : "";
    const bookingUserJoinOrg = bookingHasOrg && userHasOrg ? `AND assignee."organizationId" = b."organizationId"` : "";
    const bookingUpdaterJoinOrg = bookingHasOrg && userHasOrg ? `AND updater."organizationId" = b."organizationId"` : "";
    const bookingCreatorJoinOrg = bookingHasOrg && userHasOrg ? `AND creator."organizationId" = b."organizationId"` : "";
    const bookingCustomerJoinOrg = bookingHasOrg && customerHasOrg ? `AND c."organizationId" = b."organizationId"` : "";
    const stockProductJoinOrg = stockMovementHasOrg && productHasOrg ? `AND p."organizationId" = sm."organizationId"` : "";

    const orderDetailsPromise = activityScope === "team"
      ? client.query(
        `SELECT
           o.id,
           o."orderNumber",
           o."customerName",
           o.status,
           o."total_amount",
           o."subtotalCents",
           o."deliveryFeeCents",
           o."grandTotalCents",
           o."deliveryMethod",
           o."deliveryDetails",
           o."orderDate",
           o."deliveryDate",
           o."lastModifiedAt",
           o."assignedUserId",
           o."createdByUserId",
           o."updatedByUserId",
           assignee."fullName" AS "assignedUserName",
           creator."fullName" AS "createdByName",
           updater."fullName" AS "updatedByName"
         FROM "order" o
         LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId" ${orderUserJoinOrg}
         LEFT JOIN "user" creator ON creator.id = o."createdByUserId" ${orderCreatorJoinOrg}
         LEFT JOIN "user" updater ON updater.id = o."updatedByUserId" ${orderUpdaterJoinOrg}
         ${orderHasOrg ? `WHERE o."organizationId" = $1` : ""}
         ORDER BY o."lastModifiedAt" DESC NULLS LAST, o."orderDate" DESC, o."id" DESC
         LIMIT $${orderHasOrg ? 2 : 1}`,
        orderHasOrg ? [organizationId, activityLimit] : [activityLimit]
      )
      : client.query(
        `SELECT
           o.id,
           o."orderNumber",
           o."customerName",
           o.status,
           o."total_amount",
           o."subtotalCents",
           o."deliveryFeeCents",
           o."grandTotalCents",
           o."deliveryMethod",
           o."deliveryDetails",
           o."orderDate",
           o."deliveryDate",
           o."lastModifiedAt",
           o."assignedUserId",
           o."createdByUserId",
           o."updatedByUserId",
           assignee."fullName" AS "assignedUserName",
           creator."fullName" AS "createdByName",
           updater."fullName" AS "updatedByName"
         FROM "order" o
         LEFT JOIN "user" assignee ON assignee.id = o."assignedUserId" ${orderUserJoinOrg}
         LEFT JOIN "user" creator ON creator.id = o."createdByUserId" ${orderCreatorJoinOrg}
         LEFT JOIN "user" updater ON updater.id = o."updatedByUserId" ${orderUpdaterJoinOrg}
         WHERE (
           $1 = o."assignedUserId"
           OR $1 = o."createdByUserId"
           OR $1 = o."updatedByUserId"
         )
         ${orderOrgFilter}
         ORDER BY o."lastModifiedAt" DESC NULLS LAST, o."orderDate" DESC, o."id" DESC`,
        orderHasOrg ? [targetUserId, organizationId] : [targetUserId]
      );

    const basePromises = [
      orderDetailsPromise,
      activityScope === "team"
        ? client.query(
          `SELECT
             COUNT(*)::int AS bookings,
             COALESCE(SUM(b."totalAmount"), 0) AS revenue_cents
           FROM "booking" b
           ${bookingHasOrg ? `WHERE b."organizationId" = $1` : ""}`,
          bookingHasOrg ? [organizationId] : []
        )
        : client.query(
          `SELECT
             COUNT(*)::int AS bookings,
             COALESCE(SUM(b."totalAmount"), 0) AS revenue_cents
           FROM "booking" b
           WHERE (
             $1 = b."assignedUserId"
             OR $1 = b."createdByUserId"
             OR $1 = b."updatedByUserId"
           )
           ${bookingOrgFilter}`,
          bookingHasOrg ? [targetUserId, organizationId] : [targetUserId]
        ),
      activityScope === "team"
        ? client.query(
          `SELECT COALESCE(COUNT(*), 0)::int AS movements
           FROM "stockMovement" sm
           ${stockMovementHasOrg ? `WHERE sm."organizationId" = $1` : ""}`,
          stockMovementHasOrg ? [organizationId] : []
        )
        : client.query(
          `SELECT COALESCE(COUNT(*), 0)::int AS movements
           FROM "stockMovement" sm
           WHERE $1 = sm."performedByUserId"
           ${stockMovementOrgFilter}`,
          stockMovementHasOrg ? [targetUserId, organizationId] : [targetUserId]
        ),
    ];

    const detailPromises = shouldIncludeDetails
      ? [
          activityScope === "team"
            ? client.query(
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
               JOIN "customer" c ON c.id = b."customerId" ${bookingCustomerJoinOrg}
               LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId" ${bookingUserJoinOrg}
               LEFT JOIN "user" updater ON updater.id = b."updatedByUserId" ${bookingUpdaterJoinOrg}
               LEFT JOIN "user" creator ON creator.id = b."createdByUserId" ${bookingCreatorJoinOrg}
               ${bookingHasOrg ? `WHERE b."organizationId" = $1` : ""}
               ORDER BY b."lastModifiedAt" DESC NULLS LAST, b."eventDate" DESC, b."id" DESC
               LIMIT $${bookingHasOrg ? 2 : 1}`,
              bookingHasOrg ? [organizationId, activityLimit] : [activityLimit]
            )
            : client.query(
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
               JOIN "customer" c ON c.id = b."customerId" ${bookingCustomerJoinOrg}
               LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId" ${bookingUserJoinOrg}
               LEFT JOIN "user" updater ON updater.id = b."updatedByUserId" ${bookingUpdaterJoinOrg}
               LEFT JOIN "user" creator ON creator.id = b."createdByUserId" ${bookingCreatorJoinOrg}
               WHERE (
                 $1 = b."assignedUserId"
                 OR $1 = b."createdByUserId"
                 OR $1 = b."updatedByUserId"
               )
               ${bookingOrgFilter}
               ORDER BY b."lastModifiedAt" DESC NULLS LAST, b."eventDate" DESC, b."id" DESC`,
              bookingHasOrg ? [targetUserId, organizationId] : [targetUserId]
            ),
          activityScope === "team"
            ? client.query(
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
               LEFT JOIN "product" p ON p.id = sm."productId" ${stockProductJoinOrg}
               ${stockMovementHasOrg ? `WHERE sm."organizationId" = $1` : ""}
               ORDER BY sm.date DESC NULLS LAST, sm.id DESC
               LIMIT $${stockMovementHasOrg ? 2 : 1}`,
              stockMovementHasOrg ? [organizationId, activityLimit] : [activityLimit]
            )
            : client.query(
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
               LEFT JOIN "product" p ON p.id = sm."productId" ${stockProductJoinOrg}
               WHERE $1 = sm."performedByUserId"
               ${stockMovementOrgFilter}
               ORDER BY sm.date DESC NULLS LAST, sm.id DESC`,
              stockMovementHasOrg ? [targetUserId, organizationId] : [targetUserId]
            ),
        ]
      : [];

    const results = await Promise.all([...basePromises, ...detailPromises]);
    const [orderDetails, bookingRows, stockRows, bookingDetails, stockDetails] = results;
    const orderRows = orderDetails?.rows || [];
    let orderRevenueCents = 0;
    const orderDetailList = orderRows.map((row) => {
      const totalCents = Number(row.grandTotalCents ?? row.total_amount ?? 0);
      const feeCents = Number(row.deliveryFeeCents || 0);
      const itemsTotalCents = Number(
        row.subtotalCents ?? Math.max(0, totalCents - feeCents)
      );
      const distanceKm = getRecordedDeliveryDistanceKm(
        row.deliveryMethod,
        row.deliveryDetails
      );
      orderRevenueCents += totalCents;
      return {
        ...row,
        itemsTotal: itemsTotalCents / 100,
        deliveryFee: feeCents / 100,
        deliveryFeeCents: feeCents,
        deliveryDistanceKm: distanceKm || 0,
        total: totalCents / 100,
      };
    });

    return json(event, 200, {
      userId: targetUserId,
      orders: orderRows.length,
      orderRevenue: orderRevenueCents / 100,
      bookings: Number(bookingRows.rows[0]?.bookings || 0),
      bookingRevenue: Number(bookingRows.rows[0]?.revenue_cents || 0) / 100,
      stockMovements: Number(stockRows.rows[0]?.movements || 0),
      scope: activityScope,
      details: shouldIncludeDetails
        ? {
            orders: orderDetailList,
            bookings: bookingDetails?.rows || [],
            stockMovements: stockDetails?.rows || [],
          }
        : undefined,
    });
  } catch (err) {
    console.error("userStats error:", err);
    return json(event, 500, { error: "Failed to fetch user stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
