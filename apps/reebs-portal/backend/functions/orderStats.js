import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { withReebsAnalyticsScope } from "@faako/api-contracts/reebs";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { requirePermission } from "./_shared/internalApi.js";
import { buildExpenseFilter } from "./_shared/expenseAccounting.js";

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

const runSequentially = async (operations = []) => {
  const results = [];
  for (const operation of operations) {
    results.push(await operation());
  }
  return results;
};

// Exported so it can be unit-tested without a DB connection.
export const getStatsWindowRange = (windowKey = "30d") => {
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
    const hasBookingId = expenseColumns.includes("bookingId");
    const { whereClause, params } = buildExpenseFilter({
      hasOrganizationId: hasExpenseOrg,
      organizationId,
      startDate,
      endDate,
      dateExpression: "\"date\"",
    });

    // Exclude expenses linked to bookings — those are billed back to the customer
    const bookingFilter = hasBookingId ? `${whereClause ? "AND" : "WHERE"} "bookingId" IS NULL` : "";

    const expenseRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS expense_cents
       FROM ${expenseTable.queryRef}
       ${whereClause}
       ${bookingFilter}`,
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

    const internal = await requirePermission(client, event, "financials:read", {
      methods: "GET,OPTIONS",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const organizationId = Number(internal.organizationId);
    const requestedWindow =
      event.queryStringParameters?.period ||
      event.queryStringParameters?.window ||
      "30d";
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

    // All organizationId columns are present in every table — schema is stable.
    const orderHasOrg = true;
    const bookingHasOrg = true;
    const productHasOrg = true;
    const stockMovementHasOrg = true;
    const maintenanceHasOrg = true;
    const expenseTable = { schema: "public", tableName: "expense", queryRef: '"public"."expense"', label: "public.expense" };
    const expenseColumns = ["id", "organizationId", "category", "amount", "description", "date", "userId", "orderId", "bookingId", "createdAt", "updatedAt"];

    const orderParams = orderHasOrg
      ? [windowStartIso, windowEndIso, organizationId]
      : [windowStartIso, windowEndIso];
    const bookingParams = bookingHasOrg
      ? [windowStartIso, windowEndIso, organizationId]
      : [windowStartIso, windowEndIso];
    const orderOrgFilter = orderHasOrg ? `AND o."organizationId" = $3` : "";
    const orderRecognitionFilter = `
      AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'refunded')
      AND NOT EXISTS (
        SELECT 1
        FROM "orderItem" scoped_oi
        JOIN "product" scoped_p ON scoped_p.id = scoped_oi."productId"
        WHERE scoped_oi."orderId" = o.id
          AND scoped_oi."organizationId" = o."organizationId"
          AND UPPER(COALESCE(scoped_p."sourceCategoryCode", '')) = 'WATER'
      )`;
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
      AND UPPER(COALESCE(p."sourceCategoryCode", '')) <> 'WATER'
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
      inventoryRes,
      categoryRes,
      velocityRes,
      operatingExpensesWindowCents,
      operatingExpensesTotalCents,
      maintenanceCostCents,
    ] = await runSequentially([
      () => client.query(
        `SELECT
           COUNT(*)::int AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue_cents,
           COALESCE(SUM(
             CASE WHEN o."deliveryMethod" = 'delivery'
             THEN COALESCE(o."deliveryFeeCents", 0)
             ELSE 0 END
           ), 0) AS delivery_fee_cents
         FROM "order" o
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
           ${orderRecognitionFilter}`,
        orderParams
      ),
      () => client.query(
        `SELECT COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
           ${orderRecognitionFilter}`,
        orderParams
      ),
      () => client.query(
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
           ${orderRecognitionFilter}
         GROUP BY p.id, p.name, p.sku
         ORDER BY units DESC
         LIMIT 5`,
        orderParams
      ),
      () => client.query(
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
      () => client.query(
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
      () => client.query(
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
      () => client.query(
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
      () => client.query(
        `SELECT COUNT(*)::int AS open_count
         FROM "maintenanceLog"
         WHERE LOWER(COALESCE(status, '')) = 'open'
           ${maintenanceOpenOrgFilter}`,
        maintenanceOpenParams
      ),
      () => client.query(
        `SELECT COALESCE(SUM(COALESCE(p.stock, 0) * COALESCE(p."purchasePriceGhs", 0)), 0) AS inventory_value_cents
         FROM "product" p
         WHERE ${productBaseFilter}`,
        productParams
      ),
      () => client.query(
        `SELECT
           COALESCE(p."specificCategory", 'Uncategorized') AS category,
           COUNT(*)::int AS count
         FROM "product" p
         WHERE ${productBaseFilter}
         GROUP BY COALESCE(p."specificCategory", 'Uncategorized')
         ORDER BY count DESC`,
        productParams
      ),
      () => client.query(
        `SELECT
           to_char(date_trunc('month', sm."date"), 'Mon YYYY') AS label,
           SUM(CASE WHEN sm."type" = 'StockIn' THEN sm.quantity ELSE 0 END)::int AS stock_in,
           SUM(CASE WHEN sm."type" = 'StockOut' THEN sm.quantity ELSE 0 END)::int AS stock_out
         FROM "stockMovement" sm
         JOIN "product" p
           ON p.id = sm."productId"
          AND p."organizationId" = sm."organizationId"
         WHERE sm."date" >= $1
           ${velocityOrgFilter}
           AND UPPER(COALESCE(p."sourceCategoryCode", '')) <> 'WATER'
         GROUP BY date_trunc('month', sm."date")
         ORDER BY date_trunc('month', sm."date") ASC`,
        velocityParams
      ),
      () => getOperatingExpenseTotalCents({
        client,
        expenseTable,
        expenseColumns,
        maintenanceHasOrg,
        organizationId,
        startDate: windowStart,
        endDate: now,
      }),
      () => getOperatingExpenseTotalCents({
        client,
        expenseTable,
        expenseColumns,
        maintenanceHasOrg,
        organizationId,
        startDate: allTimeStart,
        endDate: allTimeEnd,
      }),
      () => getMaintenanceExpenseCents({
        client,
        maintenanceHasOrg,
        organizationId,
        startDate: windowStart,
        endDate: now,
      }),
    ]);

    const orders = Number(orderSummary.rows[0]?.orders || 0);
    const deliveryFeeCents = Number(orderSummary.rows[0]?.delivery_fee_cents || 0);
    const revenueCents = Number(orderSummary.rows[0]?.revenue_cents || 0);
    const units = Number(unitsSummary.rows[0]?.units || 0);
    const bookings = Number(bookingSummary.rows[0]?.bookings || 0);
    const bookingRevenueCents = Number(bookingSummary.rows[0]?.revenue_cents || 0);
    const maintenanceOpen = Number(maintenanceOpenSummary.rows[0]?.open_count || 0);

    const lowStockItems = (lowStockRows.rows || []).map((row) => {
      const item = { ...row };
      delete item.total_count;
      return item;
    });
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

    return json(event, 200, withReebsAnalyticsScope({
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
      deliveryFees: deliveryFeeCents / 100,
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
    }));
  } catch (err) {
    console.error("Failed to fetch order stats:", err);
    return json(event, 500, { error: "Failed to fetch order stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
