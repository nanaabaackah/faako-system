import { buildWaterPricingPermissions } from "../../functions/_shared/waterPricing.js";

const SALES_ACTIONS = new Set(["sale", "update_sale", "delete_sale", "create_customer", "record_collection"]);
const pick = (record, fields) => Object.fromEntries(
  fields.filter((field) => Object.hasOwn(record || {}, field)).map((field) => [field, record[field]])
);

export const canWriteWaterAction = (role, action) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "owner" || normalizedRole === "admin"
    || (normalizedRole === "water" && SALES_ACTIONS.has(action));
};

// Apply only at the HTTP response boundary. Stock validation and cost snapshots
// must continue using the full, server-private ledger inside the transaction.
export const presentWaterDashboard = (dashboard, role) => {
  // Keep this boundary restricted even if reused by another route.
  const permissions = buildWaterPricingPermissions(canWriteWaterAction(role, "restock") ? role : null);
  if (permissions.canViewFinance && permissions.canViewCost) {
    return { ...dashboard, permissions };
  }
  return {
    ...pick(dashboard, ["scope", "businessUnit", "includedInCoreMetrics", "products"]),
    permissions,
    product: {
      ...pick(dashboard.product, ["key", "name", "packSize", "unit", "pricingConfigured"]),
      pricing: pick(dashboard.product?.pricing, [
        "currency", "retailPrice", "bulkPrice", "companyPrice", "bulkThreshold", "discountLimitBps",
        "configurationErrorCode",
      ]),
    },
    summary: pick(dashboard.summary, ["stockOnHand", "unitsRestocked", "unitsSold", "adjustmentUnits"]),
    restocks: (dashboard.restocks || []).map((row) => pick(row, [
      "id", "productKey", "productName", "quantity", "date", "createdAt",
    ])),
    sales: (dashboard.sales || []).map((row) => pick(row, [
      "id", "productKey", "productName", "quantity", "saleChannel", "paymentMethod",
      "paymentStatus", "paymentReference", "providerReference", "discountType", "discountValue",
      "discountAmount", "unitPrice", "standardUnitPrice", "totalAmount", "customerId",
      "customerName", "notes", "date", "paidAt", "createdAt", "updatedAt",
      "amountPaidCents", "collectedCents", "balanceDueCents", "applicationCount",
      "legacyPaidCents", "legacyPaymentCompatibility",
    ])),
    collections: (dashboard.collections || []).map((row) => pick(row, [
      "id", "applicationId", "saleId", "productKey", "customerId", "customerName", "reference",
      "providerReference", "method", "amountCents", "currency", "paidAt", "status", "applicationStatus",
    ])),
    expenses: [],
    adjustments: (dashboard.adjustments || []).map((row) => pick(row, [
      "id", "productKey", "productName", "quantityDelta", "reason", "date", "createdAt",
    ])),
    priceHistory: (dashboard.priceHistory || []).map((row) => pick(row, [
      "id", "priceType", "previousPriceCents", "newPriceCents", "changedAt",
      "changedByName", "source",
    ])),
  };
};
