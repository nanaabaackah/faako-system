export { calculateWaterCostSummary } from "../../../shared/waterFinancials.js";

const FINANCIAL_ROLES = new Set(["owner", "admin"]);

export const canManageWaterPricing = (role) =>
  FINANCIAL_ROLES.has(String(role || "").trim().toLowerCase());

export const canViewWaterFinancials = canManageWaterPricing;

export const normalizeConfiguredCents = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed);
  return cents >= 0 ? cents : null;
};

export const normalizeWaterPricing = (row = null) => ({
  retailPrice: normalizeConfiguredCents(row?.retailPrice),
  companyPrice: normalizeConfiguredCents(row?.companyPrice),
  bulkPrice: normalizeConfiguredCents(row?.bulkPrice),
  bulkThreshold: Math.max(1, Math.round(Number(row?.bulkThreshold) || 1)),
});

export const resolveWaterUnitPrice = ({ pricing, quantity, saleChannel }) => {
  const normalizedQuantity = Math.max(0, Math.round(Number(quantity) || 0));
  const channel = String(saleChannel || "").trim().toLowerCase();
  if (channel === "company") {
    return normalizeConfiguredCents(pricing?.companyPrice);
  }
  const threshold = Math.max(1, Math.round(Number(pricing?.bulkThreshold) || 1));
  return normalizedQuantity >= threshold
    ? normalizeConfiguredCents(pricing?.bulkPrice)
    : normalizeConfiguredCents(pricing?.retailPrice);
};

export const buildWaterPricingPermissions = (role) => {
  const canManagePricing = canManageWaterPricing(role);
  return {
    canManagePricing,
    canOverridePrice: canManagePricing,
    canViewCost: canManagePricing,
    canViewFinance: canManagePricing,
  };
};
