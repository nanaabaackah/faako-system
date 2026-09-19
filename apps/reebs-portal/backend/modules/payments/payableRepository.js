import { calculateInvoiceTotalCents } from "./invoiceAmounts.js";
import { cleanPaymentText, PAYMENT_BUSINESS_UNITS } from "./paymentDomain.js";
import { normalizeFinancialSnapshot } from "../invoicing/invoiceDomain.js";

export const PAYABLE_TYPES = Object.freeze({
  BOOKING: "BOOKING",
  ORDER: "ORDER",
  INVOICE: "INVOICE",
  WATER_ORDER: "WATER_ORDER",
});

const normalizeId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const normalizePayableType = (value) => {
  const type = cleanPaymentText(value, 40).toUpperCase().replace(/[\s-]+/g, "_");
  return Object.values(PAYABLE_TYPES).includes(type) ? type : null;
};

const notFound = () => {
  const error = new Error("The payable record could not be found.");
  error.statusCode = 404;
  error.code = "PAYABLE_NOT_FOUND";
  return error;
};

export const getAppliedAmount = async (client, organizationId, payableType, payableId) => {
  const result = await client.query(
    `SELECT COALESCE(SUM("amountCents"), 0)::bigint AS "amountPaidCents"
     FROM "paymentApplication"
     WHERE "organizationId" = $1
       AND "payableType" = $2
       AND "payableId" = $3
       AND status = 'APPLIED'`,
    [organizationId, payableType, payableId]
  );
  return Number(result.rows?.[0]?.amountPaidCents || 0);
};

const loadOrder = async (client, organizationId, payableId, lockClause) => {
  const result = await client.query(
    `SELECT o.id, o."orderNumber" AS reference, o."customerId", o."customerName",
            c.email AS "customerEmail", o.currency, o."businessUnit", o."grandTotalCents",
            o.total_amount, o."paymentStatus", o.status,
            COALESCE((
              SELECT SUM(p."amountCents")
              FROM "orderPayment" p
              WHERE p."orderId" = o.id
                AND p."organizationId" = o."organizationId"
                AND LOWER(COALESCE(p.status, 'successful')) IN ('successful', 'confirmed', 'paid')
            ), 0)::bigint AS "amountPaidCents"
     FROM "order" o
     LEFT JOIN "customer" c ON c.id = o."customerId" AND c."organizationId" = o."organizationId"
     WHERE o."organizationId" = $1 AND o.id = $2
     ${lockClause}`,
    [organizationId, payableId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound();
  if (String(row.businessUnit || PAYMENT_BUSINESS_UNITS.CORE) !== PAYMENT_BUSINESS_UNITS.CORE) {
    throw notFound();
  }
  return {
    id: Number(row.id),
    type: PAYABLE_TYPES.ORDER,
    reference: row.reference,
    businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
    customerId: Number(row.customerId) || null,
    customerName: row.customerName || null,
    customerEmail: row.customerEmail || null,
    currency: cleanPaymentText(row.currency, 3).toUpperCase() || "GHS",
    totalCents: Number(row.grandTotalCents ?? row.total_amount ?? 0),
    amountPaidCents: Number(row.amountPaidCents || 0),
    depositRequiredCents: null,
    sourceStatus: row.status,
  };
};

const loadBooking = async (client, organizationId, payableId, lockClause) => {
  const result = await client.query(
    `SELECT b.id, b.reference, b."customerId", c.name AS "customerName", c.email AS "customerEmail",
            b.currency, b."totalAmount", b."depositRequiredCents", b.status
     FROM "booking" b
     JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
     WHERE b."organizationId" = $1 AND b.id = $2
     ${lockClause}`,
    [organizationId, payableId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound();
  return {
    id: Number(row.id),
    type: PAYABLE_TYPES.BOOKING,
    reference: row.reference,
    businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
    customerId: Number(row.customerId) || null,
    customerName: row.customerName || null,
    customerEmail: row.customerEmail || null,
    currency: cleanPaymentText(row.currency, 3).toUpperCase() || "GHS",
    totalCents: Number(row.totalAmount || 0),
    amountPaidCents: await getAppliedAmount(client, organizationId, PAYABLE_TYPES.BOOKING, payableId),
    depositRequiredCents: Number(row.depositRequiredCents || 0),
    sourceStatus: row.status,
  };
};

const loadWaterOrder = async (client, organizationId, payableId, lockClause) => {
  const result = await client.query(
    `SELECT w.id, ('WATER-' || LPAD(w.id::text, 6, '0')) AS reference, w."customerId",
            COALESCE(c.name, w."customerName") AS "customerName", c.email AS "customerEmail",
            w."totalAmount", w."paymentStatus", w.date
     FROM "waterSale" w
     LEFT JOIN "customer" c ON c.id = w."customerId" AND c."organizationId" = w."organizationId"
     WHERE w."organizationId" = $1 AND w.id = $2
     ${lockClause}`,
    [organizationId, payableId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound();
  const applied = await getAppliedAmount(client, organizationId, PAYABLE_TYPES.WATER_ORDER, payableId);
  const legacyPaid = String(row.paymentStatus || "").toLowerCase() === "paid"
    ? Number(row.totalAmount || 0)
    : 0;
  return {
    id: Number(row.id),
    type: PAYABLE_TYPES.WATER_ORDER,
    reference: row.reference,
    businessUnit: PAYMENT_BUSINESS_UNITS.WATER,
    customerId: Number(row.customerId) || null,
    customerName: row.customerName || null,
    customerEmail: row.customerEmail || null,
    currency: "GHS",
    totalCents: Number(row.totalAmount || 0),
    amountPaidCents: Math.max(applied, legacyPaid),
    depositRequiredCents: null,
    sourceStatus: row.paymentStatus,
  };
};

const loadInvoice = async (client, organizationId, payableId, lockClause) => {
  const exists = await client.query(`SELECT to_regclass('public."invoiceDocument"') AS table_name`);
  if (!exists.rows?.[0]?.table_name) throw notFound();
  const result = await client.query(
    `SELECT i.*, c.email AS "linkedCustomerEmail", c.name AS "linkedCustomerName",
            o.currency AS "orderCurrency", b.currency AS "bookingCurrency"
     FROM "invoiceDocument" i
     LEFT JOIN "customer" c ON c.id = i."customerId" AND c."organizationId" = i."organizationId"
     LEFT JOIN "order" o ON i."sourceType" = 'orders' AND o.id = i."sourceId" AND o."organizationId" = i."organizationId"
     LEFT JOIN "booking" b ON i."sourceType" = 'bookings' AND b.id = i."sourceId" AND b."organizationId" = i."organizationId"
     WHERE i."organizationId" = $1 AND i.id = $2 AND i."documentType" = 'invoice'
       AND i."archivedAt" IS NULL AND i."voidedAt" IS NULL
       AND i."issuedAt" IS NOT NULL AND i."businessUnit" = 'REEBS_CORE'
     ${lockClause}`,
    [organizationId, payableId]
  );
  const row = result.rows?.[0];
  if (!row) throw notFound();
  return {
    id: Number(row.id),
    type: PAYABLE_TYPES.INVOICE,
    reference: row.invoiceNumber || `INV-${row.id}`,
    businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
    customerId: Number(row.customerId) || null,
    customerName: row.linkedCustomerName || row.customerName || null,
    customerEmail: row.linkedCustomerEmail || row.customerEmail || null,
    currency: cleanPaymentText(row.currency || row.orderCurrency || row.bookingCurrency, 3).toUpperCase() || "GHS",
    totalCents: Number(row.financialSnapshot?.version) >= 1
      ? normalizeFinancialSnapshot(row.financialSnapshot, row).totalCents
      : calculateInvoiceTotalCents(row),
    amountPaidCents: await getAppliedAmount(client, organizationId, PAYABLE_TYPES.INVOICE, payableId),
    depositRequiredCents: null,
    sourceStatus: row.paymentStatus,
  };
};

export const loadPayable = async (
  client,
  { organizationId, payableType, payableId, forUpdate = false }
) => {
  const type = normalizePayableType(payableType);
  const id = normalizeId(payableId);
  if (!type || !id) {
    const error = new Error("A supported payable type and ID are required.");
    error.statusCode = 400;
    error.code = "INVALID_PAYABLE";
    throw error;
  }
  const lockClause = forUpdate ? "FOR UPDATE OF " + ({
    [PAYABLE_TYPES.ORDER]: "o",
    [PAYABLE_TYPES.BOOKING]: "b",
    [PAYABLE_TYPES.INVOICE]: "i",
    [PAYABLE_TYPES.WATER_ORDER]: "w",
  })[type] : "";
  if (type === PAYABLE_TYPES.ORDER) return loadOrder(client, organizationId, id, lockClause);
  if (type === PAYABLE_TYPES.BOOKING) return loadBooking(client, organizationId, id, lockClause);
  if (type === PAYABLE_TYPES.INVOICE) return loadInvoice(client, organizationId, id, lockClause);
  return loadWaterOrder(client, organizationId, id, lockClause);
};

export const calculatePayableCharge = (payable, purpose = "AUTO") => {
  const normalizedPurpose = cleanPaymentText(purpose, 20).toUpperCase() || "AUTO";
  const totalCents = Math.max(0, Math.round(Number(payable?.totalCents || 0)));
  const amountPaidCents = Math.max(0, Math.round(Number(payable?.amountPaidCents || 0)));
  const balanceDueCents = Math.max(0, totalCents - amountPaidCents);
  const depositRequiredCents = Math.min(
    totalCents,
    Math.max(0, Math.round(Number(payable?.depositRequiredCents || 0)))
  );
  let chargePurpose = normalizedPurpose;
  let amountCents = balanceDueCents;
  if (normalizedPurpose === "AUTO") {
    chargePurpose = depositRequiredCents > amountPaidCents ? "DEPOSIT" : "BALANCE";
  }
  if (chargePurpose === "DEPOSIT") {
    amountCents = Math.max(0, Math.min(balanceDueCents, depositRequiredCents - amountPaidCents));
  } else if (!["BALANCE", "FULL"].includes(chargePurpose)) {
    const error = new Error("Unsupported payment purpose.");
    error.statusCode = 400;
    error.code = "INVALID_PAYMENT_PURPOSE";
    throw error;
  }
  if (amountCents <= 0) {
    const error = new Error("This record has no payment balance due.");
    error.statusCode = 409;
    error.code = "PAYABLE_ALREADY_SETTLED";
    throw error;
  }
  return { amountCents, amountPaidCents, balanceDueCents, depositRequiredCents, purpose: chargePurpose };
};
