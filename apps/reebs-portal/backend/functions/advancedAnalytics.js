import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { isCrossSiteBrowserRequest } from "./_shared/http.js";
import { requirePermission, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";
const SERVICE_TIMEOUT_MS = 4_000;
const HISTORY_DAYS = 180;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRODUCTION_ANALYTICS_SERVICE_URL = "https://reebs-service-production.up.railway.app";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const average = (values = []) =>
  values.length ? values.reduce((sum, value) => sum + toNumber(value), 0) / values.length : 0;

const runSequentially = async (operations = []) => {
  const results = [];
  for (const operation of operations) {
    results.push(await operation());
  }
  return results;
};

export const normalizeAnalyticsServiceUrl = (value) => {
  const configured = String(value || "").trim();
  if (!configured) return "";
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const resolveAnalyticsServiceUrl = (environment = process.env) => {
  const configuredServiceUrl = environment.REEBS_ANALYTICS_SERVICE_URL
    || (String(environment.APP_ENV || environment.NODE_ENV).toLowerCase() === "production"
      ? PRODUCTION_ANALYTICS_SERVICE_URL
      : "");
  return normalizeAnalyticsServiceUrl(configuredServiceUrl);
};

export const buildFallbackAnalytics = (snapshot = {}) => {
  const dailyRevenue = (snapshot.revenueSeries || []).map(
    (row) => toNumber(row.orderRevenueCents) + toNumber(row.bookingRevenueCents)
  );
  const recent = dailyRevenue.slice(-30);
  const previous = dailyRevenue.slice(-60, -30);
  const recentAverage = average(recent);
  const previousAverage = previous.length ? average(previous) : recentAverage;
  const changePct = previousAverage
    ? Math.round(((recentAverage - previousAverage) / previousAverage) * 100)
    : 0;
  const boundedChange = Math.max(-40, Math.min(40, changePct));

  const weekdayTotals = new Map(WEEKDAYS.map((day) => [day, 0]));
  for (const row of snapshot.weekdayDemand || []) {
    const weekday = String(row.weekday || "").trim();
    if (weekdayTotals.has(weekday)) {
      weekdayTotals.set(weekday, weekdayTotals.get(weekday) + Math.max(0, toNumber(row.bookings)));
    }
  }
  const peakWeekday = [...weekdayTotals.entries()].sort((left, right) => right[1] - left[1])[0];
  const totalBookings = [...weekdayTotals.values()].reduce((sum, value) => sum + value, 0);
  const historyDays = Math.max(1, toNumber(snapshot.historyDays, HISTORY_DAYS));

  const inventoryRisks = (snapshot.inventory || [])
    .map((row) => {
      const stock = Math.max(0, Math.round(toNumber(row.stock)));
      const reorderLevel = Math.max(0, Math.round(toNumber(row.reorderLevel, 2)));
      const unitsOut90d = Math.max(0, toNumber(row.unitsOut90d));
      const dailyVelocity = unitsOut90d / 90;
      const daysCover = dailyVelocity > 0 ? Math.round(stock / dailyVelocity) : null;
      if (stock > reorderLevel && (daysCover === null || daysCover > 21)) return null;
      return {
        productId: row.productId,
        name: row.name || "Inventory item",
        stock,
        reorderLevel,
        unitsOut90d: Math.round(unitsOut90d),
        daysCover,
        severity: stock === 0 || (daysCover !== null && daysCover <= 7) ? "critical" : "warning",
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
      return (left.daysCover ?? 999999) - (right.daysCover ?? 999999);
    })
    .slice(0, 5);

  const totalCustomers = Math.max(0, toNumber(snapshot.customers?.total));
  const repeatCustomers = Math.max(0, toNumber(snapshot.customers?.repeat));
  const repeatRate = totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
  const insights = [];
  if (inventoryRisks.length) {
    insights.push({
      key: "inventory-risk",
      title: `${inventoryRisks.length} fast-moving item${inventoryRisks.length === 1 ? "" : "s"} need attention`,
      detail: "Review stock cover before the next booking cycle.",
      tone: inventoryRisks.some((item) => item.severity === "critical") ? "critical" : "warning",
      path: "/admin/inventory?filter=low",
    });
  }
  if (peakWeekday?.[1] > 0) {
    insights.push({
      key: "peak-day",
      title: `${peakWeekday[0]} is the busiest booking day`,
      detail: `Plan staff, delivery, and setup capacity around ${peakWeekday[0].toLowerCase()} demand.`,
      tone: "info",
      path: "/admin/schedule",
    });
  }

  return {
    version: "2026-07-reebs-dashboard-v1",
    source: "node-fallback",
    forecast: {
      next30RevenueCents: Math.round(recentAverage * (1 + boundedChange / 200) * 30),
      dailyAverageCents: Math.round(recentAverage),
      changePct,
      direction: changePct > 5 ? "up" : changePct < -5 ? "down" : "steady",
      confidence: dailyRevenue.length >= 60 ? "high" : dailyRevenue.length >= 21 ? "medium" : "low",
    },
    demand: {
      peakWeekday: peakWeekday?.[1] > 0 ? peakWeekday[0] : "No pattern yet",
      peakBookings: peakWeekday?.[1] || 0,
      bookingForecastNext30: Math.round((totalBookings / historyDays) * 30),
      weekdayTotals: WEEKDAYS.map((weekday) => ({ weekday, bookings: weekdayTotals.get(weekday) })),
    },
    inventoryRisks,
    customer: { total: totalCustomers, repeat: repeatCustomers, repeatRate },
    insights,
  };
};

const loadAnalyticsSnapshot = async (client, organizationId) => {
  const [revenueResult, demandResult, inventoryResult, customerResult] = await runSequentially([
    () => client.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '89 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       ), order_daily AS (
         SELECT "orderDate"::date AS day,
                COALESCE(SUM(COALESCE("grandTotalCents", "total_amount")), 0)::bigint AS revenue,
                COUNT(*)::int AS orders
         FROM "order"
         WHERE "organizationId" = $1
           AND "orderDate" >= CURRENT_DATE - INTERVAL '89 days'
           AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled')
         GROUP BY "orderDate"::date
       ), booking_daily AS (
         SELECT "createdAt"::date AS day,
                COALESCE(SUM("totalAmount"), 0)::bigint AS revenue,
                COUNT(*)::int AS bookings
         FROM "booking"
         WHERE "organizationId" = $1
           AND "createdAt" >= CURRENT_DATE - INTERVAL '89 days'
           AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled')
         GROUP BY "createdAt"::date
       )
       SELECT days.day,
              COALESCE(order_daily.revenue, 0)::bigint AS "orderRevenueCents",
              COALESCE(order_daily.orders, 0)::int AS orders,
              COALESCE(booking_daily.revenue, 0)::bigint AS "bookingRevenueCents",
              COALESCE(booking_daily.bookings, 0)::int AS bookings
       FROM days
       LEFT JOIN order_daily USING (day)
       LEFT JOIN booking_daily USING (day)
       ORDER BY days.day`,
      [organizationId]
    ),
    () => client.query(
      `SELECT EXTRACT(ISODOW FROM "eventDate")::int AS weekday_number,
              COUNT(*)::int AS bookings
       FROM "booking"
       WHERE "organizationId" = $1
         AND "eventDate" >= CURRENT_DATE - INTERVAL '180 days'
         AND "eventDate" <= CURRENT_DATE
         AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled')
       GROUP BY weekday_number
       ORDER BY weekday_number`,
      [organizationId]
    ),
    () => client.query(
      `SELECT p.id AS "productId",
              p.name,
              GREATEST(COALESCE(p.stock, 0), 0)::int AS stock,
              GREATEST(COALESCE(p."reorderLevel", 2), 0)::int AS "reorderLevel",
              COALESCE(SUM(
                CASE WHEN LOWER(COALESCE(sm.type, '')) IN ('stockout', 'stock_out', 'out', 'sale')
                     THEN ABS(sm.quantity) ELSE 0 END
              ), 0)::int AS "unitsOut90d"
       FROM "product" p
       LEFT JOIN "stockMovement" sm
         ON sm."productId" = p.id
        AND sm."organizationId" = p."organizationId"
        AND sm.date >= CURRENT_DATE - INTERVAL '90 days'
       WHERE p."organizationId" = $1
         AND COALESCE(p."isDeleted", false) = false
         AND COALESCE(p."isArchived", false) = false
         AND COALESCE(p."isActive", true) = true
       GROUP BY p.id, p.name, p.stock, p."reorderLevel"
       ORDER BY "unitsOut90d" DESC, p.stock ASC
       LIMIT 100`,
      [organizationId]
    ),
    () => client.query(
      `WITH activity AS (
         SELECT "customerId", COUNT(*)::int AS interactions
         FROM (
           SELECT "customerId" FROM "order"
           WHERE "organizationId" = $1 AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled')
           UNION ALL
           SELECT "customerId" FROM "booking"
           WHERE "organizationId" = $1 AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled')
         ) customer_activity
         GROUP BY "customerId"
       )
       SELECT COUNT(c.id)::int AS total,
              COUNT(c.id) FILTER (WHERE COALESCE(activity.interactions, 0) > 1)::int AS repeat
       FROM "customer" c
       LEFT JOIN activity ON activity."customerId" = c.id
       WHERE c."organizationId" = $1`,
      [organizationId]
    ),
  ]);

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    historyDays: HISTORY_DAYS,
    revenueSeries: revenueResult.rows.map((row) => ({
      date: row.day,
      orderRevenueCents: toNumber(row.orderRevenueCents),
      orders: toNumber(row.orders),
      bookingRevenueCents: toNumber(row.bookingRevenueCents),
      bookings: toNumber(row.bookings),
    })),
    weekdayDemand: demandResult.rows.map((row) => ({
      weekday: WEEKDAYS[Math.max(1, toNumber(row.weekday_number, 1)) - 1],
      bookings: toNumber(row.bookings),
    })),
    inventory: inventoryResult.rows,
    customers: customerResult.rows[0] || { total: 0, repeat: 0 },
  };
};

const requestPythonAnalytics = async (snapshot) => {
  const serviceUrl = resolveAnalyticsServiceUrl();
  if (!serviceUrl) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
  try {
    const secret = String(process.env.REEBS_ANALYTICS_SERVICE_SECRET || "").trim();
    const response = await fetch(`${serviceUrl}/v1/dashboard/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Analytics service returned ${response.status}.`);
    const result = await response.json();
    if (Number(result?.organizationId) !== Number(snapshot.organizationId)) {
      throw new Error("Analytics service returned the wrong organization scope.");
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return respond(event, 204, {}, { methods: METHODS });
  if (method !== "GET") return respond(event, 405, { error: "Method Not Allowed" }, { methods: METHODS });
  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed" }, { methods: METHODS });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const internal = await requirePermission(client, event, "financials:read", { methods: METHODS });
    if (internal.errorResponse) return internal.errorResponse;

    const snapshot = await loadAnalyticsSnapshot(client, Number(internal.organizationId));
    let analytics = null;
    let serviceMessage = "Forecasting is ready.";
    try {
      analytics = await requestPythonAnalytics(snapshot);
      if (analytics) serviceMessage = "Forecasts generated from current operating data.";
    } catch (error) {
      console.warn("REEBS advanced analytics service unavailable", error?.message || error);
      serviceMessage = "Forecasts generated with the built-in continuity model.";
    }

    const result = analytics || buildFallbackAnalytics(snapshot);
    return respond(event, 200, {
      ...result,
      organizationId: snapshot.organizationId,
      generatedAt: snapshot.generatedAt,
      service: {
        enabled: true,
        available: true,
        connected: result.source === "python",
        mode: result.source === "python" ? "python" : "fallback",
        message: serviceMessage,
      },
    }, { methods: METHODS });
  } catch (error) {
    console.error("Advanced dashboard analytics failed", error?.message || error);
    return respond(event, 500, { error: "Unable to load advanced analytics." }, { methods: METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
