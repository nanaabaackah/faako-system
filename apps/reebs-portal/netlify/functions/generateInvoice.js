/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

export async function handler(event = {}) {
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
    return json(405, { error: "Method Not Allowed" });
  }

  const orderId = Number(event.queryStringParameters?.orderId);
  if (!Number.isFinite(orderId)) {
    return json(400, { error: "orderId is required" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const orderRes = await client.query(
      `SELECT
         o.id,
         o."orderNumber",
         o."orderDate",
         o."total_amount",
         o.status,
         o."customerName",
         o."deliveryMethod",
         o."deliveryDetails",
         c.id AS customer_id,
         c.name AS customer_name,
         c.email AS customer_email,
         c.phone AS customer_phone
       FROM "order" o
       LEFT JOIN "customer" c ON c.id = o."customerId"
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      return json(404, { error: "Order not found" });
    }

    const order = orderRes.rows[0];
    const itemsRes = await client.query(
      `SELECT
         oi.id,
         oi.quantity,
         oi.unit_price,
         oi.total_amount,
         p.name,
         p.sku
       FROM "orderItem" oi
       JOIN "product" p ON p.id = oi."productId"
       WHERE oi."orderId" = $1
       ORDER BY oi.id ASC`,
      [orderId]
    );

    const expensesRes = await client.query(
      `SELECT id, category, amount, description, date
       FROM "expense"
       WHERE "orderId" = $1
       ORDER BY date ASC, id ASC`,
      [orderId]
    );

    const items = itemsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      quantity: row.quantity,
      unitPriceCents: Number(row.unit_price || 0),
      totalCents: Number(row.total_amount || 0),
      unitPrice: Number(row.unit_price || 0) / 100,
      total: Number(row.total_amount || 0) / 100,
    }));

    const itemsSubtotalCents = itemsRes.rows.reduce(
      (acc, row) => acc + Number(row.total_amount || 0),
      0
    );
    const orderSubtotalCentsRaw = order.total_amount == null ? null : Number(order.total_amount);
    const orderSubtotalCents = Number.isFinite(orderSubtotalCentsRaw) ? orderSubtotalCentsRaw : null;
    const adjustmentCents = orderSubtotalCents == null ? 0 : orderSubtotalCents - itemsSubtotalCents;
    if (adjustmentCents !== 0) {
      items.push({
        id: "order-adjustment",
        name: adjustmentCents < 0 ? "Discount" : "Adjustment",
        sku: null,
        quantity: 1,
        unitPriceCents: adjustmentCents,
        totalCents: adjustmentCents,
        unitPrice: adjustmentCents / 100,
        total: adjustmentCents / 100,
      });
    }

    const { distanceKm, feeCents: deliveryFeeCents, rateCents: deliveryRateCents } =
      getDeliveryFeeDetails(order.deliveryMethod, order.deliveryDetails);
    const deliveryRate = deliveryRateCents / 100;

    if (deliveryFeeCents > 0) {
      items.push({
        id: "delivery-fee",
        name: `Delivery fee (${distanceKm} km @ GHS ${deliveryRate.toFixed(2)}/km)`,
        sku: null,
        quantity: distanceKm,
        unitPriceCents: deliveryRateCents,
        totalCents: deliveryFeeCents,
        unitPrice: deliveryRate,
        total: deliveryFeeCents / 100,
      });
    }

    const expenses = (expensesRes.rows || []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      date: row.date,
      amount: Number(row.amount || 0) / 100,
    }));

    const expensesTotalCents = (expensesRes.rows || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    const baseSubtotalCents = orderSubtotalCents ?? itemsSubtotalCents;
    const subtotalCents = baseSubtotalCents + deliveryFeeCents;
    const taxRate = 0;
    const taxTotalCents = 0;
    const grandTotalCents = subtotalCents;

    return json(200, {
      invoiceNumber: `REC-${order.orderNumber}`,
      orderId: order.id,
      date: new Date(order.orderDate || Date.now()).toLocaleDateString("en-GB"),
      customer: {
        id: order.customer_id,
        name: order.customer_name || order.customerName || "Customer",
        email: order.customer_email || "",
        phone: order.customer_phone || "",
      },
      items,
      summary: {
        subtotal: subtotalCents / 100,
        taxRate,
        taxTotal: taxTotalCents / 100,
        grandTotal: grandTotalCents / 100,
      },
      expenses,
      expensesTotal: expensesTotalCents / 100,
    });
  } catch (err) {
    console.error("❌ Invoice generation error:", err);
    return json(500, { error: "Failed to generate invoice" });
  } finally {
    await client.end().catch(() => {});
  }
}
