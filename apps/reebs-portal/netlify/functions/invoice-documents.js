/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const INVOICE_DOCUMENT_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const SOURCE_TYPES = new Set(["manual", "orders", "bookings"]);
const DOCUMENT_TYPES = new Set(["invoice", "receipt"]);
const PAYMENT_STATUSES = new Set(["draft", "unpaid", "paid"]);

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "invoiceDocument" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" INTEGER,
    "documentType" TEXT NOT NULL DEFAULT 'invoice',
    "title" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATE,
    "paymentStatus" TEXT NOT NULL DEFAULT 'draft',
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
    "notes" TEXT,
    "terms" TEXT,
    "taxRate" NUMERIC(8,4) NOT NULL DEFAULT 0,
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
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'invoice'`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "title" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "issueDate" DATE`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'draft'`,
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
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "terms" TEXT`,
  `ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC(8,4) NOT NULL DEFAULT 0`,
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

const ensureInvoiceDocumentTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Invoice document table check failed:", err?.message || err);
    }
  }
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

const normalizeDateValue = (value) => {
  const cleaned = cleanText(value, 32);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 200)
    .map((item, index) => {
      const quantity = Math.max(0, normalizeMoney(item?.quantity, 1));
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      const name = cleanText(item?.name, 240) || `Item ${index + 1}`;
      return {
        id: cleanText(item?.id, 80) || `line-${index + 1}`,
        name,
        quantity,
        unitPrice,
        total: Math.round(quantity * unitPrice * 100) / 100,
      };
    })
    .filter((item) => item.name);
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

const normalizePayload = (payload = {}) => {
  const sourceType = normalizeSourceType(payload.sourceType);
  return {
    sourceType,
    sourceId: sourceType === "manual" ? null : normalizeId(payload.sourceId),
    documentType: normalizeDocumentType(payload.documentType),
    title: cleanNullableText(payload.title, 200),
    invoiceNumber: cleanText(payload.invoiceNumber, 120),
    issueDate: normalizeDateValue(payload.issueDate),
    paymentStatus: normalizePaymentStatus(payload.paymentStatus),
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
    notes: cleanNullableText(payload.notes, 4000),
    terms: cleanNullableText(payload.terms, 4000),
    taxRate: normalizeTaxRate(payload.taxRate),
  };
};

const validatePayload = (record) => {
  if (!record.invoiceNumber) return "Invoice number is required.";
  if (record.sourceType !== "manual" && !record.sourceId) return "Linked document source is required.";
  if (!DOCUMENT_TYPES.has(record.documentType)) return "Invalid document type.";
  if (!PAYMENT_STATUSES.has(record.paymentStatus)) return "Invalid payment status.";
  return "";
};

const selectDocuments = async (client, organizationId) => {
  const result = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "documentType",
       title,
       "invoiceNumber",
       "issueDate",
       "paymentStatus",
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
       notes,
       terms,
       "taxRate",
       "archivedAt",
       "createdAt",
       "updatedAt"
     FROM "invoiceDocument"
     WHERE "organizationId" = $1
     ORDER BY "updatedAt" DESC, id DESC`,
    [organizationId]
  );
  return result.rows || [];
};

const selectDocumentById = async (client, organizationId, id) => {
  const result = await client.query(
    `SELECT
       id,
       "sourceType",
       "sourceId",
       "documentType",
       title,
       "invoiceNumber",
       "issueDate",
       "paymentStatus",
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
       notes,
       terms,
       "taxRate",
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

    if (event.httpMethod === "GET") {
      const documents = await selectDocuments(client, organizationId);
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

      let archivedId = id;
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
               "documentType",
               title,
               "invoiceNumber",
               "issueDate",
               "paymentStatus",
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
               notes,
               terms,
               "taxRate",
               "createdByUserId",
               "updatedByUserId",
               "archivedAt",
               "archivedByUserId",
               "createdAt",
               "updatedAt"
             )
             VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$22,NOW(),$22,NOW(),NOW()
             )
             RETURNING id`,
            [
              organizationId,
              normalized.sourceType,
              normalized.sourceId,
              normalized.documentType,
              normalized.title,
              normalized.invoiceNumber,
              normalized.issueDate,
              normalized.paymentStatus,
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
              normalized.notes,
              normalized.terms,
              normalized.taxRate,
              authUser.id,
            ]
          );
          archivedId = inserted.rows[0]?.id || null;
        }
      }

      if (!archivedId) {
        return respond(event, 404, { error: "Document not found." }, { methods: INVOICE_DOCUMENT_METHODS });
      }

      await client.query(
        `UPDATE "invoiceDocument"
         SET "archivedAt" = NOW(),
             "archivedByUserId" = $1,
             "updatedByUserId" = $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3`,
        [authUser.id, archivedId, organizationId]
      );

      const archivedDocument = await selectDocumentById(client, organizationId, archivedId);
      return respond(event, 200, archivedDocument, { methods: INVOICE_DOCUMENT_METHODS });
    }

    const normalized = normalizePayload(payload);
    const validationError = validatePayload(normalized);
    if (validationError) {
      return respond(event, 400, { error: validationError }, { methods: INVOICE_DOCUMENT_METHODS });
    }

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
        const inserted = await client.query(
          `INSERT INTO "invoiceDocument" (
             "organizationId",
             "sourceType",
             "sourceId",
             "documentType",
             title,
             "invoiceNumber",
             "issueDate",
             "paymentStatus",
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
             notes,
             terms,
             "taxRate",
             "createdByUserId",
             "updatedByUserId",
             "createdAt",
             "updatedAt"
           )
           VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$22,NOW(),NOW()
           )
           RETURNING id`,
          [
            organizationId,
            normalized.sourceType,
            normalized.sourceId,
            normalized.documentType,
            normalized.title,
            normalized.invoiceNumber,
            normalized.issueDate,
            normalized.paymentStatus,
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
            normalized.notes,
            normalized.terms,
            normalized.taxRate,
            authUser.id,
          ]
        );

        const document = await selectDocumentById(client, organizationId, inserted.rows[0].id);
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

    const existingDocument = await selectDocumentById(client, organizationId, id);
    if (!existingDocument) {
      return respond(event, 404, { error: "Document not found." }, { methods: INVOICE_DOCUMENT_METHODS });
    }

    await client.query(
      `UPDATE "invoiceDocument"
       SET
         "sourceType" = $1,
         "sourceId" = $2,
         "documentType" = $3,
         title = $4,
         "invoiceNumber" = $5,
         "issueDate" = $6,
         "paymentStatus" = $7,
         "depositAmount" = $8,
         "customerName" = $9,
         "customerEmail" = $10,
         "customerPhone" = $11,
         "eventDate" = $12,
         "startTime" = $13,
         "endTime" = $14,
         "venueAddress" = $15,
         "lineItems" = $16::jsonb,
         "expenses" = $17::jsonb,
         notes = $18,
         terms = $19,
         "taxRate" = $20,
         "updatedByUserId" = $21,
         "updatedAt" = NOW()
       WHERE id = $22
         AND "organizationId" = $23`,
      [
        normalized.sourceType,
        normalized.sourceId,
        normalized.documentType,
        normalized.title,
        normalized.invoiceNumber,
        normalized.issueDate,
        normalized.paymentStatus,
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
        normalized.notes,
        normalized.terms,
        normalized.taxRate,
        authUser.id,
        id,
        organizationId,
      ]
    );

    const updatedDocument = await selectDocumentById(client, organizationId, id);
    return respond(event, 200, updatedDocument, { methods: INVOICE_DOCUMENT_METHODS });
  } catch (err) {
    console.error("invoice-documents error:", err);
    return respond(event, 500, { error: "Failed to process invoice documents." }, {
      methods: INVOICE_DOCUMENT_METHODS,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
