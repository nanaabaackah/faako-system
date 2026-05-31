import {
  calculateBalanceDueMajor,
  calculateFinanceStatusFromMajor,
} from "@faako/finance";

const roundCurrencyAmount = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const parseInvoicePaidAmount = (value, fallback = 0) => {
  const paidAmount = roundCurrencyAmount(value ?? fallback);
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    return { error: "paidAmount must be 0 or greater." };
  }
  return { paidAmount };
};

export const buildInvoicePaymentSummary = ({ total = 0, paidAmount = 0 } = {}) => {
  const normalizedTotal = roundCurrencyAmount(total);
  const normalizedPaidAmount = roundCurrencyAmount(paidAmount);

  return {
    paidAmount: normalizedPaidAmount,
    balanceDue: calculateBalanceDueMajor({
      total: normalizedTotal,
      paid: normalizedPaidAmount,
    }),
    paymentStatus: calculateFinanceStatusFromMajor({
      total: normalizedTotal,
      paid: normalizedPaidAmount,
    }),
  };
};
