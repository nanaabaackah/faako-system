/* eslint-disable no-undef */
// Filename: orderStats.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  buildExpenseFilter,
  resolveExpenseColumns,
  resolveExpenseTable,
} from "./_shared/expenseAccounting.js";

const statusColumnStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER DEFAULT 2`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "reorderQuantity" INTEGER DEFAULT 0`,
];

const ensureProductStatusColumns = async (client) => {
  for (const statement of statusColumnStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Product status column check failed:", err?.message || err);
    }
  }
};

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

const getStatsWindowRange = (windowKey = "30d") => {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  switch (String(windowKey || "").trim().toLowerCase()) {
    case "today":
      return {
        key: "today",
        start: startOfToday,
        end: now,
        label: "Today",
        days: 1,
      };
    case "7d":
    case "7days":
    case "last7days":
      return {
        key: "7d",
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
        label: "Last 7 days",
        days: 7,
      };
    case "thismonth":
      return {
        key: "thisMonth",
        start: startOfMonth,
        end: now,
        label: "This month",
        days: Math.max(1, Math.ceil((now.getTime() - startOfMonth.getTime()) / (24 * 60 * 60 * 1000))),
      };
    case "30d":
    case "30days":
    case "last30days":
    default:
      return {
        key: "30d",
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
        label: "Last 30 days",
        days: 30,
      };
  }
};

const getOperatingExpenseTotalCents = async ({
  client,
  expenseTable,
  expenseColumns,
  maintenanceHasOrg,
  organizationId,
  startDate,
  endDate,
}) => {
  let totalCents = 0;

  if (expenseTable) {
    const hasExpenseOrg = expenseColumns.includes("organizationId");
    const { whereClause, params } = buildExpenseFilter({
      hasOrganizationId: hasExpenseOrg,
      organizationId,
      startDate,
      endDate,
      dateExpression: "\"date\"",
    });

    const expenseRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS expense_cents
       FROM ${expenseTable.queryRef}
       ${whereClause}`,
      params
    );

    totalCents += Number(expenseRes.rows[0]?.expense_cents || 0);
  }

  try {
    const maintenanceParams = [startDate.toISOString(), endDate.toISOString()];
    const maintenanceConditions = [
      `LOWER(COALESCE(m.status, '')) IN ('open', 'resolved', 'accepted')`,
      `COALESCE(m."resolvedAt", m."createdAt") >= $1`,
      `COALESCE(m."resolvedAt", m."createdAt") < $2`,
    ];
    if (maintenanceHasOrg) {
      maintenanceParams.push(organizationId);
      maintenanceConditions.push(`m."organizationId" = $${maintenanceParams.length}`);
    }

    const maintenanceRes = await client.query(
      `SELECT COALESCE(SUM(m.cost), 0) AS expense_cents
       FROM "maintenanceLog" m
       WHERE ${maintenanceConditions.join(" AND ")}`,
      maintenanceParams
    );

    totalCents += Number(maintenanceRes.rows[0]?.expense_cents || 0);
  } catch (err) {
    console.warn("Maintenance expense rollup failed:", err?.message || err);
  }

  return totalCents;
};

const getMaintenanceExpenseCents = async ({
  client,
  maintenanceHasOrg,
  organizationId,
  startDate,
  endDate,
}) => {
  try {
    const params = [startDate.toISOString(), endDate.toISOString()];
    const conditions = [
      `LOWER(COALESCE(m.status, '')) IN ('open', 'resolved', 'accepted')`,
      `COALESCE(m."resolvedAt", m."createdAt") >= $1`,
      `COALESCE(m."resolvedAt", m."createdAt") < $2`,
    ];
    if (maintenanceHasOrg) {
      params.push(organizationId);
      conditions.push(`m."organizationId" = $${params.length}`);
    }

    const result = await client.query(
      `SELECT COALESCE(SUM(m.cost), 0) AS maintenance_cents
       FROM "maintenanceLog" m
       WHERE ${conditions.join(" AND ")}`,
      params
    );

    return Number(result.rows[0]?.maintenance_cents || 0);
  } catch (err) {
    console.warn("Maintenance KPI query failed:", err?.message || err);
    return 0;
  }
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, "");
  }

  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureProductStatusColumns(client);

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(event, 401, { error: "Unauthorized" });
    }

    const organizationId = Number(authUser.organizationId);
    const requestedWindow = event.queryStringParameters?.window || "30d";
    const { start: windowStart, end: now, label: windowLabel, days: windowDays } =
      getStatsWindowRange(requestedWindow);
    const windowStartIso = windowStart.toISOString();
    const windowEndIso = now.toISOString();
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const allTimeStart = new Date(Date.UTC(2000, 0, 1));
    const allTimeEnd = new Date(Date.UTC(2100, 0, 1));

    const currentQuarter = Math.floor(now.getMonth() / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = now.getFullYear() + (nextQuarter === 0 ? 1 : 0);
    const nextQuarterStartMonth = nextQuarter * 3;
    const nextQuarterStart = new Date(Date.UTC(nextQuarterYear, nextQuarterStartMonth, 1));
    const nextQuarterEnd = new Date(Date.UTC(nextQuarterYear, nextQuarterStartMonth + 3, 1));
    const nextQuarterLabel = `Q${nextQuarter + 1} ${nextQuarterYear}`;

    const [
      orderHasOrg,
      bookingHasOrg,
      productHasOrg,
      stockMovementHasOrg,
      maintenanceHasOrg,
      expenseTable,
    ] = await Promise.all([
      hasColumn(client, "order", "organizationId"),
      hasColumn(client, "booking", "organizationId"),
      hasColumn(client, "product", "organizationId"),
      hasColumn(client, "stockMovement", "organizationId"),
      hasColumn(client, "maintenanceLog", "organizationId"),
      resolveExpenseTable(client),
    ]);
    const expenseColumns = expenseTable ? await resolveExpenseColumns(client, expenseTable) : [];

    const orderParams = orderHasOrg
      ? [windowStartIso, windowEndIso, organizationId]
      : [windowStartIso, windowEndIso];
    const bookingParams = bookingHasOrg
      ? [windowStartIso, windowEndIso, organizationId]
      : [windowStartIso, windowEndIso];
    const orderOrgFilter = orderHasOrg ? `AND o."organizationId" = $3` : "";
    const bookingOrgFilter = bookingHasOrg ? `AND b."organizationId" = $3` : "";
    const orderProductJoin = orderHasOrg && productHasOrg
      ? `AND p."organizationId" = o."organizationId"`
      : "";
    const bookingProductJoin = bookingHasOrg && productHasOrg
      ? `AND p."organizationId" = b."organizationId"`
      : "";

    const productParams = productHasOrg ? [organizationId] : [];
    const productOrgFilter = productHasOrg ? `AND p."organizationId" = $1` : "";
    const productBaseFilter = `
      COALESCE(p."isArchived", false) = false
      AND COALESCE(p."isDeleted", false) = false
      ${productOrgFilter}
    `;

    const conflictParams = bookingHasOrg ? [organizationId] : [];
    const conflictOrgFilter = bookingHasOrg ? `AND b."organizationId" = $1` : "";

    const velocityParams = stockMovementHasOrg
      ? [sixMonthsAgo.toISOString(), organizationId]
      : [sixMonthsAgo.toISOString()];
    const velocityOrgFilter = stockMovementHasOrg ? `AND sm."organizationId" = $2` : "";

    const maintenanceOpenParams = maintenanceHasOrg ? [organizationId] : [];
    const maintenanceOpenOrgFilter = maintenanceHasOrg ? `AND "organizationId" = $1` : "";

    const [
      orderSummary,
      unitsSummary,
      topProducts,
      conflictRows,
      topRentalRows,
      bookingSummary,
      lowStockRows,
      maintenanceOpenSummary,
      deliveryFeeRows,
      inventoryRes,
      categoryRes,
      velocityRes,
      operatingExpensesWindowCents,
      operatingExpensesTotalCents,
      maintenanceCostCents,
    ] = await Promise.all([
      client.query(
        `SELECT
           COUNT(*)::int AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue_cents
         FROM "order" o
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}`,
        orderParams
      ),
      client.query(
        `SELECT COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}`,
        orderParams
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         JOIN "product" p ON p.id = oi."productId" ${orderProductJoin}
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
         GROUP BY p.id, p.name, p.sku
         ORDER BY units DESC
         LIMIT 5`,
        orderParams
      ),
      client.query(
        `SELECT
           bi."productId" AS product_id,
           p.name AS product_name,
           p.stock AS product_stock,
           b."eventDate"::date AS event_date,
           SUM(bi.quantity)::int AS total_quantity,
           ARRAY_AGG(b.id) AS booking_ids
         FROM "bookingItem" bi
         JOIN "booking" b ON b.id = bi."bookingId"
         JOIN "product" p ON p.id = bi."productId" ${bookingProductJoin}
         WHERE LOWER(COALESCE(b.status, '')) NOT IN ('cancelled', 'canceled')
           ${conflictOrgFilter}
         GROUP BY bi."productId", p.name, p.stock, b."eventDate"::date
         HAVING SUM(bi.quantity) > COALESCE(p.stock, 0)
         ORDER BY b."eventDate"::date ASC`,
        conflictParams
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           COALESCE(SUM(bi.quantity), 0)::int AS units,
           COALESCE(SUM(bi.quantity * bi.price), 0) AS revenue_cents
         FROM "booking" b
         JOIN "bookingItem" bi ON bi."bookingId" = b.id
         JOIN "product" p ON p.id = bi."productId" ${bookingProductJoin}
         WHERE LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed')
           AND b."eventDate" >= $1
           AND b."eventDate" < $2
           ${bookingOrgFilter}
         GROUP BY p.id, p.name, p.sku
         ORDER BY revenue_cents DESC
         LIMIT 3`,
        bookingParams
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS bookings,
           COALESCE(SUM(b."totalAmount"), 0) AS revenue_cents
         FROM "booking" b
         WHERE LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed')
           AND b."eventDate" >= $1
           AND b."eventDate" < $2
           ${bookingOrgFilter}`,
        bookingParams
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           COALESCE(p.stock, 0)::int AS stock,
           COALESCE(p."reorderLevel", 3)::int AS "reorderLevel",
           COALESCE(p."reorderQuantity", 0)::int AS "reorderQuantity",
           COUNT(*) OVER()::int AS total_count
         FROM "product" p
         WHERE COALESCE(p.stock, 0) <= COALESCE(p."reorderLevel", 3)
           AND ${productBaseFilter}
         ORDER BY p.stock ASC, p.name ASC
         LIMIT 6`,
        productParams
      ),
      client.query(
        `SELECT COUNT(*)::int AS open_count
         FROM "maintenanceLog"
         WHERE LOWER(COALESCE(status, '')) = 'open'
           ${maintenanceOpenOrgFilter}`,
        maintenanceOpenParams
      ),
      client.query(
        `SELECT o."deliveryMethod", o."deliveryDetails"
         FROM "order" o
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}`,
        orderParams
      ),
      client.query(
        `SELECT COALESCE(SUM(COALESCE(p.stock, 0) * COALESCE(p.price, 0)), 0) AS inventory_value_cents
         FROM "product" p
         WHERE ${productBaseFilter}`,
        productParams
      ),
      client.query(
        `SELECT
           COALESCE(p."specificCategory", 'Uncategorized') AS category,
           COUNT(*)::int AS count
         FROM "product" p
         WHERE ${productBaseFilter}
         GROUP BY COALESCE(p."specificCategory", 'Uncategorized')
         ORDER BY count DESC`,
        productParams
      ),
      client.query(
        `SELECT
           to_char(date_trunc('month', sm."date"), 'Mon YYYY') AS label,
           SUM(CASE WHEN sm."type" = 'StockIn' THEN sm.quantity ELSE 0 END)::int AS stock_in,
           SUM(CASE WHEN sm."type" = 'StockOut' THEN sm.quantity ELSE 0 END)::int AS stock_out
         FROM "stockMovement" sm
         WHERE sm."date" >= $1
           ${velocityOrgFilter}
         GROUP BY date_trunc('month', sm."date")
         ORDER BY date_trunc('month', sm."date") ASC`,
        velocityParams
      ),
      getOperatingExpenseTotalCents({
        client,
        expenseTable,
        expenseColumns,
        maintenanceHasOrg,
        organizationId,
        startDate: windowStart,
        endDate: now,
      }),
      getOperatingExpenseTotalCents({
        client,
        expenseTable,
        expenseColumns,
        maintenanceHasOrg,
        organizationId,
        startDate: allTimeStart,
        endDate: allTimeEnd,
      }),
      getMaintenanceExpenseCents({
        client,
        maintenanceHasOrg,
        organizationId,
        startDate: windowStart,
        endDate: now,
      }),
    ]);

    const orders = Number(orderSummary.rows[0]?.orders || 0);
    const deliveryFeeCents = (deliveryFeeRows.rows || []).reduce((sum, row) => {
      const { feeCents } = getDeliveryFeeDetails(row.deliveryMethod, row.deliveryDetails);
      return sum + feeCents;
    }, 0);
    const revenueCents = Number(orderSummary.rows[0]?.revenue_cents || 0) + deliveryFeeCents;
    const units = Number(unitsSummary.rows[0]?.units || 0);
    const bookings = Number(bookingSummary.rows[0]?.bookings || 0);
    const bookingRevenueCents = Number(bookingSummary.rows[0]?.revenue_cents || 0);
    const maintenanceOpen = Number(maintenanceOpenSummary.rows[0]?.open_count || 0);

    const lowStockItems = (lowStockRows.rows || []).map(({ total_count, ...row }) => row);
    const lowStockCount = Number(lowStockRows.rows?.[0]?.total_count || 0);

    const inventoryValue = Number(inventoryRes.rows[0]?.inventory_value_cents || 0) / 100;
    const retailRevenue = revenueCents / 100;
    const rentalRevenue = bookingRevenueCents / 100;
    const categories = (categoryRes.rows || []).map((row) => ({
      category: row.category,
      count: Number(row.count || 0),
    }));
    const productCount = categories.reduce((sum, row) => sum + row.count, 0);
    const velocity = (velocityRes.rows || []).map((row) => ({
      label: row.label,
      stockIn: Number(row.stock_in || 0),
      stockOut: Number(row.stock_out || 0),
    }));

    let lockedInCents = 0;
    try {
      const lockedInParams = bookingHasOrg
        ? [nextQuarterStart.toISOString(), nextQuarterEnd.toISOString(), organizationId]
        : [nextQuarterStart.toISOString(), nextQuarterEnd.toISOString()];
      const lockedInOrgFilter = bookingHasOrg ? `AND b."organizationId" = $3` : "";
      const lockedInNextQuarter = await client.query(
        `SELECT COALESCE(SUM(b."totalAmount"), 0) AS locked_in_cents
         FROM "booking" b
         WHERE LOWER(COALESCE(b.status, '')) = 'confirmed'
           AND b."eventDate" >= $1
           AND b."eventDate" < $2
           ${lockedInOrgFilter}`,
        lockedInParams
      );
      lockedInCents = Number(lockedInNextQuarter.rows[0]?.locked_in_cents || 0);
    } catch (err) {
      console.warn("Locked-in projection query failed:", err?.message || err);
    }

    return json(event, 200, {
      windowDays,
      orders,
      revenue: retailRevenue,
      units,
      bookings,
      bookingRevenue: rentalRevenue,
      operatingExpenses: operatingExpensesTotalCents / 100,
      operatingExpensesWindow: operatingExpensesWindowCents / 100,
      operatingExpensesTotal: operatingExpensesTotalCents / 100,
      expenseWindowLabel: windowLabel,
      windowLabel,
      maintenanceOpen,
      maintenanceCost: maintenanceCostCents / 100,
      lowStockCount,
      lowStockItems,
      inventoryValue,
      productCount,
      retailRevenue,
      rentalRevenue,
      categories,
      velocity,
      topRentalBookings: (topRentalRows.rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        revenue: Number(row.revenue_cents || 0) / 100,
        units: Number(row.units || 0),
      })),
      lockedInNextQuarter: lockedInCents / 100,
      nextQuarterLabel,
      conflicts: conflictRows.rows || [],
      topProducts: (topProducts.rows || []).map((row) => ({
        ...row,
        units: Number(row.units || 0),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch order stats:", err);
    return json(event, 500, { error: "Failed to fetch order stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
