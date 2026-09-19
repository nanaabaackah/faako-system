const FINANCIAL_ROLES = new Set(["owner", "admin", "manager"]);

export const canManageWaterPricing = (role) =>
  FINANCIAL_ROLES.has(String(role || "").trim().toLowerCase());

export const canViewWaterFinancials = canManageWaterPricing;

export const normalizeConfiguredCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed);
  return cents > 0 ? cents : null;
};

export const normalizeWaterPricing = (row = null) => ({
  retailSingle: normalizeConfiguredCents(row?.retailSinglePrice),
  retailBulk: normalizeConfiguredCents(row?.retailBulkPrice),
  company: normalizeConfiguredCents(row?.companyPrice),
  bulkThreshold: Math.max(1, Math.round(Number(row?.bulkThreshold) || 1)),
});

export const resolveWaterUnitPrice = ({ pricing, quantity, saleChannel }) => {
  const normalizedQuantity = Math.max(0, Math.round(Number(quantity) || 0));
  const channel = String(saleChannel || "").trim().toLowerCase();
  if (channel === "company") {
    return normalizeConfiguredCents(pricing?.company);
  }
  const threshold = Math.max(1, Math.round(Number(pricing?.bulkThreshold) || 1));
  return normalizedQuantity >= threshold
    ? normalizeConfiguredCents(pricing?.retailBulk)
    : normalizeConfiguredCents(pricing?.retailSingle);
};

export const calculateWaterCostSummary = (sales = []) => {
  let knownCostOfGoodsSold = 0;
  let missingCostSaleCount = 0;

  for (const sale of Array.isArray(sales) ? sales : []) {
    const quantity = Math.max(0, Math.round(Number(sale?.quantity) || 0));
    const unitCost = normalizeConfiguredCents(sale?.unitCostAtTransaction);
    if (!unitCost) {
      missingCostSaleCount += 1;
      continue;
    }
    knownCostOfGoodsSold += quantity * unitCost;
  }

  return {
    costOfGoodsSold: missingCostSaleCount > 0 ? null : knownCostOfGoodsSold,
    knownCostOfGoodsSold,
    missingCostSaleCount,
    profitabilityAvailable: missingCostSaleCount === 0,
  };
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
