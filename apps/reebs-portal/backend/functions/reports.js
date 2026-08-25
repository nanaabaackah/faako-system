/* eslint-disable no-undef */
import { Client } from "pg";
import { withReebsAnalyticsScope } from "@faako/api-contracts/reebs";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  getAuditRangeKey,
  getAuditRangeStart,
  listAuditLogs,
} from "./_shared/auditLog.js";
import { requireAdmin, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";

const formatCount = (value) => Number(value || 0).toLocaleString("en-US");

const RANGE_LABELS = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

const buildSeries = (entries = []) => {
  const buckets = new Map();
  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`;
    const current = buckets.get(key) || { date: key, total: 0, incidents: 0, failures: 0 };
    current.total += 1;
    if (entry.source === "railway" || entry.category === "incident") current.incidents += 1;
    if (["warning", "error"].includes(String(entry.severity || "").toLowerCase())) {
      current.failures += 1;
    }
    buckets.set(key, current);
  });
  return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
};

const buildCounts = (entries = [], key, limit) =>
  [...entries.reduce((map, entry) => {
    const label = String(entry?.[key] || "Unknown").trim() || "Unknown";
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);

const buildDateClause = (fieldName, since, parameterIndex) => {
  if (!since) {
    return {
      clause: "",
      values: [],
    };
  }

  return {
    clause: ` AND ${fieldName} >= $${parameterIndex}`,
    values: [since.toISOString()],
  };
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: METHODS });
  }

  if (event.httpMethod !== "GET") {
    return respond(event, 405, { error: "Method Not Allowed" }, { methods: METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requireAdmin(client, event, { methods: METHODS });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { organizationId } = authResult;
    const range = getAuditRangeKey(event.queryStringParameters?.range);
    const since = getAuditRangeStart(range);

    const orderDate = buildDateClause(`o."orderDate"`, since, 2);
    const bookingDate = buildDateClause(`b."eventDate"`, since, 2);
    const auditEntries = await listAuditLogs(client, {
      organizationId,
      range,
      take: 250,
    });

    const [orderStats, bookingStats, productStats] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(o."total_amount"), 0)::bigint AS revenue
         FROM "order" o
         WHERE o."organizationId" = $1
           AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'refunded')
           AND NOT EXISTS (
             SELECT 1
             FROM "orderItem" oi
             JOIN "product" p ON p.id = oi."productId"
             WHERE oi."orderId" = o.id
               AND oi."organizationId" = o."organizationId"
               AND UPPER(COALESCE(p."sourceCategoryCode", '')) = 'WATER'
           )${orderDate.clause}`,
        [organizationId, ...orderDate.values]
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "booking" b
         WHERE b."organizationId" = $1
           AND LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed')${bookingDate.clause}`,
        [organizationId, ...bookingDate.values]
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM "product"
         WHERE "organizationId" = $1
           AND COALESCE("isDeleted", false) = false
           AND COALESCE("isArchived", false) = false
           AND UPPER(COALESCE("sourceCategoryCode", '')) <> 'WATER'`,
        [organizationId]
      ),
    ]);

    const incidents = auditEntries.filter(
      (entry) => entry.source === "railway" || entry.category === "incident"
    );
    const failures = auditEntries.filter((entry) =>
      ["warning", "error"].includes(String(entry.severity || "").toLowerCase())
    );

    return respond(
      event,
      200,
      withReebsAnalyticsScope({
        range,
        rangeLabel: RANGE_LABELS[range] || RANGE_LABELS["7d"],
        generatedAt: new Date().toISOString(),
        kpis: [
          {
            key: "orders",
            label: "Core shop orders",
            value: formatCount(orderStats.rows[0]?.count),
            helper: `REEBS Core revenue GHS ${(Number(orderStats.rows[0]?.revenue || 0) / 100).toFixed(2)}`,
          },
          {
            key: "bookings",
            label: "Core bookings",
            value: formatCount(bookingStats.rows[0]?.count),
            helper: "Events in the current reporting window",
          },
          {
            key: "products",
            label: "Active core products",
            value: formatCount(productStats.rows[0]?.count),
            helper: "Current inventory footprint",
          },
          {
            key: "auditEvents",
            label: "Audit events",
            value: formatCount(auditEntries.length),
            helper: `${formatCount(incidents.length)} incidents · ${formatCount(failures.length)} warnings/errors`,
          },
        ],
        series: buildSeries(auditEntries),
        topActions: buildCounts(auditEntries, "action", 8),
        topSources: buildCounts(auditEntries, "source", 6),
        topCategories: buildCounts(auditEntries, "category", 6),
        recentIncidents: incidents.slice(0, 8),
        recentEvents: auditEntries.slice(0, 12),
      }),
      { methods: METHODS }
    );
  } catch (error) {
    console.error("Reports load failed", error);
    return respond(
      event,
      error?.statusCode || 500,
      { error: error?.message || "Unable to load reports." },
      { methods: METHODS }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
