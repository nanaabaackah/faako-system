import {
  INVOICE_BUSINESS_UNITS,
  INVOICE_DOCUMENT_TYPES,
  INVOICE_SOURCE_TYPES,
  buildInvoicePaymentSummary,
  calculateInvoiceFinancialSnapshot,
  formatInvoiceNumber,
} from "./invoiceDomain.js";

const notFound = (message = "The invoice source could not be found.") => {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = "INVOICE_SOURCE_NOT_FOUND";
  return error;
};

const normalizeIds = (ids = []) => [...new Set(
  ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
)];

const withCompactFinancialSnapshot = (document = {}) => {
  if (Number(document?.financialSnapshot?.version) >= 1) return document;
  const grandTotal = Number(document?.grandTotal);
  if (!Number.isFinite(grandTotal)) return document;
  const totalCents = Math.max(0, Math.round(grandTotal * 100));
  return {
    ...document,
    financialSnapshot: {
      version: 1,
      subtotalCents: totalCents,
      additionalCents: 0,
      taxCents: 0,
      discountCents: 0,
      totalCents,
      taxRate: 0,
    },
  };
};

export const reserveInvoiceNumber = async (
  client,
  { organizationId, documentType = INVOICE_DOCUMENT_TYPES.INVOICE, issueDate = new Date() }
) => {
  const date = new Date(issueDate);
  const year = Number.isNaN(date.getTime()) ? new Date().getUTCFullYear() : date.getUTCFullYear();
  const sequenceResult = await client.query(
    `INSERT INTO "invoiceNumberSequence" (
       "organizationId", "documentType", year, "lastValue", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, 1, NOW(), NOW())
     ON CONFLICT ("organizationId", "documentType", year)
     DO UPDATE SET "lastValue" = "invoiceNumberSequence"."lastValue" + 1, "updatedAt" = NOW()
     RETURNING "lastValue"`,
    [organizationId, documentType, year]
  );
  return formatInvoiceNumber({
    documentType,
    year,
    sequence: Number(sequenceResult.rows?.[0]?.lastValue || 1),
  });
};

export const loadInvoiceCustomerSnapshot = async (client, { organizationId, customerId }) => {
  const result = await client.query(
    `SELECT id, reference, "customerType", name, "organizationName", "contactPersonName",
            email, phone, "secondaryPhone", "addressLine1", "addressLine2", locality, region,
            "ghanaPostGps"
     FROM "customer"
     WHERE "organizationId" = $1 AND id = $2 AND "deletedAt" IS NULL
     LIMIT 1`,
    [organizationId, customerId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound("The selected customer could not be found.");
  return {
    version: 1,
    customerId: Number(row.id),
    reference: row.reference || null,
    customerType: row.customerType || "individual",
    name: row.name || "Customer",
    organizationName: row.organizationName || null,
    contactPersonName: row.contactPersonName || null,
    email: row.email || null,
    phone: row.phone || null,
    secondaryPhone: row.secondaryPhone || null,
    addressLine1: row.addressLine1 || null,
    addressLine2: row.addressLine2 || null,
    locality: row.locality || null,
    region: row.region || null,
    ghanaPostGps: row.ghanaPostGps || null,
  };
};

const loadOrderSource = async (client, organizationId, sourceId) => {
  const result = await client.query(
    `SELECT o.id, o."orderNumber" AS reference, o."customerId", o.currency,
            COALESCE(o."businessUnit", 'REEBS_CORE') AS "businessUnit",
            COALESCE(o."subtotalCents", (
              SELECT COALESCE(SUM(oi."total_amount"), 0) FROM "orderItem" oi
              WHERE oi."organizationId" = o."organizationId" AND oi."orderId" = o.id
            ))::bigint AS "subtotalCents",
            COALESCE(o."deliveryFeeCents", 0)::bigint AS "deliveryFeeCents",
            COALESCE(o."serviceFeeCents", 0)::bigint AS "serviceFeeCents",
            COALESCE(o."taxCents", 0)::bigint AS "taxCents",
            COALESCE(o."discountCents", 0)::bigint AS "discountCents",
            COALESCE(o."amountPaidCents", 0)::bigint AS "amountPaidCents",
            COALESCE(o."paymentStatus", 'unpaid') AS "paymentStatus",
            COALESCE(o."grandTotalCents", o."total_amount")::bigint AS "totalCents"
     FROM "order" o
     WHERE o."organizationId" = $1 AND o.id = $2
     LIMIT 1`,
    [organizationId, sourceId]
  );
  const row = result.rows?.[0];
  if (!row || row.businessUnit !== INVOICE_BUSINESS_UNITS.CORE) throw notFound();
  const subtotalCents = Number(row.subtotalCents || 0);
  const additionalCents = Number(row.deliveryFeeCents || 0) + Number(row.serviceFeeCents || 0);
  const taxCents = Number(row.taxCents || 0);
  const discountCents = Number(row.discountCents || 0);
  return {
    customerId: Number(row.customerId),
    businessUnit: INVOICE_BUSINESS_UNITS.CORE,
    currency: row.currency || "GHS",
    sourceSnapshot: {
      version: 1,
      type: "ORDER",
      id: Number(row.id),
      reference: row.reference,
      amountPaidCents: String(row.paymentStatus || "").toLowerCase() === "paid"
        ? Math.max(0, Number(row.totalCents || 0))
        : Math.max(0, Number(row.amountPaidCents || 0)),
    },
    financialSnapshot: {
      version: 1,
      subtotalCents,
      additionalCents,
      taxCents,
      discountCents,
      totalCents: Math.max(0, Number(row.totalCents || 0)),
      taxRate: subtotalCents + additionalCents > 0 ? taxCents / (subtotalCents + additionalCents) : 0,
    },
  };
};

const loadBookingSource = async (client, organizationId, sourceId) => {
  const result = await client.query(
    `SELECT id, reference, "customerId", currency, "subtotalCents", "feeCents",
            "taxCents", "discountCents", "totalAmount"
     FROM "booking"
     WHERE "organizationId" = $1 AND id = $2
     LIMIT 1`,
    [organizationId, sourceId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound();
  const subtotalCents = Number(row.subtotalCents || 0);
  const additionalCents = Number(row.feeCents || 0);
  const taxCents = Number(row.taxCents || 0);
  const discountCents = Number(row.discountCents || 0);
  return {
    customerId: Number(row.customerId),
    businessUnit: INVOICE_BUSINESS_UNITS.CORE,
    currency: row.currency || "GHS",
    sourceSnapshot: {
      version: 1,
      type: "BOOKING",
      id: Number(row.id),
      reference: row.reference,
    },
    financialSnapshot: {
      version: 1,
      subtotalCents,
      additionalCents,
      taxCents,
      discountCents,
      totalCents: Math.max(0, Number(row.totalAmount || 0)),
      taxRate: subtotalCents + additionalCents > 0 ? taxCents / (subtotalCents + additionalCents) : 0,
    },
  };
};

export const loadTrustedInvoiceSource = async (
  client,
  { organizationId, sourceType, sourceId, draftDocument = {} }
) => {
  if (sourceType === INVOICE_SOURCE_TYPES.ORDER) return loadOrderSource(client, organizationId, sourceId);
  if (sourceType === INVOICE_SOURCE_TYPES.BOOKING) return loadBookingSource(client, organizationId, sourceId);
  if (sourceType !== INVOICE_SOURCE_TYPES.MANUAL) throw notFound();
  return {
    customerId: Number(draftDocument.customerId) || null,
    businessUnit: INVOICE_BUSINESS_UNITS.CORE,
    currency: String(draftDocument.currency || "GHS").toUpperCase() === "GHS" ? "GHS" : "GHS",
    sourceSnapshot: { version: 1, type: "MANUAL_INVOICE", id: null, reference: null },
    financialSnapshot: calculateInvoiceFinancialSnapshot(draftDocument),
  };
};

export const hasPaymentFoundation = async (client) => {
  const result = await client.query(
    `SELECT to_regclass('public."paymentRecord"') IS NOT NULL
       AND to_regclass('public."paymentApplication"') IS NOT NULL AS available`
  );
  return Boolean(result.rows?.[0]?.available);
};

export const loadInvoicePaymentState = async (
  client,
  { organizationId, documents = [], includePayments = false }
) => {
  const ids = normalizeIds(documents.map((document) => document.id));
  if (!ids.length || !(await hasPaymentFoundation(client))) {
    return documents.map((document) => {
      const paymentDocument = withCompactFinancialSnapshot(document);
      const paymentSummary = buildInvoicePaymentSummary(
        paymentDocument,
        document.documentType === INVOICE_DOCUMENT_TYPES.RECEIPT
          ? Math.max(0, Number(document.sourceSnapshot?.amountPaidCents || 0))
          : 0
      );
      return {
        ...document,
        paymentStatus: paymentSummary.paymentStatus,
        paymentSummary,
        payments: [],
      };
    });
  }
  const result = await client.query(
    `SELECT pa."payableId" AS "invoiceId",
            COALESCE(SUM(pa."amountCents") FILTER (WHERE pa.status = 'APPLIED'), 0)::bigint AS "amountPaidCents"
     FROM "paymentApplication" pa
     JOIN "paymentRecord" pr
       ON pr.id = pa."paymentId"
      AND pr."organizationId" = pa."organizationId"
      AND pr.status = 'PAID'
      AND pr."businessUnit" = 'REEBS_CORE'
     WHERE pa."organizationId" = $1
       AND pa."payableType" = 'INVOICE'
       AND pa."payableId" = ANY($2::int[])
     GROUP BY pa."payableId"`,
    [organizationId, ids]
  );
  const paidByInvoice = new Map(
    (result.rows || []).map((row) => [Number(row.invoiceId), Number(row.amountPaidCents || 0)])
  );
  let paymentRowsByInvoice = new Map();
  if (includePayments) {
    const paymentResult = await client.query(
      `SELECT pa."payableId" AS "invoiceId", pr.reference, pr."amountCents", pr.currency,
              pr.method, pr.provider, pr.source, pr."paidAt", pa.status
       FROM "paymentApplication" pa
       JOIN "paymentRecord" pr
         ON pr.id = pa."paymentId" AND pr."organizationId" = pa."organizationId"
       WHERE pa."organizationId" = $1
         AND pa."payableType" = 'INVOICE'
         AND pa."payableId" = ANY($2::int[])
       ORDER BY pr."paidAt" DESC, pr.id DESC
       LIMIT 100`,
      [organizationId, ids]
    );
    paymentRowsByInvoice = (paymentResult.rows || []).reduce((map, row) => {
      const invoiceId = Number(row.invoiceId);
      const rows = map.get(invoiceId) || [];
      rows.push({
        reference: row.reference,
        amountCents: Number(row.amountCents || 0),
        currency: row.currency || "GHS",
        method: row.method,
        provider: row.provider,
        source: row.source,
        paidAt: row.paidAt,
        status: row.status,
      });
      map.set(invoiceId, rows);
      return map;
    }, new Map());
  }
  return documents.map((document) => {
    const paymentDocument = withCompactFinancialSnapshot(document);
    const amountPaidCents = document.documentType === INVOICE_DOCUMENT_TYPES.RECEIPT
      ? Math.max(0, Number(document.sourceSnapshot?.amountPaidCents || 0))
      : paidByInvoice.get(Number(document.id)) || 0;
    const paymentSummary = buildInvoicePaymentSummary(paymentDocument, amountPaidCents);
    return {
      ...document,
      paymentStatus: paymentSummary.paymentStatus,
      paymentSummary,
      payments: paymentRowsByInvoice.get(Number(document.id)) || [],
    };
  });
};
