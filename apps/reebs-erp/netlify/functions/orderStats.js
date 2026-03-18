/* eslint-disable no-undef */
// Filename: orderStats.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";

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

export async function handler() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureProductStatusColumns(client);

    const windowDays = 30;
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = now.getFullYear() + (nextQuarter === 0 ? 1 : 0);
    const nextQuarterStartMonth = nextQuarter * 3; // 0,3,6,9
    const nextQuarterStart = new Date(Date.UTC(nextQuarterYear, nextQuarterStartMonth, 1));
    const nextQuarterEnd = new Date(Date.UTC(nextQuarterYear, nextQuarterStartMonth + 3, 1));
    const nextQuarterLabel = `Q${nextQuarter + 1} ${nextQuarterYear}`;
    const [
      orderSummary,
      unitsSummary,
      topProducts,
      conflictRows,
      topRentalRows,
      bookingSummary,
      lowStockRows,
      expenseSummary,
      expenseTotalSummary,
      maintenanceOpenSummary,
      maintenanceCostSummary,
      deliveryFeeRows,
      inventoryRes,
      retailRes,
      rentalRes,
      categoryRes,
      velocityRes,
    ] = await Promise.all([
      client.query(
        `SELECT
           COUNT(*)::int AS orders,
           COALESCE(SUM(total_amount), 0) AS revenue_cents
         FROM "order"
         WHERE "orderDate" >= NOW() - INTERVAL '${windowDays} days'`
      ),
      client.query(
        `SELECT COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         WHERE o."orderDate" >= NOW() - INTERVAL '${windowDays} days'`
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           SUM(oi.quantity)::int AS units
         FROM "orderItem" oi
         JOIN "order" o ON o.id = oi."orderId"
         JOIN "product" p ON p.id = oi."productId"
         WHERE o."orderDate" >= NOW() - INTERVAL '${windowDays} days'
         GROUP BY p.id, p.name, p.sku
        ORDER BY units DESC
        LIMIT 5`
      ),
      client.query(
        `SELECT
           bi."productId" AS product_id,
           p.name AS product_name,
           p.stock AS product_stock,
           b."eventDate"::date AS event_date,
           SUM(bi.quantity) AS total_quantity,
           ARRAY_AGG(b.id) AS booking_ids
         FROM "bookingItem" bi
         JOIN "booking" b ON b.id = bi."bookingId"
         JOIN "product" p ON p.id = bi."productId"
        WHERE COALESCE(b.status, '') NOT ILIKE 'cancelled'
        GROUP BY bi."productId", p.name, p.stock, b."eventDate"::date
        HAVING SUM(bi.quantity) > COALESCE(p.stock, 0)
        ORDER BY b."eventDate"::date ASC`
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
         JOIN "product" p ON p.id = bi."productId"
         WHERE b.status ILIKE 'confirmed'
          AND b."eventDate" >= NOW() - INTERVAL '${windowDays} days'
        GROUP BY p.id, p.name, p.sku
        ORDER BY revenue_cents DESC
        LIMIT 3`
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS bookings,
           COALESCE(SUM("totalAmount"), 0) AS revenue_cents
         FROM "booking"
         WHERE "eventDate" >= NOW() - INTERVAL '${windowDays} days'
           AND COALESCE(status, '') NOT ILIKE 'cancelled'`
      ),
      client.query(
        `SELECT
           id,
           name,
           sku,
           COALESCE(stock, 0)::int AS stock,
           COALESCE("reorderLevel", 2)::int AS "reorderLevel",
           COALESCE("reorderQuantity", 0)::int AS "reorderQuantity"
         FROM "product"
         WHERE COALESCE(stock, 0) <= COALESCE("reorderLevel", 2)
           AND COALESCE("isArchived", false) = false
           AND COALESCE("isDeleted", false) = false
         ORDER BY stock ASC, name ASC
         LIMIT 6`
      ),
      client.query(
        `SELECT COALESCE(SUM(amount), 0) AS expense_cents
         FROM "expense"
         WHERE date >= NOW() - INTERVAL '${windowDays} days'`
      ),
      client.query(`SELECT COALESCE(SUM(amount), 0) AS expense_cents FROM "expense"`),
      client.query(
        `SELECT COUNT(*)::int AS open_count
         FROM "maintenanceLog"
         WHERE LOWER(status) = 'open'`
      ),
      client.query(
        `SELECT COALESCE(SUM(cost), 0) AS cost_cents
         FROM "maintenanceLog"
         WHERE "createdAt" >= NOW() - INTERVAL '${windowDays} days'`
      ),
      client.query(
        `SELECT "deliveryMethod", "deliveryDetails"
         FROM "order"
         WHERE "orderDate" >= NOW() - INTERVAL '${windowDays} days'`
      ),
      client.query(
        `SELECT COALESCE(SUM(stock * price), 0) AS inventory_value_cents
         FROM "product"`
      ),
      client.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS retail_cents
         FROM "order"`
      ),
      client.query(
        `SELECT COALESCE(SUM("totalAmount"), 0) AS rental_cents
         FROM "booking"`
      ),
      client.query(
        `SELECT COALESCE("specificCategory", 'Uncategorized') AS category,
                COUNT(*)::int AS count
         FROM "product"
         GROUP BY COALESCE("specificCategory", 'Uncategorized')
         ORDER BY count DESC`
      ),
      client.query(
        `SELECT
           to_char(date_trunc('month', "date"), 'Mon YYYY') AS label,
           SUM(CASE WHEN "type" = 'StockIn' THEN quantity ELSE 0 END)::int AS stock_in,
           SUM(CASE WHEN "type" = 'StockOut' THEN quantity ELSE 0 END)::int AS stock_out
         FROM "stockMovement"
         WHERE "date" >= (CURRENT_DATE - INTERVAL '6 months')
         GROUP BY date_trunc('month', "date")
         ORDER BY date_trunc('month', "date") ASC`
      ),
    ]);

    const orders = orderSummary.rows[0]?.orders || 0;
    const deliveryFeeCents = (deliveryFeeRows.rows || []).reduce((sum, row) => {
      const { feeCents } = getDeliveryFeeDetails(row.deliveryMethod, row.deliveryDetails);
      return sum + feeCents;
    }, 0);
    const revenueCents = Number(orderSummary.rows[0]?.revenue_cents || 0) + deliveryFeeCents;
    const units = unitsSummary.rows[0]?.units || 0;
    const bookings = bookingSummary.rows[0]?.bookings || 0;
    const bookingRevenueCents = Number(bookingSummary.rows[0]?.revenue_cents || 0);
    const expenseWindowCents = Number(expenseSummary.rows[0]?.expense_cents || 0);
    const expenseTotalCents = Number(expenseTotalSummary.rows[0]?.expense_cents || 0);
    const expenseCents = expenseWindowCents > 0 ? expenseWindowCents : expenseTotalCents;
    const expenseWindowLabel =
      expenseWindowCents > 0 || expenseTotalCents === 0 ? `Last ${windowDays} days` : "All time";
    const maintenanceOpen = maintenanceOpenSummary.rows[0]?.open_count || 0;
    const maintenanceCostCents = Number(maintenanceCostSummary.rows[0]?.cost_cents || 0);
    const inventoryValue = Number(inventoryRes.rows[0]?.inventory_value_cents || 0) / 100;
    const retailRevenue = Number(retailRes.rows[0]?.retail_cents || 0) / 100;
    const rentalRevenue = Number(rentalRes.rows[0]?.rental_cents || 0) / 100;
    const categories = (categoryRes.rows || []).map((row) => ({
      category: row.category,
      count: Number(row.count || 0),
    }));
    const velocity = (velocityRes.rows || []).map((row) => ({
      label: row.label,
      stockIn: Number(row.stock_in || 0),
      stockOut: Number(row.stock_out || 0),
    }));

    let lockedInCents = 0;
    try {
      const lockedInNextQuarter = await client.query(
        `SELECT COALESCE(SUM("totalAmount"), 0) AS locked_in_cents
         FROM "booking"
         WHERE status ILIKE 'confirmed'
           AND "eventDate" >= $1
           AND "eventDate" < $2`,
        [nextQuarterStart.toISOString(), nextQuarterEnd.toISOString()]
      );
      lockedInCents = Number(lockedInNextQuarter.rows[0]?.locked_in_cents || 0);
    } catch (err) {
      console.warn("Locked-in projection query failed:", err?.message || err);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        windowDays,
        orders,
        revenue: revenueCents / 100,
        units,
        bookings,
        bookingRevenue: bookingRevenueCents / 100,
        operatingExpenses: expenseCents / 100,
        operatingExpensesWindow: expenseWindowCents / 100,
        operatingExpensesTotal: expenseTotalCents / 100,
        expenseWindowLabel,
        maintenanceOpen,
        maintenanceCost: maintenanceCostCents / 100,
        lowStockCount: lowStockRows.rows?.length || 0,
        lowStockItems: lowStockRows.rows || [],
        inventoryValue,
        retailRevenue,
        rentalRevenue,
        categories,
        velocity,
        topRentalBookings: (topRentalRows.rows || []).map((row) => ({
          id: row.id,
          name: row.name,
          sku: row.sku,
          revenue: Number(row.revenue_cents || 0) / 100,
          units: row.units || 0,
        })),
        lockedInNextQuarter: lockedInCents / 100,
        nextQuarterLabel,
        conflicts: conflictRows?.rows || [],
        topProducts: topProducts.rows || [],
      }),
    };
  } catch (err) {
    console.error("❌ Database error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch order stats" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
