export const INVOICE_BUSINESS_UNITS = Object.freeze({
  CORE: "REEBS_CORE",
  WATER: "WATER",
});

export const INVOICE_DOCUMENT_TYPES = Object.freeze({
  INVOICE: "invoice",
  RECEIPT: "receipt",
});

export const INVOICE_SOURCE_TYPES = Object.freeze({
  MANUAL: "manual",
  ORDER: "orders",
  BOOKING: "bookings",
});

export const INVOICE_STATUSES = Object.freeze({
  DRAFT: "draft",
  UNPAID: "unpaid",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  OVERDUE: "overdue",
  VOID: "void",
});

const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

const toCents = (value) => Math.round(toMoney(value) * 100);

const parseRows = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getRowTotalCents = (row, descriptionKey = "name") => {
  if (descriptionKey === "name" && String(row?.rowType || "item").toLowerCase() !== "item") return 0;
  const quantity = Math.max(0, Number(row?.quantity || 0));
  const unitPrice = Math.max(0, Number(row?.unitPrice || 0));
  return Math.max(0, toCents(quantity * unitPrice));
};

export const normalizeTaxRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(1, Math.max(0, raw > 1 ? raw / 100 : raw));
};

export const calculateInvoiceFinancialSnapshot = (document = {}) => {
  const lineItems = parseRows(document.lineItems);
  const additionalItems = parseRows(document.additionalItems);
  const subtotalCents = lineItems.reduce((sum, row) => sum + getRowTotalCents(row, "name"), 0);
  const additionalCents = additionalItems.reduce(
    (sum, row) => sum + getRowTotalCents(row, "description"),
    0
  );
  const taxRate = normalizeTaxRate(document.taxRate);
  const taxCents = Math.round((subtotalCents + additionalCents) * taxRate);
  const requestedDiscountCents = Math.max(0, toCents(document.discountAmount || 0));
  const discountCents = Math.min(requestedDiscountCents, subtotalCents + additionalCents + taxCents);
  const totalCents = Math.max(0, subtotalCents + additionalCents + taxCents - discountCents);
  return {
    version: 1,
    subtotalCents,
    additionalCents,
    taxCents,
    discountCents,
    totalCents,
    taxRate,
  };
};

export const normalizeFinancialSnapshot = (value, fallbackDocument = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!source || Number(source.version) < 1) return calculateInvoiceFinancialSnapshot(fallbackDocument);
  const subtotalCents = Math.max(0, Math.round(Number(source.subtotalCents) || 0));
  const additionalCents = Math.max(0, Math.round(Number(source.additionalCents) || 0));
  const taxCents = Math.max(0, Math.round(Number(source.taxCents) || 0));
  const discountCents = Math.min(
    subtotalCents + additionalCents + taxCents,
    Math.max(0, Math.round(Number(source.discountCents) || 0))
  );
  const calculatedTotal = subtotalCents + additionalCents + taxCents - discountCents;
  const totalCents = Math.max(0, Math.round(Number(source.totalCents ?? calculatedTotal) || 0));
  return {
    version: 1,
    subtotalCents,
    additionalCents,
    taxCents,
    discountCents,
    totalCents,
    taxRate: normalizeTaxRate(source.taxRate ?? fallbackDocument.taxRate),
  };
};

const normalizeDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const deriveInvoiceStatus = ({
  issuedAt = null,
  sentAt = null,
  voidedAt = null,
  dueDate = null,
  totalCents = 0,
  amountPaidCents = 0,
  legacyStatus = INVOICE_STATUSES.DRAFT,
  paymentStateVersion = 0,
  today = new Date(),
} = {}) => {
  if (voidedAt) return INVOICE_STATUSES.VOID;
  if (Number(paymentStateVersion) < 1) {
    const normalizedLegacy = String(legacyStatus || "").trim().toLowerCase();
    if (Object.values(INVOICE_STATUSES).includes(normalizedLegacy)) return normalizedLegacy;
  }
  if (!issuedAt && !sentAt) return INVOICE_STATUSES.DRAFT;
  const safeTotal = Math.max(0, Math.round(Number(totalCents) || 0));
  const safePaid = Math.max(0, Math.round(Number(amountPaidCents) || 0));
  if (safeTotal > 0 && safePaid >= safeTotal) {
    return INVOICE_STATUSES.PAID;
  }
  const dueDateKey = normalizeDateKey(dueDate);
  const todayKey = normalizeDateKey(today);
  if (dueDateKey && todayKey && dueDateKey < todayKey) return INVOICE_STATUSES.OVERDUE;
  if (safePaid > 0) return INVOICE_STATUSES.PARTIALLY_PAID;
  return INVOICE_STATUSES.UNPAID;
};

export const buildInvoicePaymentSummary = (document = {}, amountPaidCents = 0) => {
  const financialSnapshot = normalizeFinancialSnapshot(document.financialSnapshot, document);
  const legacyPaid = Number(document.paymentStateVersion) < 1
    && String(document.paymentStatus || "").trim().toLowerCase() === INVOICE_STATUSES.PAID;
  const safePaid = legacyPaid
    ? financialSnapshot.totalCents
    : Math.max(0, Math.round(Number(amountPaidCents) || 0));
  const balanceDueCents = Math.max(0, financialSnapshot.totalCents - safePaid);
  const paymentStatus = deriveInvoiceStatus({
    ...document,
    totalCents: financialSnapshot.totalCents,
    amountPaidCents: safePaid,
    legacyStatus: document.paymentStatus,
  });
  return {
    amountPaidCents: safePaid,
    balanceDueCents,
    totalCents: financialSnapshot.totalCents,
    paymentStatus,
  };
};

export const validateInvoiceForIssue = (document = {}) => {
  if (document.documentType !== INVOICE_DOCUMENT_TYPES.INVOICE && document.documentType !== INVOICE_DOCUMENT_TYPES.RECEIPT) {
    return { code: "INVALID_INVOICE_TYPE", message: "A supported document type is required." };
  }
  if (!Number.isInteger(Number(document.customerId)) || Number(document.customerId) <= 0) {
    return { code: "INVOICE_CUSTOMER_REQUIRED", message: "Select a customer before issuing this document." };
  }
  const billableLines = parseRows(document.lineItems).filter(
    (line) => String(line?.rowType || "item").toLowerCase() === "item" && Number(line?.quantity) > 0
  );
  if (!billableLines.length) {
    return { code: "INVALID_INVOICE_LINE", message: "Add at least one billable line before issuing this document." };
  }
  const snapshot = normalizeFinancialSnapshot(document.financialSnapshot, document);
  if (snapshot.totalCents <= 0) {
    return { code: "INVALID_INVOICE_TOTAL", message: "The document total must be greater than zero before issue." };
  }
  if (!normalizeDateKey(document.issueDate)) {
    return { code: "INVOICE_ISSUE_DATE_REQUIRED", message: "An issue date is required." };
  }
  return null;
};

export const formatInvoiceNumber = ({ documentType, year, sequence }) => {
  const prefix = documentType === INVOICE_DOCUMENT_TYPES.RECEIPT ? "REC" : "INV";
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
};
