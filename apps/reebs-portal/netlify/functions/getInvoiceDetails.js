/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import {
  resolveExpenseColumns,
  resolveExpenseTable,
} from "./_shared/expenseAccounting.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,OPTIONS" });

const selectBookingExpenses = async (client, organizationId, bookingId) => {
  const table = await resolveExpenseTable(client);
  if (!table) return [];

  const columns = await resolveExpenseColumns(client, table);
  if (!columns.includes("bookingId")) return [];

  const hasOrganizationId = columns.includes("organizationId");
  const params = [bookingId];
  const conditions = [`"bookingId" = $1`];
  if (hasOrganizationId) {
    params.push(organizationId);
    conditions.push(`"organizationId" = $${params.length}`);
  }

  const result = await client.query(
    `SELECT id, category, amount, description, date
     FROM ${table.queryRef}
     WHERE ${conditions.join(" AND ")}
     ORDER BY date ASC, id ASC`,
    params
  );
  return result.rows || [];
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (method !== "GET") {
    return json(event, 405, { error: "Method not allowed" });
  }

  const id = Number(event.queryStringParameters?.id || 0);
  if (!Number.isFinite(id) || id <= 0) {
    return json(event, 400, { error: "Missing or invalid booking id" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const internal = await requireInternalUser(client, event, {
      methods: "GET,OPTIONS",
      roles: ["owner", "admin", "manager"],
      roleError: "Manager access required.",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const { organizationId } = internal;
    const result = await client.query(
      `SELECT
         b.id,
         b."eventDate",
         b."startTime",
         b."endTime",
         b."venueAddress",
         b."totalAmount",
         b.status,
         c.id AS "customerId",
         c.name AS "customerName",
         c.email AS "customerEmail",
         c.phone AS "customerPhone",
         COALESCE(
           json_agg(
             json_build_object(
               'id', bi.id,
               'productId', bi."productId",
               'quantity', bi.quantity,
               'price', bi.price,
               'productName', p.name,
               'attendantsNeeded', p."attendantsNeeded",
               'rate', p.rate
             )
             ORDER BY bi.id
           ) FILTER (WHERE bi.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "booking" b
       JOIN "customer" c
         ON c.id = b."customerId"
        AND c."organizationId" = b."organizationId"
       LEFT JOIN "bookingItem" bi
         ON bi."bookingId" = b.id
        AND bi."organizationId" = b."organizationId"
       LEFT JOIN "product" p
         ON p.id = bi."productId"
        AND p."organizationId" = b."organizationId"
       WHERE b.id = $1
         AND b."organizationId" = $2
       GROUP BY b.id, c.id`,
      [id, organizationId]
    );

    const expenseRows = await selectBookingExpenses(client, organizationId, id);

    if (result.rowCount === 0) {
      return json(event, 404, { error: "Booking not found" });
    }

    const bookingRow = result.rows[0];
    let bookingItems = bookingRow?.items || [];
    if (typeof bookingItems === "string") {
      try {
        bookingItems = JSON.parse(bookingItems);
      } catch {
        bookingItems = [];
      }
    }
    if (!Array.isArray(bookingItems)) bookingItems = [];

    const itemProductIds = bookingItems
      .map((item) => Number(item?.productId))
      .filter((value) => Number.isFinite(value));

    if (itemProductIds.length > 0) {
      const motorsRes = await client.query(
        `SELECT "productId", COALESCE("motorsToPump", 0) AS motors
         FROM "bouncy_castles"
         WHERE "productId" = ANY($1::int[])`,
        [itemProductIds]
      );
      const motorsMap = new Map(
        motorsRes.rows.map((row) => [Number(row.productId), Number(row.motors) || 0])
      );
      const pumpQty = bookingItems.reduce((sum, item) => {
        const motors = motorsMap.get(Number(item?.productId)) || 0;
        if (!motors) return sum;
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        return sum + motors * qty;
      }, 0);

      const hasPump = bookingItems.some((item) => {
        const name = String(item?.productName || "").toLowerCase();
        return name.includes("pump");
      });

      if (pumpQty > 0 && !hasPump) {
        const pumpRes = await client.query(
          `SELECT id, name, price, rate
           FROM "product"
           WHERE "organizationId" = $1
             AND (UPPER(sku) LIKE 'PUM-%' OR LOWER(name) LIKE '%motor pump%')
           ORDER BY id
           LIMIT 1`,
          [organizationId]
        );
        const pumpProduct = pumpRes.rows[0] || null;
        bookingItems = [
          ...bookingItems,
          {
            id: `pump-${id}`,
            productId: pumpProduct?.id || null,
            quantity: pumpQty,
            price: Number(pumpProduct?.price || 0),
            productName: pumpProduct?.name || "Motor Pump",
            attendantsNeeded: 0,
            rate: pumpProduct?.rate || "",
          },
        ];
      }
    }

    const expenses = expenseRows.map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      date: row.date,
      amount: Number(row.amount || 0) / 100,
    }));

    const expensesTotal = expenseRows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return json(event, 200, {
      ...bookingRow,
      items: bookingItems,
      expenses,
      expensesTotal: expensesTotal / 100,
    });
  } catch (err) {
    console.error("getInvoiceDetails error:", err);
    return json(event, 500, { error: "Failed to fetch invoice details" });
  } finally {
    await client.end().catch(() => {});
  }
}
