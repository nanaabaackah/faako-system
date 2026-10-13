// Water's ledger uses stable keys, not the shared Payments display labels.
export const normalizeWaterPaymentMethod = (value) => {
  const method = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["momo", "mobilemoney"].includes(method)) return "momo";
  if (["credit", "paylater"].includes(method)) return "credit";
  return "cash";
};

// Choosing MoMo is not evidence of a collection. Explicitly confirmed manual
// payment and verified callbacks can subsequently mark it paid.
export const defaultNewWaterPaymentStatus = (method) => {
  const normalized = normalizeWaterPaymentMethod(method);
  return normalized === "momo" ? "pending" : normalized === "credit" ? "unpaid" : "paid";
};

export const getWaterCollectedCents = (sale = {}) => {
  if (sale.amountPaidCents !== null && sale.amountPaidCents !== undefined) {
    const amount = Number(sale.amountPaidCents);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
  }
  return String(sale.paymentStatus || "").trim().toLowerCase() === "paid"
    ? Math.max(0, Number(sale.totalAmount) || 0) : 0;
};

export const getWaterBalanceDueCents = (sale = {}) =>
  Math.max(0, (Number(sale.totalAmount) || 0) - getWaterCollectedCents(sale));
