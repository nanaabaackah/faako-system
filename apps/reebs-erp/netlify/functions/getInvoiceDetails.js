/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const id = Number(event.queryStringParameters?.id || 0);
  if (!Number.isFinite(id)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing or invalid booking id" }),
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
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
       JOIN "customer" c ON c.id = b."customerId"
       LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id
       LEFT JOIN "product" p ON p.id = bi."productId"
       WHERE b.id = $1
       GROUP BY b.id, c.id`,
      [id]
    );

    const expensesRes = await client.query(
      `SELECT id, category, amount, description, date
       FROM "expense"
       WHERE "bookingId" = $1
       ORDER BY date ASC, id ASC`,
      [id]
    );

    if (result.rowCount === 0) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Booking not found" }),
      };
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
        let pumpProduct = null;
        const pumpRes = await client.query(
          `SELECT id, name, price
           FROM "product"
           WHERE UPPER(sku) LIKE 'PUM-%' OR LOWER(name) LIKE '%motor pump%'
           ORDER BY id
           LIMIT 1`
        );
        pumpProduct = pumpRes.rows[0] || null;
        bookingItems = [
          ...bookingItems,
          {
            id: `pump-${id}`,
            productId: pumpProduct?.id || null,
            quantity: pumpQty,
            price: Number(pumpProduct?.price || 0),
            productName: pumpProduct?.name || "Motor Pump",
            attendantsNeeded: 0,
          },
        ];
      }
    }

    const expenses = (expensesRes.rows || []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      date: row.date,
      amount: Number(row.amount || 0) / 100,
    }));

    const expensesTotal = (expensesRes.rows || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ...bookingRow,
        items: bookingItems,
        expenses,
        expensesTotal: expensesTotal / 100,
      }),
    };
  } catch (err) {
    console.error("❌ getInvoiceDetails error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch invoice details" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
