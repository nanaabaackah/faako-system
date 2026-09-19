const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

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

const lineTotal = (line) => {
  if (String(line?.rowType || "item").toLowerCase() !== "item") return 0;
  const explicit = Number(line?.total);
  if (Number.isFinite(explicit)) return Math.max(0, toMoney(explicit));
  return Math.max(0, toMoney(Number(line?.quantity || 0) * Number(line?.unitPrice || 0)));
};

export const calculateInvoiceTotalCents = (invoice = {}) => {
  const subtotal = parseRows(invoice.lineItems).reduce((sum, line) => sum + lineTotal(line), 0);
  const additional = parseRows(invoice.additionalItems).reduce((sum, line) => sum + lineTotal(line), 0);
  const rawRate = Number(invoice.taxRate || 0);
  const rate = Number.isFinite(rawRate) ? Math.min(1, Math.max(0, rawRate > 1 ? rawRate / 100 : rawRate)) : 0;
  const tax = toMoney((subtotal + additional) * rate);
  const discount = Math.min(
    subtotal + additional + tax,
    Math.max(0, toMoney(invoice.discountAmount || 0))
  );
  return Math.max(0, Math.round(toMoney(subtotal + additional + tax - discount) * 100));
};
