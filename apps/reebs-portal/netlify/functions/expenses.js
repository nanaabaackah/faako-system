/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  EXPENSE_CATEGORIES,
  buildExpenseFilter,
  inferExpenseCategory,
  isSupportedExpenseCategory,
  normalizeExpenseCategory,
  resolveExpenseColumns,
  resolveExpenseTable,
} from "./_shared/expenseAccounting.js";
import { hasAnyRole, requireInternalUser, respond } from "./_shared/internalApi.js";

const EXPENSE_METHODS = "GET,POST,OPTIONS";

const getMonthRange = (value) => {
  const now = value ? new Date(value) : new Date();
  if (Number.isNaN(now.getTime())) return null;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
};

const normalizeExpenseRow = (row) => ({
  ...row,
  category: normalizeExpenseCategory(row?.category) || "Operational",
});

const ensureExpenseLinkColumns = async (client, table) => {
  if (!table?.queryRef) return;
  await client.query(`ALTER TABLE ${table.queryRef} ADD COLUMN IF NOT EXISTS "orderId" INTEGER`);
  await client.query(`ALTER TABLE ${table.queryRef} ADD COLUMN IF NOT EXISTS "bookingId" INTEGER`);
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: EXPENSE_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requireInternalUser(client, event, {
      methods: EXPENSE_METHODS,
      roles: ["owner", "admin", "manager"],
      roleError: "Only owners, admins, and managers can access expenses.",
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;
    const table = await resolveExpenseTable(client);
    if (!table) {
      return respond(event, 500, { error: "Expenses table not found." }, { methods: EXPENSE_METHODS });
    }
    await ensureExpenseLinkColumns(client, table);
    const columns = await resolveExpenseColumns(client, table);
    const hasUserId = columns.includes("userId");
    const hasOrderId = columns.includes("orderId");
    const hasBookingId = columns.includes("bookingId");
    const hasCreatedAt = columns.includes("createdAt");
    const hasUpdatedAt = columns.includes("updatedAt");
    const hasOrganizationId = columns.includes("organizationId");
    const selectColumns = [
      "id",
      "category",
      "amount",
      "description",
      "date",
      hasUserId ? "\"userId\"" : null,
      hasOrderId ? "\"orderId\"" : null,
      hasBookingId ? "\"bookingId\"" : null,
      hasOrganizationId ? "\"organizationId\"" : null,
    ].filter(Boolean);

    if (event.httpMethod === "GET") {
      const debug = event.queryStringParameters?.debug === "1";
      const monthParam = event.queryStringParameters?.month;
      const range = monthParam ? getMonthRange(monthParam) : null;
      const { params, whereClause } = buildExpenseFilter({
        hasOrganizationId,
        organizationId,
        startDate: range?.start,
        endDate: range?.end,
        dateExpression: "\"date\"",
      });

      if (debug) {
        if (!hasAnyRole(authUser, ["owner", "admin"])) {
          return respond(event, 403, { error: "Only owners and admins can use debug mode." }, {
            methods: EXPENSE_METHODS,
          });
        }
        return respond(event, 200, {
          table: table.label,
          count: table.count,
          columns,
          categories: EXPENSE_CATEGORIES,
        }, { methods: EXPENSE_METHODS });
      }

      const result = await client.query(
        `SELECT ${selectColumns.join(", ")}
         FROM ${table.queryRef}
         ${whereClause}
         ORDER BY date DESC, id DESC`,
        params
      );
      const maintenanceConditions = [`LOWER(m.status) IN ('open','resolved','accepted')`];
      const maintenanceParams = [];
      if (hasOrganizationId) {
        maintenanceParams.push(organizationId);
        maintenanceConditions.push(`m."organizationId" = $${maintenanceParams.length}`);
      }
      if (range) {
        maintenanceParams.push(range.start.toISOString(), range.end.toISOString());
        maintenanceConditions.push(
          `COALESCE(m."resolvedAt", m."createdAt") >= $${maintenanceParams.length - 1}
           AND COALESCE(m."resolvedAt", m."createdAt") < $${maintenanceParams.length}`
        );
      }
      const maintenanceWhere = maintenanceConditions.length ? `WHERE ${maintenanceConditions.join(" AND ")}` : "";
      const maintenanceRes = await client.query(
        `SELECT
          m.id,
          m."productId",
          p.name AS "productName",
          m.issue,
          m.type,
          m.cost,
          m.status,
          COALESCE(m."resolvedAt", m."createdAt") AS date
        FROM "maintenanceLog" m
        JOIN "product" p ON p.id = m."productId"
        ${hasOrganizationId ? `AND p."organizationId" = m."organizationId"` : ""}
        ${maintenanceWhere}
        ORDER BY date DESC, m.id DESC`,
        maintenanceParams
      );

      const maintenanceRows = (maintenanceRes.rows || []).map((row) => ({
        id: `maintenance-${row.id}`,
        category: "Maintenance",
        amount: row.cost,
        description: `${row.productName || "Asset"}: ${row.issue || row.type || "Maintenance"}`,
        date: row.date,
        userId: null,
        orderId: null,
        bookingId: null,
        maintenanceId: row.id,
        maintenanceStatus: row.status,
      }));

      const combined = [...(result.rows || []), ...maintenanceRows].sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return String(b.id).localeCompare(String(a.id));
      });

      return respond(event, 200, combined.map(normalizeExpenseRow), { methods: EXPENSE_METHODS });
    }

    if (event.httpMethod !== "POST") {
      return respond(event, 405, { error: "Method Not Allowed" }, { methods: EXPENSE_METHODS });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return respond(event, 400, { error: "Invalid JSON body." }, { methods: EXPENSE_METHODS });
    }

    if (payload?.seed) {
      const existing = await client.query(`SELECT COUNT(*)::int AS count FROM ${table.queryRef}`);
      if ((existing.rows[0]?.count || 0) > 0) {
        return respond(event, 200, { seeded: false, count: existing.rows[0].count }, {
          methods: EXPENSE_METHODS,
        });
      }

      const now = new Date();
      const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const samples = [
        {
          category: "Logistics",
          amount: 12050,
          description: "Fuel for delivery to East Legon",
          date: daysAgo(2),
        },
        {
          category: "Utilities",
          amount: 85000,
          description: "Rent: Monthly warehouse rent",
          date: daysAgo(6),
        },
        {
          category: "Staff Salary",
          amount: 300000,
          description: "Staff salaries and overtime",
          date: daysAgo(10),
        },
        {
          category: "Marketing",
          amount: 45000,
          description: "Instagram promo campaign",
          date: daysAgo(12),
        },
        {
          category: "Utilities",
          amount: 23000,
          description: "Internet: Internet and call credits",
          date: daysAgo(15),
        },
        {
          category: "Maintenance",
          amount: 9575,
          description: "Vehicle servicing and minor repairs",
          date: daysAgo(18),
        },
      ];

      const insertColumns = ["category", "amount", "description", "date"];
      if (hasUserId) insertColumns.push("\"userId\"");
      if (hasOrganizationId) insertColumns.push("\"organizationId\"");
      if (hasCreatedAt) insertColumns.push("\"createdAt\"");
      if (hasUpdatedAt) insertColumns.push("\"updatedAt\"");

      const values = [];
      const placeholders = samples.map((row, index) => {
        const base = index * insertColumns.length;
        values.push(
          row.category,
          row.amount,
          row.description,
          row.date.toISOString()
        );
        if (hasUserId) values.push(null);
        if (hasOrganizationId) values.push(organizationId);
        if (hasCreatedAt) values.push(new Date().toISOString());
        if (hasUpdatedAt) values.push(new Date().toISOString());
        const range = Array.from({ length: insertColumns.length }, (_, i) => `$${base + i + 1}`);
        return `(${range.join(", ")})`;
      });

      await client.query(
        `INSERT INTO ${table.queryRef} (${insertColumns.join(", ")})
         VALUES ${placeholders.join(", ")}`,
        values
      );

      return respond(event, 200, { seeded: true, count: samples.length }, {
        methods: EXPENSE_METHODS,
      });
    }

    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const amountValue = Number(payload.amount);
    const userId = authUser.id;
    const orderId = payload.orderId ? Number(payload.orderId) : null;
    const bookingId = payload.bookingId ? Number(payload.bookingId) : null;
    const dateValue = payload.date ? new Date(payload.date) : new Date();

    if (category && category.toLowerCase() !== "auto" && !isSupportedExpenseCategory(category)) {
      return respond(event, 400, {
        error: "Invalid category.",
        allowedCategories: EXPENSE_CATEGORIES,
      }, { methods: EXPENSE_METHODS });
    }
    if (!description) {
      return respond(event, 400, { error: "Description is required." }, { methods: EXPENSE_METHODS });
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return respond(event, 400, { error: "Amount must be greater than zero." }, { methods: EXPENSE_METHODS });
    }
    if (Number.isNaN(dateValue.getTime())) {
      return respond(event, 400, { error: "Invalid date." }, { methods: EXPENSE_METHODS });
    }
    if (orderId && !hasOrderId) {
      return respond(event, 400, { error: "Order links are not supported in this expenses table." }, {
        methods: EXPENSE_METHODS,
      });
    }
    if (bookingId && !hasBookingId) {
      return respond(event, 400, { error: "Booking links are not supported in this expenses table." }, {
        methods: EXPENSE_METHODS,
      });
    }
    if (orderId) {
      const orderCheck = await client.query(
        `SELECT id FROM "order" WHERE id = $1 AND "organizationId" = $2`,
        [orderId, organizationId]
      );
      if (orderCheck.rowCount === 0) {
        return respond(event, 400, { error: "Order not found." }, { methods: EXPENSE_METHODS });
      }
    }
    if (bookingId) {
      const bookingCheck = await client.query(
        `SELECT id, status FROM "booking" WHERE id = $1 AND "organizationId" = $2`,
        [bookingId, organizationId]
      );
      if (bookingCheck.rowCount === 0) {
        return respond(event, 400, { error: "Booking not found." }, { methods: EXPENSE_METHODS });
      }
      const bookingStatus = String(bookingCheck.rows[0]?.status || "").trim().toLowerCase();
      if (bookingStatus === "completed") {
        return respond(event, 409, { error: "Completed bookings are locked and can't be edited." }, {
          methods: EXPENSE_METHODS,
        });
      }
    }

    const resolvedCategory = inferExpenseCategory({ category, description });
    const amountCents = Math.round(amountValue * 100);

    const insertColumns = ["category", "amount", "description", "date"];
    const insertValues = [resolvedCategory, amountCents, description, dateValue.toISOString()];
    if (hasUserId) {
      insertColumns.push("\"userId\"");
      insertValues.push(userId);
    }
    if (hasOrganizationId) {
      insertColumns.push("\"organizationId\"");
      insertValues.push(organizationId);
    }
    if (hasOrderId) {
      insertColumns.push("\"orderId\"");
      insertValues.push(orderId);
    }
    if (hasBookingId) {
      insertColumns.push("\"bookingId\"");
      insertValues.push(bookingId);
    }
    if (hasCreatedAt) {
      insertColumns.push("\"createdAt\"");
      insertValues.push(new Date().toISOString());
    }
    if (hasUpdatedAt) {
      insertColumns.push("\"updatedAt\"");
      insertValues.push(new Date().toISOString());
    }

    const placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(", ");

    const insert = await client.query(
      `INSERT INTO ${table.queryRef} (${insertColumns.join(", ")})
       VALUES (${placeholders})
       RETURNING ${selectColumns.join(", ")}`,
      insertValues
    );

    return respond(event, 200, {
      ...normalizeExpenseRow(insert.rows[0]),
      categoryAutoDetected: !category || category.toLowerCase() === "auto",
    }, { methods: EXPENSE_METHODS });
  } catch (err) {
    console.error("❌ Expenses error:", err);
    return respond(event, 500, { error: "Failed to process expenses" }, { methods: EXPENSE_METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
