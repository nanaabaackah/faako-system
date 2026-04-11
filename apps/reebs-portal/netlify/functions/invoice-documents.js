/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { ensureAuditColumns } from "./auditHelpers.js";

const INVOICE_DOCUMENT_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const SOURCE_TYPES = new Set(["manual", "orders", "bookings"]);
const DOCUMENT_TYPES = new Set(["invoice", "receipt"]);
const PAYMENT_STATUSES = new Set(["draft", "unpaid", "paid"]);
const INVENTORY_MANAGED_SOURCE_TYPES = new Set(["manual", "bookings"]);

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "invoiceDocument" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" INTEGER,
    "customerId" INTEGER,
    "documentType" TEXT NOT NULL DEFAULT 'invoice',
    "title" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATE,
    "dueDate" DATE,
    "paymentStatus" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMPTZ,
    "sentToEmail" TEXT,
    "stockCommittedAt" TIMESTAMPTZ,
    "depositAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "eventDate" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "venueAddress" TEXT,
    "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "expenses" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "additionalItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "terms" TEXT,
    "taxRate" NUMERIC(8,4) NOT NULL DEFAULT 0,
    "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "archivedAt" TIMESTAMPTZ,
    "archivedByUserId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "sourceId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "customerId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'invoice'`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "title" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "issueDate" DATE`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "dueDate" DATE`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMPTZ`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "sentToEmail" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "stockCommittedAt" TIMESTAMPTZ`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "depositAmount" NUMERIC(12,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "customerName" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "eventDate" DATE`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "startTime" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "endTime" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "venueAddress" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "expenses" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "additionalItems" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "terms" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC(8,4) NOT NULL DEFAULT 0`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "invoiceDocument_linked_unique_idx"
    ON "invoiceDocument" ("organizationId", "sourceType", "sourceId")
    WHERE "sourceType" <> 'manual' AND "sourceId" IS NOT NULL`,
];

let hasEnsuredInvoiceDocumentTable = false;
let invoiceDocumentTablePromise = null;
let hasEnsuredInvoiceAuditColumns = false;
let invoiceAuditColumnsPromise = null;

const ensureInvoiceDocumentTable = async (client) => {
  if (hasEnsuredInvoiceDocumentTable) return;

  if (!invoiceDocumentTablePromise) {
    invoiceDocumentTablePromise = (async () => {
      for (const statement of tableStatements) {
        try {
          await client.query(statement);
        } catch (err) {
          console.warn("Invoice document table check failed:", err?.message || err);
        }
      }
      hasEnsuredInvoiceDocumentTable = true;
    })().finally(() => {
      invoiceDocumentTablePromise = null;
    });
  }

  await invoiceDocumentTablePromise;
};

const ensureInvoiceAuditColumns = async (client) => {
  if (hasEnsuredInvoiceAuditColumns) return;

  if (!invoiceAuditColumnsPromise) {
    invoiceAuditColumnsPromise = (async () => {
      await ensureAuditColumns(client);
      hasEnsuredInvoiceAuditColumns = true;
    })().finally(() => {
      invoiceAuditColumnsPromise = null;
    });
  }

  await invoiceAuditColumnsPromise;
};

const cleanText = (value, maxLength = 400) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const cleanNullableText = (value, maxLength = 400) => {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
};

const normalizeSourceType = (value) => {
  const normalized = cleanText(value, 20).toLowerCase();
  return SOURCE_TYPES.has(normalized) ? normalized : "manual";
};

const normalizeDocumentType = (value) => {
  const normalized = cleanText(value, 20).toLowerCase();
  return DOCUMENT_TYPES.has(normalized) ? normalized : "invoice";
};

const normalizePaymentStatus = (value) => {
  const normalized = cleanText(value, 20).toLowerCase();
  return PAYMENT_STATUSES.has(normalized) ? normalized : "draft";
};

const shouldManageInventory = (value) => INVENTORY_MANAGED_SOURCE_TYPES.has(normalizeSourceType(value));

const normalizeId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMoney = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.round(amount * 100) / 100;
};

const normalizeTaxRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const normalized = rate > 1 ? rate / 100 : rate;
  return Math.min(Math.max(normalized, 0), 1);
};

const normalizeLineQuantity = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const normalizeLineRowType = (value) => {
  const normalized = String(value || "item").toLowerCase();
  if (normalized === "heading") return "heading";
  if (normalized === "note") return "note";
  return "item";
};

const normalizeLineUnitLabel = (value) => {
  const cleaned = cleanText(value, 80);
  return cleaned || "Per item";
};

const isPerHeadRateLabel = (value) => /\bhead\b/i.test(String(value || ""));

const normalizeDateValue = (value) => {
  const cleaned = cleanText(value, 32);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeTimestampValue = (value) => {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatDateStamp = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return parsed.toISOString().slice(0, 10).replaceAll("-", "");
};

const buildDocumentNumber = (documentType) => {
  const prefix = documentType === "receipt" ? "REC" : "INV";
  return `${prefix}-${formatDateStamp()}-${String(Date.now()).slice(-5)}`;
};

const getDocumentKindLabel = (documentType) => (documentType === "receipt" ? "Receipt" : "Invoice");

const getDocumentAuditLabel = (record) => {
  const invoiceNumber = cleanText(record?.invoiceNumber, 120);
  if (!invoiceNumber) return "Draft";
  return `${getDocumentKindLabel(record?.documentType)} #${invoiceNumber}`;
};

const applyDocumentLifecycleDefaults = (record) => {
  const normalized = { ...record };
  const paymentStatus = normalizePaymentStatus(normalized.paymentStatus);
  const invoiceNumber = cleanText(normalized.invoiceNumber, 120);
  normalized.paymentStatus = paymentStatus;
  normalized.invoiceNumber = invoiceNumber;

  if ((normalized.sentAt || paymentStatus !== "draft") && !invoiceNumber) {
    normalized.invoiceNumber = buildDocumentNumber(normalized.documentType);
  }
  if (normalized.sentAt && normalized.paymentStatus === "draft") {
    normalized.paymentStatus = "unpaid";
  }
  return normalized;
};

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 200)
    .map((item, index) => {
      const rowType = normalizeLineRowType(item?.rowType);
      const quantity = normalizeLineQuantity(item?.quantity, 1);
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      const name = cleanText(item?.name, 240);
      return {
        id: cleanText(item?.id, 80) || `line-${index + 1}`,
        rowType,
        productId: normalizeId(item?.productId),
        name,
        unitLabel: rowType === "item" ? normalizeLineUnitLabel(item?.unitLabel) : "",
        quantity: rowType === "item" ? quantity : 0,
        unitPrice: rowType === "item" ? unitPrice : 0,
        total: rowType === "item" ? Math.round(quantity * unitPrice * 100) / 100 : 0,
      };
    });
};

const addProductQuantity = (map, productId, quantity) => {
  if (!Number.isInteger(productId) || productId <= 0) return;
  const normalizedQuantity = normalizeLineQuantity(quantity, 0);
  if (normalizedQuantity <= 0) return;
  map.set(productId, (map.get(productId) || 0) + normalizedQuantity);
};

const buildLineItemProductQuantityMap = (lineItems) => {
  const quantities = new Map();
  normalizeLineItems(lineItems).forEach((item) => {
    if (item.rowType !== "item") return;
    const quantity = isPerHeadRateLabel(item.unitLabel)
      ? normalizeLineQuantity(item.quantity, 0) > 0
        ? 1
        : 0
      : item.quantity;
    addProductQuantity(quantities, normalizeId(item.productId), quantity);
  });
  return quantities;
};

const collectProductIdsFromMaps = (...maps) =>
  [...new Set(maps.flatMap((map) => (map instanceof Map ? [...map.keys()] : [])))];

const isInventoryCommittedDocument = (document) =>
  shouldManageInventory(document?.sourceType) && Boolean(document?.stockCommittedAt) && !document?.archivedAt;

const selectProductsForInventory = async (client, organizationId, productIds = []) => {
  if (!productIds.length) return new Map();
  const result = await client.query(
    `SELECT
       id,
       name,
       stock,
       COALESCE("isActive", true) AS "isActive"
     FROM "product"
     WHERE id = ANY($1::int[])
       AND "organizationId" = $2
     FOR UPDATE`,
    [productIds, organizationId]
  );
  return new Map((result.rows || []).map((row) => [Number(row.id), row]));
};

const validateCommittedInventory = ({ requestedQuantities, previouslyCommittedQuantities, productMap }) => {
  for (const [productId, requestedQuantity] of requestedQuantities.entries()) {
    const product = productMap.get(productId);
    if (!product) {
      return `Product ${productId} was not found.`;
    }
    if (product.isActive === false) {
      return `${product.name || `Product ${productId}`} is unavailable.`;
    }
    const currentStock = Math.max(0, normalizeLineQuantity(product.stock, 0));
    const previouslyCommitted = previouslyCommittedQuantities.get(productId) || 0;
    const availableToDocument = currentStock + previouslyCommitted;
    if (requestedQuantity > availableToDocument) {
      return `${product.name || `Product ${productId}`} only has ${availableToDocument} in stock.`;
    }
  }
  return "";
};

const buildInventoryDeltaMap = (previouslyCommittedQuantities, nextCommittedQuantities) => {
  const delta = new Map();
  collectProductIdsFromMaps(previouslyCommittedQuantities, nextCommittedQuantities).forEach((productId) => {
    const difference =
      (nextCommittedQuantities.get(productId) || 0) - (previouslyCommittedQuantities.get(productId) || 0);
    if (difference !== 0) {
      delta.set(productId, difference);
    }
  });
  return delta;
};

const applyInventoryDelta = async (
  client,
  { organizationId, deltaMap, productMap, authUser, documentLabel, reference }
) => {
  for (const [productId, delta] of deltaMap.entries()) {
    const quantity = Math.abs(Number.parseInt(String(delta ?? ""), 10) || 0);
    if (quantity <= 0) continue;
    const product = productMap.get(productId);
    const stockType = delta > 0 ? "StockOut" : "StockIn";
    const updateResult =
      delta > 0
        ? await client.query(
            `UPDATE "product"
             SET stock = stock - $1,
                 "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
                 "lastUpdatedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $2
               AND "organizationId" = $4
               AND COALESCE("isActive", true) = true
               AND stock >= $1`,
            [quantity, productId, authUser.id, organizationId]
          )
        : await client.query(
            `UPDATE "product"
             SET stock = stock + $1,
                 "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
                 "lastUpdatedAt" = NOW(),
                 "updatedAt" = NOW()
             WHERE id = $2
               AND "organizationId" = $4`,
            [quantity, productId, authUser.id, organizationId]
          );

    if (updateResult.rowCount === 0) {
      throw new Error(
        delta > 0
          ? `${product?.name || `Product ${productId}`} no longer has enough stock.`
          : `Failed to restore ${product?.name || `Product ${productId}`} stock.`
      );
    }

    await client.query(
      `INSERT INTO "stockMovement" (
         "organizationId",
         "productId",
         "type",
         "quantity",
         "notes",
         "reference",
         "date",
         "performedByUserId",
         "performedByName",
         "performedByEmail",
         "createdAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW())`,
      [
        organizationId,
        productId,
        stockType,
        quantity,
        delta > 0 ? `Committed to ${documentLabel}` : `Released from ${documentLabel}`,
        reference,
        authUser.id,
        authUser.fullName || authUser.name || authUser.email || "Internal user",
        authUser.email || null,
      ]
    );
  }
};

const normalizeExpenses = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 100)
    .map((item, index) => ({
      id: cleanText(item?.id, 80) || `expense-${index + 1}`,
      category: cleanText(item?.category, 120) || "Expense",
      description: cleanText(item?.description, 400),
      date: normalizeDateValue(item?.date),
      amount: Math.max(0, normalizeMoney(item?.amount, 0)),
    }));
};

const normalizeAdditionalItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 100)
    .map((item, index) => {
      const quantity = normalizeLineQuantity(item?.quantity, 1);
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      return {
        id: cleanText(item?.id, 80) || `additional-${index + 1}`,
        description: cleanText(item?.description, 240),
        quantity,
        unitLabel: normalizeLineUnitLabel(item?.unitLabel),
        unitPrice,
        total: Math.round(quantity * unitPrice * 100) / 100,
      };
    });
};

const computeGrandTotalFromRecord = (record) => {
  const lineItems = normalizeLineItems(record?.lineItems);
  const additionalItems = normalizeAdditionalItems(record?.additionalItems);
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const additionalTotal = additionalItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const taxRate = normalizeTaxRate(record?.taxRate);
  const taxTotal = Math.round((subtotal + additionalTotal) * taxRate * 100) / 100;
  const discountAmount = Math.max(0, normalizeMoney(record?.discountAmount, 0));
  const discountTotal = Math.min(discountAmount, subtotal + additionalTotal + taxTotal);
  return Math.max(0, Math.round((subtotal + additionalTotal + taxTotal - discountTotal) * 100) / 100);
};

const buildCompactDocumentRecord = (record) => ({
  id: Number(record?.id) || null,
  sourceType: record?.sourceType || "manual",
  sourceId: normalizeId(record?.sourceId),
  customerId: normalizeId(record?.customerId),
  documentType: normalizeDocumentType(record?.documentType),
  title: cleanNullableText(record?.title, 200),
  invoiceNumber: cleanText(record?.invoiceNumber, 120),
  issueDate: normalizeDateValue(record?.issueDate),
  dueDate: normalizeDateValue(record?.dueDate),
  paymentStatus: normalizePaymentStatus(record?.paymentStatus),
  sentAt: normalizeTimestampValue(record?.sentAt),
  sentToEmail: cleanNullableText(record?.sentToEmail, 200),
  stockCommittedAt: normalizeTimestampValue(record?.stockCommittedAt),
  depositAmount: Math.max(0, normalizeMoney(record?.depositAmount, 0)),
  customerName: cleanNullableText(record?.customerName, 200),
  customerEmail: cleanNullableText(record?.customerEmail, 200),
  customerPhone: cleanNullableText(record?.customerPhone, 80),
  eventDate: normalizeDateValue(record?.eventDate),
  startTime: cleanNullableText(record?.startTime, 40),
  endTime: cleanNullableText(record?.endTime, 40),
  venueAddress: cleanNullableText(record?.venueAddress, 240),
  taxRate: normalizeTaxRate(record?.taxRate),
  discountAmount: Math.max(0, normalizeMoney(record?.discountAmount, 0)),
  archivedAt: normalizeTimestampValue(record?.archivedAt),
  createdAt: normalizeTimestampValue(record?.createdAt),
  updatedAt: normalizeTimestampValue(record?.updatedAt),
  grandTotal: computeGrandTotalFromRecord(record),
});

const normalizePayload = (payload = {}) => {
  const sourceType = normalizeSourceType(payload.sourceType);
  return applyDocumentLifecycleDefaults({
    sourceType,
    sourceId: sourceType === "manual" ? null : normalizeId(payload.sourceId),
    customerId: normalizeId(payload.customerId),
    documentType: normalizeDocumentType(payload.documentType),
    title: cleanNullableText(payload.title, 200),
    invoiceNumber: cleanText(payload.invoiceNumber, 120),
    issueDate: normalizeDateValue(payload.issueDate),
    dueDate: normalizeDateValue(payload.dueDate),
    paymentStatus: normalizePaymentStatus(payload.paymentStatus),
    sentAt: normalizeTimestampValue(payload.sentAt),
    sentToEmail: cleanNullableText(payload.sentToEmail, 200),
    depositAmount: Math.max(0, normalizeMoney(payload.depositAmount, 0)),
    customerName: cleanNullableText(payload.customerName, 200),
    customerEmail: cleanNullableText(payload.customerEmail, 200),
    customerPhone: cleanNullableText(payload.customerPhone, 80),
    eventDate: normalizeDateValue(payload.eventDate),
    startTime: cleanNullableText(payload.startTime, 40),
    endTime: cleanNullableText(payload.endTime, 40),
    venueAddress: cleanNullableText(payload.venueAddress, 240),
    lineItems: normalizeLineItems(payload.lineItems),
    expenses: normalizeExpenses(payload.expenses),
    additionalItems: normalizeAdditionalItems(payload.additionalItems),
    notes: cleanNullableText(payload.notes, 4000),
    terms: cleanNullableText(payload.terms, 4000),
    taxRate: normalizeTaxRate(payload.taxRate),
    discountAmount: Math.max(0, normalizeMoney(payload.discountAmount, 0)),
  });
};

const validatePayload = (record) => {
  if (record.sourceType !== "manual" && !record.sourceId) return "Linked document source is required.";
  if (!DOCUMENT_TYPES.has(record.documentType)) return "Invalid document type.";
  if (!PAYMENT_STATUSES.has(record.paymentStatus)) return "Invalid payment status.";
  return "";
};

const selectDocuments = async (client, organizationId, { compact = false } = {}) => {
  const compactResult = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "customerId",
       "documentType",
       title,
       "invoiceNumber",
       "issueDate",
       "dueDate",
       "paymentStatus",
       "sentAt",
       "sentToEmail",
       "stockCommittedAt",
       "depositAmount",
       "customerName",
       "customerEmail",
       "customerPhone",
       "eventDate",
       "startTime",
       "endTime",
       "venueAddress",
       "lineItems",
       "additionalItems",
       "taxRate",
       "discountAmount",
       "archivedAt",
       "createdAt",
       "updatedAt"
     FROM "invoiceDocument"
     WHERE "organizationId" = $1
     ORDER BY "updatedAt" DESC, id DESC`,
    [organizationId]
  );

  if (compact) {
    return (compactResult.rows || []).map(buildCompactDocumentRecord);
  }

  const fullIds = (compactResult.rows || []).map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!fullIds.length) return [];
  const fullResult = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "customerId",
       "documentType",
       title,
       "invoiceNumber",
       "issueDate",
       "dueDate",
       "paymentStatus",
       "sentAt",
       "sentToEmail",
       "stockCommittedAt",
       "depositAmount",
       "customerName",
       "customerEmail",
       "customerPhone",
       "eventDate",
       "startTime",
       "endTime",
       "venueAddress",
       "lineItems",
       "expenses",
       "additionalItems",
       notes,
       terms,
       "taxRate",
       "discountAmount",
       "archivedAt",
       "createdAt",
       "updatedAt"
     FROM "invoiceDocument"
     WHERE id = ANY($1::int[])
       AND "organizationId" = $2
     ORDER BY "updatedAt" DESC, id DESC`,
    [fullIds, organizationId]
  );
  return fullResult.rows || [];
};

const selectDocumentById = async (client, organizationId, id) => {
  const result = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "customerId",
       "documentType",
       title,
       "invoiceNumber",
       "issueDate",
       "dueDate",
       "paymentStatus",
       "sentAt",
       "sentToEmail",
       "stockCommittedAt",
       "depositAmount",
       "customerName",
       "customerEmail",
       "customerPhone",
       "eventDate",
       "startTime",
       "endTime",
       "venueAddress",
       "lineItems",
       "expenses",
       "additionalItems",
       notes,
       terms,
       "taxRate",
       "discountAmount",
       "archivedAt",
       "createdAt",
       "updatedAt"
     FROM "invoiceDocument"
     WHERE id = $1 AND "organizationId" = $2
     LIMIT 1`,
    [id, organizationId]
  );
  return result.rows[0] || null;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: INVOICE_DOCUMENT_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });
  let transactionOpen = false;

  try {
    await client.connect();
    const authResult = await requireInternalUser(client, event, {
      methods: INVOICE_DOCUMENT_METHODS,
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;

    await ensureInvoiceDocumentTable(client);
    if (event.httpMethod !== "GET") {
      await ensureInvoiceAuditColumns(client);
    }

    if (event.httpMethod === "GET") {
      const compact = String(event.queryStringParameters?.compact || "").trim() === "1";
      const id = normalizeId(event.queryStringParameters?.id);
      if (id) {
        const document = await selectDocumentById(client, organizationId, id);
        if (!document) {
          return respond(event, 404, { error: "Document not found." }, { methods: INVOICE_DOCUMENT_METHODS });
        }
        return respond(event, 200, document, { methods: INVOICE_DOCUMENT_METHODS });
      }
      const documents = await selectDocuments(client, organizationId, { compact });
      return respond(event, 200, documents, { methods: INVOICE_DOCUMENT_METHODS });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return respond(event, 400, { error: "Invalid JSON body." }, { methods: INVOICE_DOCUMENT_METHODS });
    }

    if (event.httpMethod === "DELETE") {
      const id = normalizeId(payload.id);
      const normalized = normalizePayload(payload);

      if (!id && (normalized.sourceType === "manual" || !normalized.sourceId)) {
        return respond(
          event,
          400,
          { error: "Document id or linked document source is required." },
          { methods: INVOICE_DOCUMENT_METHODS }
        );
      }

      await client.query("BEGIN");
      transactionOpen = true;

      let archivedId = id;
      let existingDocument = archivedId
        ? await selectDocumentById(client, organizationId, archivedId)
        : null;
      if (!archivedId && normalized.sourceType !== "manual" && normalized.sourceId) {
        const existing = await client.query(
          `SELECT id
           FROM "invoiceDocument"
           WHERE "organizationId" = $1
             AND "sourceType" = $2
             AND "sourceId" = $3
           LIMIT 1`,
          [organizationId, normalized.sourceType, normalized.sourceId]
        );

        if (existing.rowCount > 0) {
          archivedId = existing.rows[0].id;
        } else {
          const inserted = await client.query(
            `INSERT INTO "invoiceDocument" (
               "organizationId",
               "sourceType",
               "sourceId",
               "customerId",
               "documentType",
               title,
               "invoiceNumber",
               "issueDate",
               "dueDate",
               "paymentStatus",
               "sentAt",
               "sentToEmail",
               "stockCommittedAt",
               "depositAmount",
               "customerName",
               "customerEmail",
               "customerPhone",
               "eventDate",
               "startTime",
               "endTime",
               "venueAddress",
               "lineItems",
               "expenses",
               "additionalItems",
               notes,
               terms,
               "taxRate",
               "discountAmount",
               "createdByUserId",
               "updatedByUserId",
               "archivedAt",
               "archivedByUserId",
               "createdAt",
               "updatedAt"
             )
             VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27,$28,$29,$29,NOW(),$29,NOW(),NOW()
             )
             RETURNING id`,
            [
              organizationId,
              normalized.sourceType,
              normalized.sourceId,
              normalized.customerId,
              normalized.documentType,
              normalized.title,
              normalized.invoiceNumber,
              normalized.issueDate,
              normalized.dueDate,
              normalized.paymentStatus,
              normalized.sentAt,
              normalized.sentToEmail,
              null,
              normalized.depositAmount,
              normalized.customerName,
              normalized.customerEmail,
              normalized.customerPhone,
              normalized.eventDate,
              normalized.startTime,
              normalized.endTime,
              normalized.venueAddress,
              JSON.stringify(normalized.lineItems),
              JSON.stringify(normalized.expenses),
              JSON.stringify(normalized.additionalItems),
              normalized.notes,
              normalized.terms,
              normalized.taxRate,
              normalized.discountAmount,
              authUser.id,
            ]
          );
          archivedId = inserted.rows[0]?.id || null;
          existingDocument = archivedId
            ? await selectDocumentById(client, organizationId, archivedId)
            : null;
        }
      }

      if (!existingDocument && archivedId) {
        existingDocument = await selectDocumentById(client, organizationId, archivedId);
      }

      if (!archivedId || !existingDocument) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return respond(event, 404, { error: "Document not found." }, { methods: INVOICE_DOCUMENT_METHODS });
      }

      if (isInventoryCommittedDocument(existingDocument)) {
        const committedQuantities = buildLineItemProductQuantityMap(existingDocument.lineItems);
        const productIds = collectProductIdsFromMaps(committedQuantities);
        const productMap = await selectProductsForInventory(client, organizationId, productIds);
        await applyInventoryDelta(client, {
          organizationId,
          deltaMap: buildInventoryDeltaMap(committedQuantities, new Map()),
          productMap,
          authUser,
          documentLabel: getDocumentAuditLabel(existingDocument),
          reference: cleanText(existingDocument.invoiceNumber, 120) || "Draft",
        });
      }

      await client.query(
        `UPDATE "invoiceDocument"
         SET "archivedAt" = NOW(),
             "archivedByUserId" = $1,
             "stockCommittedAt" = NULL,
             "updatedByUserId" = $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3`,
        [authUser.id, archivedId, organizationId]
      );

      const archivedDocument = await selectDocumentById(client, organizationId, archivedId);
      await client.query("COMMIT");
      transactionOpen = false;
      return respond(event, 200, archivedDocument, { methods: INVOICE_DOCUMENT_METHODS });
    }

    const normalized = normalizePayload(payload);
    const validationError = validatePayload(normalized);
    if (validationError) {
      return respond(event, 400, { error: validationError }, { methods: INVOICE_DOCUMENT_METHODS });
    }
    const documentLabel = getDocumentAuditLabel(normalized);

    if (event.httpMethod === "POST") {
      if (normalized.sourceType !== "manual") {
        const existing = await client.query(
          `SELECT id
           FROM "invoiceDocument"
           WHERE "organizationId" = $1
             AND "sourceType" = $2
             AND "sourceId" = $3
           LIMIT 1`,
          [organizationId, normalized.sourceType, normalized.sourceId]
        );
        if (existing.rowCount > 0) {
          payload.id = existing.rows[0].id;
        }
      }

      if (payload.id) {
        event.httpMethod = "PUT";
      } else {
        await client.query("BEGIN");
        transactionOpen = true;
        const requestedQuantities = shouldManageInventory(normalized.sourceType)
          ? buildLineItemProductQuantityMap(normalized.lineItems)
          : new Map();
        const nextCommittedQuantities =
          shouldManageInventory(normalized.sourceType) && normalized.sentAt ? requestedQuantities : new Map();
        const productIds = collectProductIdsFromMaps(requestedQuantities, nextCommittedQuantities);
        const productMap = await selectProductsForInventory(client, organizationId, productIds);
        const inventoryValidationError = validateCommittedInventory({
          requestedQuantities,
          previouslyCommittedQuantities: new Map(),
          productMap,
        });
        if (inventoryValidationError) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return respond(event, 409, { error: inventoryValidationError }, { methods: INVOICE_DOCUMENT_METHODS });
        }
        await applyInventoryDelta(client, {
          organizationId,
          deltaMap: buildInventoryDeltaMap(new Map(), nextCommittedQuantities),
          productMap,
          authUser,
          documentLabel,
          reference: normalized.invoiceNumber,
        });
        const stockCommittedAt =
          shouldManageInventory(normalized.sourceType) && normalized.sentAt
            ? new Date().toISOString()
            : null;
        const inserted = await client.query(
          `INSERT INTO "invoiceDocument" (
             "organizationId",
             "sourceType",
             "sourceId",
             "customerId",
             "documentType",
             title,
             "invoiceNumber",
             "issueDate",
             "dueDate",
             "paymentStatus",
             "sentAt",
             "sentToEmail",
             "stockCommittedAt",
             "depositAmount",
             "customerName",
             "customerEmail",
             "customerPhone",
             "eventDate",
             "startTime",
             "endTime",
             "venueAddress",
             "lineItems",
             "expenses",
             "additionalItems",
             notes,
             terms,
             "taxRate",
             "discountAmount",
             "createdByUserId",
             "updatedByUserId",
             "createdAt",
             "updatedAt"
             )
             VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27,$28,$29,$29,NOW(),NOW()
           )
           RETURNING id`,
          [
            organizationId,
            normalized.sourceType,
            normalized.sourceId,
            normalized.customerId,
            normalized.documentType,
            normalized.title,
            normalized.invoiceNumber,
            normalized.issueDate,
            normalized.dueDate,
            normalized.paymentStatus,
            normalized.sentAt,
            normalized.sentToEmail,
            stockCommittedAt,
            normalized.depositAmount,
            normalized.customerName,
            normalized.customerEmail,
            normalized.customerPhone,
            normalized.eventDate,
            normalized.startTime,
            normalized.endTime,
            normalized.venueAddress,
            JSON.stringify(normalized.lineItems),
            JSON.stringify(normalized.expenses),
            JSON.stringify(normalized.additionalItems),
            normalized.notes,
            normalized.terms,
            normalized.taxRate,
            normalized.discountAmount,
            authUser.id,
          ]
        );

        const document = await selectDocumentById(client, organizationId, inserted.rows[0].id);
        await client.query("COMMIT");
        transactionOpen = false;
        return respond(event, 200, document, { methods: INVOICE_DOCUMENT_METHODS });
      }
    }

    if (event.httpMethod !== "PUT") {
      return respond(event, 405, { error: "Method Not Allowed" }, { methods: INVOICE_DOCUMENT_METHODS });
    }

    const id = normalizeId(payload.id);
    if (!id) {
      return respond(event, 400, { error: "Document id is required." }, { methods: INVOICE_DOCUMENT_METHODS });
    }

    await client.query("BEGIN");
    transactionOpen = true;
    const existingDocument = await selectDocumentById(client, organizationId, id);
    if (!existingDocument) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return respond(event, 404, { error: "Document not found." }, { methods: INVOICE_DOCUMENT_METHODS });
    }

    const previouslyCommittedQuantities = isInventoryCommittedDocument(existingDocument)
      ? buildLineItemProductQuantityMap(existingDocument.lineItems)
      : new Map();
    const requestedQuantities = shouldManageInventory(normalized.sourceType)
      ? buildLineItemProductQuantityMap(normalized.lineItems)
      : new Map();
    const nextCommittedQuantities =
      shouldManageInventory(normalized.sourceType) && normalized.sentAt ? requestedQuantities : new Map();
    const productIds = collectProductIdsFromMaps(previouslyCommittedQuantities, requestedQuantities, nextCommittedQuantities);
    const productMap = await selectProductsForInventory(client, organizationId, productIds);
    const inventoryValidationError = validateCommittedInventory({
      requestedQuantities,
      previouslyCommittedQuantities,
      productMap,
    });
    if (inventoryValidationError) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return respond(event, 409, { error: inventoryValidationError }, { methods: INVOICE_DOCUMENT_METHODS });
    }
    await applyInventoryDelta(client, {
      organizationId,
      deltaMap: buildInventoryDeltaMap(previouslyCommittedQuantities, nextCommittedQuantities),
      productMap,
      authUser,
      documentLabel,
      reference: normalized.invoiceNumber,
    });
    const nextStockCommittedAt =
      shouldManageInventory(normalized.sourceType) && normalized.sentAt
        ? existingDocument.stockCommittedAt || new Date().toISOString()
        : null;

    await client.query(
      `UPDATE "invoiceDocument"
        SET
         "sourceType" = $1,
         "sourceId" = $2,
         "customerId" = $3,
         "documentType" = $4,
         title = $5,
         "invoiceNumber" = $6,
         "issueDate" = $7,
         "dueDate" = $8,
         "paymentStatus" = $9,
         "sentAt" = $10,
         "sentToEmail" = $11,
         "stockCommittedAt" = $12,
         "depositAmount" = $13,
         "customerName" = $14,
         "customerEmail" = $15,
         "customerPhone" = $16,
         "eventDate" = $17,
         "startTime" = $18,
         "endTime" = $19,
         "venueAddress" = $20,
         "lineItems" = $21::jsonb,
         "expenses" = $22::jsonb,
         "additionalItems" = $23::jsonb,
         notes = $24,
         terms = $25,
         "taxRate" = $26,
         "discountAmount" = $27,
         "updatedByUserId" = $28,
         "updatedAt" = NOW()
       WHERE id = $29
         AND "organizationId" = $30`,
      [
        normalized.sourceType,
        normalized.sourceId,
        normalized.customerId,
        normalized.documentType,
        normalized.title,
        normalized.invoiceNumber,
        normalized.issueDate,
        normalized.dueDate,
        normalized.paymentStatus,
        normalized.sentAt,
        normalized.sentToEmail,
        nextStockCommittedAt,
        normalized.depositAmount,
        normalized.customerName,
        normalized.customerEmail,
        normalized.customerPhone,
        normalized.eventDate,
        normalized.startTime,
        normalized.endTime,
        normalized.venueAddress,
        JSON.stringify(normalized.lineItems),
        JSON.stringify(normalized.expenses),
        JSON.stringify(normalized.additionalItems),
        normalized.notes,
        normalized.terms,
        normalized.taxRate,
        normalized.discountAmount,
        authUser.id,
        id,
        organizationId,
      ]
    );

    const updatedDocument = await selectDocumentById(client, organizationId, id);
    await client.query("COMMIT");
    transactionOpen = false;
    return respond(event, 200, updatedDocument, { methods: INVOICE_DOCUMENT_METHODS });
  } catch (err) {
    if (typeof transactionOpen !== "undefined" && transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("invoice-documents error:", err);
    return respond(event, 500, { error: "Failed to process invoice documents." }, {
      methods: INVOICE_DOCUMENT_METHODS,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
