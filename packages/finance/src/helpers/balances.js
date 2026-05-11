import { FINANCE_STATUSES } from "../constants/financeStatuses.js";
import { centsToMajor, majorToCents, toFiniteAmount } from "./currency.js";

const toCents = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

export const calculateBalanceDueCents = ({ totalCents = 0, paidCents = 0 } = {}) =>
  Math.max(toCents(totalCents) - toCents(paidCents), 0);

export const calculateBalanceDueMajor = ({ total = 0, paid = 0 } = {}) =>
  centsToMajor(
    calculateBalanceDueCents({
      totalCents: majorToCents(total),
      paidCents: majorToCents(paid),
    })
  );

export const calculateFinanceStatusFromCents = ({ totalCents = 0, paidCents = 0 } = {}) => {
  const total = Math.max(toCents(totalCents), 0);
  const paid = Math.max(toCents(paidCents), 0);
  if (paid <= 0) return FINANCE_STATUSES.UNPAID;
  if (total > 0 && paid > total) return FINANCE_STATUSES.OVERPAID;
  if (total > 0 && paid >= total) return FINANCE_STATUSES.PAID;
  return FINANCE_STATUSES.PART_PAID;
};

export const calculateFinanceStatusFromMajor = ({ total = 0, paid = 0 } = {}) =>
  calculateFinanceStatusFromCents({
    totalCents: majorToCents(toFiniteAmount(total)),
    paidCents: majorToCents(toFiniteAmount(paid)),
  });

export const buildFinanceSummary = ({ totalCents = 0, paidCents = 0 } = {}) => {
  const normalizedTotalCents = Math.max(toCents(totalCents), 0);
  const normalizedPaidCents = Math.max(toCents(paidCents), 0);
  const balanceDueCents = calculateBalanceDueCents({
    totalCents: normalizedTotalCents,
    paidCents: normalizedPaidCents,
  });

  return {
    totalCents: normalizedTotalCents,
    paidCents: normalizedPaidCents,
    balanceDueCents,
    status: calculateFinanceStatusFromCents({
      totalCents: normalizedTotalCents,
      paidCents: normalizedPaidCents,
    }),
  };
};
