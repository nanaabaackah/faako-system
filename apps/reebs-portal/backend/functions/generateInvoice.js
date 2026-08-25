/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requirePermission, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,OPTIONS" });

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (method !== "GET") {
    return json(event, 405, { error: "Method Not Allowed" });
  }

  const orderId = Number(event.queryStringParameters?.orderId);
  if (!Number.isFinite(orderId)) {
    return json(event, 400, { error: "orderId is required" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const internal = await requirePermission(client, event, "invoices:read", {
      methods: "GET,OPTIONS",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const { organizationId } = internal;
    const orderRes = await client.query(
      `SELECT
         o.id,
         o."orderNumber",
         o."orderDate",
         o."total_amount",
         o."subtotalCents",
         o."discountCents",
         o."deliveryFeeCents",
         o."serviceFeeCents",
         o."grandTotalCents",
         o.status,
         o."customerName",
         o."deliveryMethod",
         o."deliveryDetails",
         c.id AS customer_id,
         c.name AS customer_name,
         c.email AS customer_email,
         c.phone AS customer_phone
       FROM "order" o
       LEFT JOIN "customer" c
         ON c.id = o."customerId"
        AND c."organizationId" = o."organizationId"
       WHERE o.id = $1
         AND o."organizationId" = $2`,
      [orderId, organizationId]
    );

    if (orderRes.rowCount === 0) {
      return json(event, 404, { error: "Order not found" });
    }

    const order = orderRes.rows[0];
    const itemsRes = await client.query(
      `SELECT
         oi.id,
         oi."productId",
         oi."variantId",
         oi.quantity,
         oi.unit_price,
         oi.total_amount,
         NULLIF(CONCAT_WS(' / ', p.name, v."variantName", v."variantNumber", v.color, v.size), '') AS "variantLabel",
         COALESCE(NULLIF(CONCAT_WS(' / ', p.name, v."variantName", v."variantNumber", v.color, v.size), ''), p.name) AS name,
         p.sku,
         p.rate,
         p."attendantsNeeded",
         p."sourceCategoryCode",
         bc."motorsToPump"
       FROM "orderItem" oi
       JOIN "product" p
         ON p.id = oi."productId"
        AND p."organizationId" = oi."organizationId"
       LEFT JOIN "bouncy_castles" bc
         ON bc."productId" = oi."productId"
       LEFT JOIN "inventoryVariant" v
         ON v.id = oi."variantId"
        AND v."organizationId" = oi."organizationId"
       WHERE oi."orderId" = $1
         AND oi."organizationId" = $2
       ORDER BY oi.id ASC`,
      [orderId, organizationId]
    );

    const expensesRes = await client.query(
      `SELECT id, category, amount, description, date
       FROM "expense"
       WHERE "orderId" = $1
         AND "organizationId" = $2
       ORDER BY date ASC, id ASC`,
      [orderId, organizationId]
    );

    const items = itemsRes.rows.map((row) => ({
      id: row.id,
      productId: Number(row.productId) || null,
      variantId: Number(row.variantId) || null,
      variantLabel: row.variantLabel || "",
      name: row.name,
      sku: row.sku,
      rate: row.rate || "",
      attendantsNeeded: Number(row.attendantsNeeded || 0),
      sourceCategoryCode: row.sourceCategoryCode || "",
      motorsToPump: Number(row.motorsToPump || 0),
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
    const persistedSubtotalCents = Number(order.subtotalCents);
    const discountCents = Math.max(0, Number(order.discountCents || 0));
    const deliveryFeeCents = Math.max(0, Number(order.deliveryFeeCents || 0));
    const serviceFeeCents = Math.max(0, Number(order.serviceFeeCents || 0));
    const persistedGrandTotalCents = Number(order.grandTotalCents ?? order.total_amount);
    const expectedGrandTotalCents = itemsSubtotalCents - discountCents + deliveryFeeCents + serviceFeeCents;
    const adjustmentCents = Number.isFinite(persistedGrandTotalCents)
      ? persistedGrandTotalCents - expectedGrandTotalCents
      : 0;
    if (adjustmentCents !== 0) {
      items.push({
        id: "order-adjustment",
        name: adjustmentCents < 0 ? "Discount" : "Adjustment",
        sku: null,
        rate: "",
        quantity: 1,
        unitPriceCents: adjustmentCents,
        totalCents: adjustmentCents,
        unitPrice: adjustmentCents / 100,
        total: adjustmentCents / 100,
      });
    }

    if (deliveryFeeCents > 0) {
      items.push({
        id: "delivery-fee",
        name: "Delivery fee",
        sku: null,
        rate: "",
        quantity: 1,
        unitPriceCents: deliveryFeeCents,
        totalCents: deliveryFeeCents,
        unitPrice: deliveryFeeCents / 100,
        total: deliveryFeeCents / 100,
      });
    }
    if (serviceFeeCents > 0) {
      items.push({
        id: "service-fee",
        name: "Service fee",
        sku: null,
        rate: "",
        quantity: 1,
        unitPriceCents: serviceFeeCents,
        totalCents: serviceFeeCents,
        unitPrice: serviceFeeCents / 100,
        total: serviceFeeCents / 100,
      });
    }
    if (discountCents > 0) {
      items.push({
        id: "discount",
        name: "Discount",
        sku: null,
        rate: "",
        quantity: 1,
        unitPriceCents: -discountCents,
        totalCents: -discountCents,
        unitPrice: -discountCents / 100,
        total: -discountCents / 100,
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

    const subtotalCents = Number.isFinite(persistedSubtotalCents)
      ? persistedSubtotalCents
      : itemsSubtotalCents;
    const taxRate = 0;
    const taxTotalCents = 0;
    const grandTotalCents = Number.isFinite(persistedGrandTotalCents)
      ? persistedGrandTotalCents
      : expectedGrandTotalCents;

    return json(event, 200, {
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
        discount: discountCents / 100,
        deliveryFee: deliveryFeeCents / 100,
        serviceFee: serviceFeeCents / 100,
        taxRate,
        taxTotal: taxTotalCents / 100,
        grandTotal: grandTotalCents / 100,
      },
      expenses,
      expensesTotal: expensesTotalCents / 100,
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return json(event, 500, { error: "Failed to generate invoice" });
  } finally {
    await client.end().catch(() => {});
  }
}
