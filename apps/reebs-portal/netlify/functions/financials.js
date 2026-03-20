/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { requireUser } from "./_shared/userAuth.js";
import {
  EXPENSE_CATEGORIES,
  buildExpenseFilter,
  normalizeExpenseCategory,
  resolveExpenseColumns,
  resolveExpenseTable,
} from "./_shared/expenseAccounting.js";

const responseHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,OPTIONS",
  }),
});

const json = (event, statusCode, body) => ({
  statusCode,
  headers: responseHeaders(event),
  body: JSON.stringify(body),
});

const getWindowRange = (windowKey = "thisMonth") => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const customYearMatch = /^year(\d{4})$/.exec(windowKey);

  const startOfMonth = (y, m) => new Date(Date.UTC(y, m, 1));
  const endOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 1));
  const startOfQuarter = (y, m) => {
    const q = Math.floor(m / 3) * 3;
    return new Date(Date.UTC(y, q, 1));
  };

  if (customYearMatch) {
    const targetYear = Number(customYearMatch[1]);
    if (Number.isInteger(targetYear)) {
      const start = new Date(Date.UTC(targetYear, 0, 1));
      const end = new Date(Date.UTC(targetYear + 1, 0, 1));
      return { start, end, label: String(targetYear) };
    }
  }

  switch (windowKey) {
    case "lastMonth": {
      const start = startOfMonth(year, month - 1);
      const end = endOfMonth(year, month - 1);
      return { start, end, label: "Last month" };
    }
    case "thisQuarter": {
      const start = startOfQuarter(year, month);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
      return { start, end, label: "This quarter" };
    }
    case "lastQuarter": {
      const start = startOfQuarter(year, month - 3);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
      return { start, end, label: "Last quarter" };
    }
    case "thisYear": {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      return { start, end, label: "This year" };
    }
    case "lastYear": {
      const start = new Date(Date.UTC(year - 1, 0, 1));
      const end = new Date(Date.UTC(year, 0, 1));
      return { start, end, label: "Last year" };
    }
    case "today": {
      const start = new Date(Date.UTC(year, month, now.getUTCDate()));
      const end = new Date(Date.UTC(year, month, now.getUTCDate() + 1));
      return { start, end, label: "Today" };
    }
    case "allTime": {
      const start = new Date(Date.UTC(2000, 0, 1));
      const end = new Date(Date.UTC(2100, 0, 1));
      return { start, end, label: "All time" };
    }
    case "thisMonth":
    default: {
      const start = startOfMonth(year, month);
      const end = endOfMonth(year, month);
      return { start, end, label: "This month" };
    }
  }
};

const ensureOrderColumns = async (client) => {
  const statements = [
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryDetails" JSONB`,
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pickupDetails" JSONB`,
  ];
  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Order column check failed:", err?.message || err);
    }
  }
};

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

const normalizeSku = (sku) => (typeof sku === "string" ? sku.trim().toUpperCase() : "");

const buildExpenseBreakdown = async ({ client, start, end, organizationId }) => {
  const table = await resolveExpenseTable(client);
  if (!table) {
    return {
      totalCents: 0,
      breakdown: [],
      tableLabel: null,
      hasOrganizationId: false,
    };
  }

  const columns = await resolveExpenseColumns(client, table);
  const hasOrganizationId = columns.includes("organizationId");
  const expenseTotals = new Map();

  const { whereClause, params } = buildExpenseFilter({
    hasOrganizationId,
    organizationId,
    startDate: start,
    endDate: end,
    dateExpression: "\"date\"",
  });

  const expenseRows = await client.query(
    `SELECT category, COALESCE(SUM(amount), 0) AS expense_cents
     FROM ${table.queryRef}
     ${whereClause}
     GROUP BY category`,
    params
  );

  for (const row of expenseRows.rows || []) {
    const category = normalizeExpenseCategory(row.category) || "Operational";
    const cents = Number(row.expense_cents || 0);
    if (!Number.isFinite(cents) || cents === 0) continue;
    expenseTotals.set(category, (expenseTotals.get(category) || 0) + cents);
  }

  try {
    const maintenanceHasOrg = await hasColumn(client, "maintenanceLog", "organizationId");
    const maintenanceParams = [start.toISOString(), end.toISOString()];
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
      `SELECT COALESCE(SUM(m.cost), 0) AS maintenance_cents
       FROM "maintenanceLog" m
       WHERE ${maintenanceConditions.join(" AND ")}`,
      maintenanceParams
    );

    const maintenanceCents = Number(maintenanceRes.rows[0]?.maintenance_cents || 0);
    if (Number.isFinite(maintenanceCents) && maintenanceCents > 0) {
      const maintenanceCategory = "Maintenance";
      expenseTotals.set(
        maintenanceCategory,
        (expenseTotals.get(maintenanceCategory) || 0) + maintenanceCents
      );
    }
  } catch (err) {
    console.warn("Maintenance expense rollup failed:", err?.message || err);
  }

  const orderedCategories = [
    ...EXPENSE_CATEGORIES,
    ...Array.from(expenseTotals.keys())
      .filter((category) => !EXPENSE_CATEGORIES.includes(category))
      .sort((a, b) => a.localeCompare(b)),
  ];

  const breakdown = orderedCategories
    .map((category) => ({
      category,
      amount: (expenseTotals.get(category) || 0) / 100,
    }))
    .filter((entry) => entry.amount > 0);

  const totalCents = breakdown.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);

  return {
    totalCents,
    breakdown,
    tableLabel: table.label,
    hasOrganizationId,
  };
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: responseHeaders(event), body: "" };
  }

  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  const windowKey = (event.queryStringParameters?.window || "thisMonth").trim();
  const { start, end, label } = getWindowRange(windowKey);

  try {
    await client.connect();

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(event, 401, { error: "Unauthorized" });
    }

    const organizationId = Number(authUser.organizationId);
    await ensureOrderColumns(client);

    const [orderHasOrg, bookingHasOrg] = await Promise.all([
      hasColumn(client, "order", "organizationId"),
      hasColumn(client, "booking", "organizationId"),
    ]);

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const orderParams = orderHasOrg ? [startIso, endIso, organizationId] : [startIso, endIso];
    const bookingParams = bookingHasOrg ? [startIso, endIso, organizationId] : [startIso, endIso];
    const orderOrgFilter = orderHasOrg ? `AND o."organizationId" = $3` : "";
    const bookingOrgFilter = bookingHasOrg ? `AND b."organizationId" = $3` : "";

    const [
      summary,
      topRows,
      cashflowRows,
      deliveryFeeRows,
      skuRows,
      transactionRows,
      bookingSummary,
      bookingDaily,
      topRentalRows,
      expenseSummary,
    ] = await Promise.all([
      client.query(
        `SELECT
           COALESCE((
             SELECT COUNT(*)
             FROM "order" o
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
           ), 0)::int AS orders,
           COALESCE((
             SELECT SUM(o.total_amount)
             FROM "order" o
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
           ), 0) AS revenue_cents,
           COALESCE((
             SELECT SUM(oi.quantity)
             FROM "order" o
             JOIN "orderItem" oi ON oi."orderId" = o.id
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
           ), 0)::int AS units,
           COALESCE((
             SELECT SUM(oi.quantity * COALESCE(p."purchasePriceGhs", 0))
             FROM "order" o
             JOIN "orderItem" oi ON oi."orderId" = o.id
             JOIN "product" p ON p.id = oi."productId"
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
           ), 0) AS cost_cents`,
        orderParams
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           COALESCE(SUM(oi.total_amount), 0) AS revenue_cents,
           COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "order" o
         JOIN "orderItem" oi ON oi."orderId" = o.id
         JOIN "product" p ON p.id = oi."productId"
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
         GROUP BY p.id, p.name, p.sku
         ORDER BY revenue_cents DESC
         LIMIT 5`,
        orderParams
      ),
      client.query(
        `SELECT
           o."orderDate"::date AS bucket,
           COALESCE(SUM(o.total_amount), 0) AS revenue_cents
         FROM "order" o
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
         GROUP BY o."orderDate"::date
         ORDER BY o."orderDate"::date ASC`,
        orderParams
      ),
      client.query(
        `SELECT
           o."deliveryMethod",
           o."deliveryDetails",
           o."orderDate"::date AS bucket
         FROM "order" o
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}`,
        orderParams
      ),
      client.query(
        `SELECT
           p.sku,
           p."sourceCategoryCode" AS category,
           COALESCE(SUM(oi.total_amount), 0) AS revenue_cents,
           COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM "order" o
         JOIN "orderItem" oi ON oi."orderId" = o.id
         JOIN "product" p ON p.id = oi."productId"
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
         GROUP BY p.sku, p."sourceCategoryCode"`,
        orderParams
      ),
      client.query(
        `SELECT
           p.id,
           p.name,
           p.sku,
           COALESCE(SUM(oi.quantity), 0)::int AS units,
           COALESCE(SUM(oi.total_amount), 0) AS revenue_cents,
           COALESCE(p."purchasePriceGhs", 0) AS unit_cost_cents
         FROM "order" o
         JOIN "orderItem" oi ON oi."orderId" = o.id
         JOIN "product" p ON p.id = oi."productId"
         WHERE o."orderDate" >= $1
           AND o."orderDate" < $2
           ${orderOrgFilter}
         GROUP BY p.id, p.name, p.sku, p."purchasePriceGhs"
         ORDER BY revenue_cents DESC
         LIMIT 50`,
        orderParams
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
           b."eventDate"::date AS bucket,
           COALESCE(SUM(b."totalAmount"), 0) AS revenue_cents
         FROM "booking" b
         WHERE LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed')
           AND b."eventDate" >= $1
           AND b."eventDate" < $2
           ${bookingOrgFilter}
         GROUP BY b."eventDate"::date
         ORDER BY b."eventDate"::date ASC`,
        bookingParams
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
         WHERE LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed')
           AND b."eventDate" >= $1
           AND b."eventDate" < $2
           ${bookingOrgFilter}
         GROUP BY p.id, p.name, p.sku
         ORDER BY revenue_cents DESC
         LIMIT 5`,
        bookingParams
      ),
      buildExpenseBreakdown({
        client,
        start,
        end,
        organizationId,
      }),
    ]);

    const categoryMap = { retail: 0, rental: 0, other: 0 };
    const addToCategory = (cat, cents) => {
      if (cat === "rental") {
        categoryMap.rental += cents;
      } else {
        categoryMap.retail += cents;
      }
    };

    for (const row of skuRows.rows || []) {
      const sku = normalizeSku(row.sku || "");
      const cents = Number(row.revenue_cents || 0);
      if (sku.startsWith("INV")) {
        addToCategory("retail", cents);
      } else {
        const cat = (row.category || "").toLowerCase();
        addToCategory(cat === "retail" ? "retail" : "other", cents);
      }
    }

    const bookingRevenueCents = Number(bookingSummary.rows[0]?.revenue_cents || 0);
    const bookingCount = bookingSummary.rows[0]?.bookings || 0;
    categoryMap.rental += bookingRevenueCents;

    const deliveryFeeTotals = new Map();
    let deliveryFeeCentsTotal = 0;
    for (const row of deliveryFeeRows.rows || []) {
      const { feeCents } = getDeliveryFeeDetails(row.deliveryMethod, row.deliveryDetails);
      if (!feeCents) continue;
      deliveryFeeCentsTotal += feeCents;
      const key = row.bucket;
      deliveryFeeTotals.set(key, (deliveryFeeTotals.get(key) || 0) + feeCents);
    }

    categoryMap.retail += deliveryFeeCentsTotal;

    const orderRevenueCents = Number(summary.rows[0]?.revenue_cents || 0) + deliveryFeeCentsTotal;
    const costCents = Number(summary.rows[0]?.cost_cents || 0);
    const expenseWindowCents = Number(expenseSummary.totalCents || 0);
    const grossProfitCents = orderRevenueCents - costCents + bookingRevenueCents;
    const netProfitCents = grossProfitCents - expenseWindowCents;

    const cashflowMap = new Map();
    for (const row of cashflowRows.rows || []) {
      const key = row.bucket;
      cashflowMap.set(key, Number(row.revenue_cents || 0));
    }
    for (const row of bookingDaily.rows || []) {
      const key = row.bucket;
      const existing = cashflowMap.get(key) || 0;
      cashflowMap.set(key, existing + Number(row.revenue_cents || 0));
    }
    for (const [key, cents] of deliveryFeeTotals.entries()) {
      const existing = cashflowMap.get(key) || 0;
      cashflowMap.set(key, existing + cents);
    }

    const cashflow = Array.from(cashflowMap.entries())
      .map(([date, revenue]) => ({ date, revenue: revenue / 100 }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const transactions = (transactionRows.rows || []).map((row) => {
      const revenue = Number(row.revenue_cents || 0);
      const unitCost = Number(row.unit_cost_cents || 0);
      const units = row.units || 0;
      const cost = unitCost * units;
      const profit = revenue - cost;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        qty: units,
        revenue: revenue / 100,
        unitCost: unitCost / 100,
        cost: cost / 100,
        profit: profit / 100,
        marginPct: Number(marginPct.toFixed(1)),
      };
    });

    return json(event, 200, {
      window: windowKey,
      windowLabel: label,
      startDate: startIso,
      endDate: endIso,
      orders: summary.rows[0]?.orders || 0,
      bookings: bookingCount,
      bookingRevenue: bookingRevenueCents / 100,
      revenue: (orderRevenueCents + bookingRevenueCents) / 100,
      units: summary.rows[0]?.units || 0,
      expenseWindowLabel: label,
      summary: {
        revenue: orderRevenueCents / 100,
        cogs: costCents / 100,
        rentalIncome: bookingRevenueCents / 100,
        grossProfit: grossProfitCents / 100,
        operatingExpenses: expenseWindowCents / 100,
        netProfit: netProfitCents / 100,
      },
      expenseBreakdown: expenseSummary.breakdown,
      transactions,
      revenueByCategory: {
        retail: categoryMap.retail / 100,
        rental: categoryMap.rental / 100,
        other: categoryMap.other / 100,
      },
      topProducts: (topRows.rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        revenue: Number(row.revenue_cents || 0) / 100,
        units: row.units || 0,
      })),
      topRentals: (topRentalRows.rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        revenue: Number(row.revenue_cents || 0) / 100,
        units: row.units || 0,
      })),
      cashflow,
      automation: {
        organizationScoped: {
          orders: orderHasOrg,
          bookings: bookingHasOrg,
          expenses: expenseSummary.hasOrganizationId,
        },
        expenseSourceTable: expenseSummary.tableLabel,
      },
    });
  } catch (err) {
    console.error("❌ Financial stats error:", err);
    return json(event, 500, { error: "Failed to load financial stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
