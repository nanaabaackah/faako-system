const toFinite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const calculateServiceDepositAmount = (grandTotal, depositBps) => {
  const total = Math.max(0, toFinite(grandTotal, 0));
  const basisPoints = Math.round(toFinite(depositBps, Number.NaN));
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new TypeError("A valid service deposit rate in basis points is required.");
  }
  return Math.round((total * 100 * basisPoints) / 10000) / 100;
};

const normalizeDateOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const calculateServiceDepositDueDate = (
  { issueDate, eventDate } = {},
  dueDays
) => {
  const days = Math.round(toFinite(dueDays, Number.NaN));
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    throw new TypeError("A valid service deposit due period is required.");
  }
  const event = normalizeDateOnly(eventDate);
  const issue = normalizeDateOnly(issueDate);
  const reference = event || issue;
  if (!reference) return null;

  const date = new Date(`${reference}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + (event ? -days : days));
  return date.toISOString().slice(0, 10);
};

export const shouldRefreshDraftDeposit = (document = {}) =>
  String(document.documentType || "invoice").toLowerCase() === "invoice"
  && String(document.paymentStatus || "draft").toLowerCase() === "draft"
  && !document.sentAt;

export const preservePersistedInvoiceTerms = (existingDocument = {}, nextDocument = {}) => ({
  ...nextDocument,
  depositAmount: existingDocument.depositAmount,
  dueDate: existingDocument.dueDate || null,
});
