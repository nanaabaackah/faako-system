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
    case "yesterday": {
      const start = new Date(Date.UTC(year, month, now.getUTCDate() - 1));
      const end = new Date(Date.UTC(year, month, now.getUTCDate()));
      return { start, end, label: "Yesterday" };
    }
    case "last7Days": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const end = now;
      return { start, end, label: "Last 7 days" };
    }
    case "previous7Days": {
      const end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end, label: "Previous 7 days" };
    }
    case "last30Days": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = now;
      return { start, end, label: "Last 30 days" };
    }
    case "previous30Days": {
      const end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end, label: "Previous 30 days" };
    }
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

const hasTable = async (client, tableName, schema = "public") => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2
     LIMIT 1`,
    [schema, tableName]
  );
  return result.rowCount > 0;
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizePositiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeLineQuantity = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const normalizeLineRowType = (value) => {
  const rowType = String(value || "item").toLowerCase();
  if (rowType === "heading") return "heading";
  if (rowType === "note") return "note";
  return "item";
};

const isPerHeadRateLabel = (value) => /\bhead\b/i.test(String(value || ""));

const normalizeLineItems = (items) =>
  parseArrayField(items).map((item, index) => {
    const rowType = normalizeLineRowType(item?.rowType);
    if (rowType !== "item") {
      return {
        id: item?.id || `line-${index + 1}`,
        rowType,
        productId: null,
        quantity: 0,
        unitLabel: "",
        unitPrice: 0,
        total: 0,
      };
    }

    const quantity = normalizeLineQuantity(item?.quantity, 1);
    const unitPrice = Math.max(0, toNumber(item?.unitPrice, 0));
    return {
      id: item?.id || `line-${index + 1}`,
      rowType,
      productId: normalizePositiveId(item?.productId),
      quantity,
      unitLabel: String(item?.unitLabel || ""),
      unitPrice,
      total: Math.max(0, toNumber(item?.total, quantity * unitPrice)),
    };
  });

const normalizeAdditionalItems = (items) =>
  parseArrayField(items).map((item, index) => {
    const quantity = normalizeLineQuantity(item?.quantity, 1);
    const unitPrice = Math.max(0, toNumber(item?.unitPrice, 0));
    return {
      id: item?.id || `additional-${index + 1}`,
      quantity,
      unitPrice,
      total: Math.max(0, toNumber(item?.total, quantity * unitPrice)),
    };
  });

const normalizeTaxRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const normalizeDocumentType = (value) =>
  String(value || "").trim().toLowerCase() === "receipt" ? "receipt" : "invoice";

const computeDocumentGrandTotal = (document) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  const additionalItems = normalizeAdditionalItems(document?.additionalItems);
  const subtotal = lineItems.reduce((sum, item) => sum + toNumber(item.total), 0);
  const additionalTotal = additionalItems.reduce((sum, item) => sum + toNumber(item.total), 0);
  const taxRate = normalizeTaxRate(document?.taxRate);
  const taxTotal = Math.round((subtotal + additionalTotal) * taxRate * 100) / 100;
  const discountAmount = Math.max(0, toNumber(document?.discountAmount, 0));
  const discountTotal = Math.min(discountAmount, subtotal + additionalTotal + taxTotal);
  return Math.max(0, Math.round((subtotal + additionalTotal + taxTotal - discountTotal) * 100) / 100);
};

const toDateKey = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeSku = (sku) => (typeof sku === "string" ? sku.trim().toUpperCase() : "");

const selectProductCostMap = async (client, organizationId, productIds = []) => {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();

  const result = await client.query(
    `SELECT id, COALESCE("purchasePriceGhs", 0) AS cost_cents
     FROM "product"
     WHERE id = ANY($1::int[])
       AND "organizationId" = $2`,
    [ids, organizationId]
  );

  return new Map(
    (result.rows || []).map((row) => [Number(row.id), Number(row.cost_cents || 0)])
  );
};

const getLineItemCogsQuantity = (item) => {
  const quantity = normalizeLineQuantity(item?.quantity, 0);
  if (quantity <= 0) return 0;
  return isPerHeadRateLabel(item?.unitLabel) ? 1 : quantity;
};

const buildInvoiceDocumentFinancials = async ({
  client,
  organizationId,
  startIso,
  endIso,
  enabled,
}) => {
  const empty = {
    receiptCents: 0,
    invoiceCents: 0,
    cogsCents: 0,
    units: 0,
    receiptCount: 0,
    invoiceCount: 0,
    dailyCents: new Map(),
  };
  if (!enabled) return empty;

  const result = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "documentType",
       "lineItems",
       "additionalItems",
       "taxRate",
       "discountAmount",
       COALESCE("issueDate", "eventDate", "createdAt"::date, "updatedAt"::date) AS bucket
     FROM "invoiceDocument"
     WHERE "organizationId" = $1
       AND "archivedAt" IS NULL
       AND COALESCE("issueDate"::timestamptz, "eventDate"::timestamptz, "createdAt", "updatedAt") >= $2
       AND COALESCE("issueDate"::timestamptz, "eventDate"::timestamptz, "createdAt", "updatedAt") < $3`,
    [organizationId, startIso, endIso]
  );

  const documents = (result.rows || []).map((row) => ({
    ...row,
    documentType: normalizeDocumentType(row.documentType),
    lineItems: normalizeLineItems(row.lineItems),
    additionalItems: normalizeAdditionalItems(row.additionalItems),
    grandTotal: computeDocumentGrandTotal(row),
  }));

  const productIds = documents.flatMap((document) =>
    document.lineItems
      .map((item) => item.productId)
      .filter((productId) => Number.isInteger(productId) && productId > 0)
  );
  const productCostMap = await selectProductCostMap(client, organizationId, productIds);

  return documents.reduce((accumulator, document) => {
    const totalCents = Math.round(toNumber(document.grandTotal, 0) * 100);
    const bucket = toDateKey(document.bucket);
    if (bucket && totalCents > 0) {
      accumulator.dailyCents.set(bucket, (accumulator.dailyCents.get(bucket) || 0) + totalCents);
    }

    if (document.documentType === "receipt") {
      accumulator.receiptCents += totalCents;
      accumulator.receiptCount += 1;
      for (const item of document.lineItems) {
        const productId = normalizePositiveId(item.productId);
        if (!productId) continue;
        const quantity = getLineItemCogsQuantity(item);
        accumulator.units += quantity;
        accumulator.cogsCents += quantity * (productCostMap.get(productId) || 0);
      }
    } else {
      accumulator.invoiceCents += totalCents;
      accumulator.invoiceCount += 1;
    }

    return accumulator;
  }, empty);
};

const buildDocumentFallbackFilter = ({ enabled, alias, sourceType }) => {
  if (!enabled) return "";
  return `AND NOT EXISTS (
             SELECT 1
             FROM "invoiceDocument" d
             WHERE d."organizationId" = ${alias}."organizationId"
               AND d."sourceType" = '${sourceType}'
               AND d."sourceId" = ${alias}.id
               AND d."archivedAt" IS NULL
           )`;
};

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

    const [orderHasOrg, bookingHasOrg, invoiceDocumentHasTable] = await Promise.all([
      hasColumn(client, "order", "organizationId"),
      hasColumn(client, "booking", "organizationId"),
      hasTable(client, "invoiceDocument"),
    ]);
    const invoiceDocumentHasOrg = invoiceDocumentHasTable
      ? await hasColumn(client, "invoiceDocument", "organizationId")
      : false;
    const canUseInvoiceDocuments = invoiceDocumentHasTable && invoiceDocumentHasOrg;

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const orderParams = orderHasOrg ? [startIso, endIso, organizationId] : [startIso, endIso];
    const bookingParams = bookingHasOrg ? [startIso, endIso, organizationId] : [startIso, endIso];
    const orderOrgFilter = orderHasOrg ? `AND o."organizationId" = $3` : "";
    const bookingOrgFilter = bookingHasOrg ? `AND b."organizationId" = $3` : "";
    const orderDocumentFallbackFilter = buildDocumentFallbackFilter({
      enabled: canUseInvoiceDocuments && orderHasOrg,
      alias: "o",
      sourceType: "orders",
    });
    const bookingDocumentFallbackFilter = buildDocumentFallbackFilter({
      enabled: canUseInvoiceDocuments && bookingHasOrg,
      alias: "b",
      sourceType: "bookings",
    });

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
      documentFinancials,
    ] = await Promise.all([
      client.query(
        `SELECT
           COALESCE((
             SELECT COUNT(*)
             FROM "order" o
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
               ${orderDocumentFallbackFilter}
           ), 0)::int AS orders,
           COALESCE((
             SELECT SUM(o.total_amount)
             FROM "order" o
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
               ${orderDocumentFallbackFilter}
           ), 0) AS revenue_cents,
           COALESCE((
             SELECT SUM(oi.quantity)
             FROM "order" o
             JOIN "orderItem" oi ON oi."orderId" = o.id
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
               ${orderDocumentFallbackFilter}
           ), 0)::int AS units,
           COALESCE((
             SELECT SUM(oi.quantity * COALESCE(p."purchasePriceGhs", 0))
             FROM "order" o
             JOIN "orderItem" oi ON oi."orderId" = o.id
             JOIN "product" p ON p.id = oi."productId"
             WHERE o."orderDate" >= $1
               AND o."orderDate" < $2
               ${orderOrgFilter}
               ${orderDocumentFallbackFilter}
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
           ${orderDocumentFallbackFilter}
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
           ${orderDocumentFallbackFilter}
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
           ${orderOrgFilter}
           ${orderDocumentFallbackFilter}`,
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
           ${orderDocumentFallbackFilter}
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
           ${orderDocumentFallbackFilter}
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
           ${bookingOrgFilter}
           ${bookingDocumentFallbackFilter}`,
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
           ${bookingDocumentFallbackFilter}
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
           ${bookingDocumentFallbackFilter}
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
      buildInvoiceDocumentFinancials({
        client,
        organizationId,
        startIso,
        endIso,
        enabled: canUseInvoiceDocuments,
      }),
    ]);

    const categoryMap = { retail: 0, rental: 0, other: 0 };
    const addToCategory = (cat, cents) => {
      if (cat === "rental") {
        categoryMap.rental += cents;
      } else if (cat === "other") {
        categoryMap.other += cents;
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

    categoryMap.retail += documentFinancials.receiptCents;
    categoryMap.rental += documentFinancials.invoiceCents;

    const rawBookingRevenueCents = Number(bookingSummary.rows[0]?.revenue_cents || 0);
    const bookingRevenueCents = rawBookingRevenueCents + documentFinancials.invoiceCents;
    const bookingCount = (bookingSummary.rows[0]?.bookings || 0) + documentFinancials.invoiceCount;
    categoryMap.rental += rawBookingRevenueCents;

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

    const rawOrderRevenueCents = Number(summary.rows[0]?.revenue_cents || 0) + deliveryFeeCentsTotal;
    const orderRevenueCents = rawOrderRevenueCents + documentFinancials.receiptCents;
    const costCents = Number(summary.rows[0]?.cost_cents || 0) + documentFinancials.cogsCents;
    const expenseWindowCents = Number(expenseSummary.totalCents || 0);
    const grossProfitCents = orderRevenueCents - costCents + bookingRevenueCents;
    const netProfitCents = grossProfitCents - expenseWindowCents;

    const cashflowMap = new Map();
    for (const row of cashflowRows.rows || []) {
      const key = toDateKey(row.bucket);
      if (!key) continue;
      cashflowMap.set(key, Number(row.revenue_cents || 0));
    }
    for (const row of bookingDaily.rows || []) {
      const key = toDateKey(row.bucket);
      if (!key) continue;
      const existing = cashflowMap.get(key) || 0;
      cashflowMap.set(key, existing + Number(row.revenue_cents || 0));
    }
    for (const [key, cents] of deliveryFeeTotals.entries()) {
      const dateKey = toDateKey(key);
      if (!dateKey) continue;
      const existing = cashflowMap.get(dateKey) || 0;
      cashflowMap.set(dateKey, existing + cents);
    }
    for (const [key, cents] of documentFinancials.dailyCents.entries()) {
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
      orders: (summary.rows[0]?.orders || 0) + documentFinancials.receiptCount,
      bookings: bookingCount,
      bookingRevenue: bookingRevenueCents / 100,
      revenue: (orderRevenueCents + bookingRevenueCents) / 100,
      units: (summary.rows[0]?.units || 0) + documentFinancials.units,
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
          invoiceDocuments: canUseInvoiceDocuments,
        },
        expenseSourceTable: expenseSummary.tableLabel,
        incomeSource: canUseInvoiceDocuments ? "invoiceDocument+fallback" : "orders+bookings",
      },
    });
  } catch (err) {
    console.error("❌ Financial stats error:", err);
    return json(event, 500, { error: "Failed to load financial stats" });
  } finally {
    await client.end().catch(() => {});
  }
}
