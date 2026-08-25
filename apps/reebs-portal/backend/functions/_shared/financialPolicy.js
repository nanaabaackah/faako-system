import {
  createConsolidatedAnalyticsResponse,
  withSharedBusinessContext,
} from "@faako/api-contracts/reebs";

export const FINANCIAL_SCOPE = Object.freeze({
  REEBS_CORE: "reebs-core",
  CONSOLIDATED: "consolidated",
});

const EXCLUDED_CORE_ORDER_STATUSES = new Set([
  "cancelled",
  "canceled",
  "refunded",
]);

const CONSOLIDATED_SUMMARY_FIELDS = Object.freeze([
  "revenue",
  "cogs",
  "grossProfit",
  "operatingExpenses",
  "netProfit",
]);

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeCents = (value, fallback = 0) =>
  Math.max(0, Math.round(toFiniteNumber(value, fallback)));

const normalizeSqlAlias = (value) => {
  const alias = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new TypeError("A safe SQL table alias is required.");
  }
  return alias;
};

const getLineSourceCategory = (line) =>
  String(
    line?.sourceCategoryCode
      ?? line?.product?.sourceCategoryCode
      ?? line?.productSourceCategoryCode
      ?? ""
  ).trim().toUpperCase();

export const isWaterOrderLine = (line) => getLineSourceCategory(line) === "WATER";

/**
 * In-memory counterpart of the core finance query policy. This is used by
 * reconciliation checks and keeps Water records out of core totals by default.
 */
export const isRecognizedCoreOrder = (order = {}) => {
  const status = String(order?.status || "").trim().toLowerCase();
  if (EXCLUDED_CORE_ORDER_STATUSES.has(status)) return false;
  const lines = Array.isArray(order?.items) ? order.items : [];
  return !lines.some(isWaterOrderLine);
};

/**
 * Persisted grand totals already include delivery and service fees. Finance
 * reporting must use this value once and expose delivery only as a breakdown.
 */
export const resolvePersistedOrderGrandTotalCents = (order = {}) => {
  const candidates = [
    order?.grandTotalCents,
    order?.total_amount,
    order?.totalAmountCents,
  ];
  const persisted = candidates.find(
    (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
  );
  return toNonNegativeCents(persisted, 0);
};

export const resolveOrderItemCostBasis = (line = {}) => {
  const snapshot = line?.unitCostCents;
  if (
    snapshot !== null
    && snapshot !== undefined
    && snapshot !== ""
    && Number.isFinite(Number(snapshot))
    && Number(snapshot) >= 0
  ) {
    return {
      unitCostCents: toNonNegativeCents(snapshot),
      source: "order-item-snapshot",
    };
  }

  return {
    unitCostCents: toNonNegativeCents(
      line?.purchasePriceGhs ?? line?.product?.purchasePriceGhs,
      0
    ),
    source: "legacy-current-product-cost",
  };
};

export const summarizeRecognizedCoreOrders = (orders = []) => {
  const result = {
    orders: 0,
    units: 0,
    revenueCents: 0,
    cogsCents: 0,
    deliveryFeeBreakdownCents: 0,
    excludedCancelledOrRefunded: 0,
    excludedWaterContaminated: 0,
  };

  for (const order of Array.isArray(orders) ? orders : []) {
    const status = String(order?.status || "").trim().toLowerCase();
    if (EXCLUDED_CORE_ORDER_STATUSES.has(status)) {
      result.excludedCancelledOrRefunded += 1;
      continue;
    }

    const lines = Array.isArray(order?.items) ? order.items : [];
    if (lines.some(isWaterOrderLine)) {
      result.excludedWaterContaminated += 1;
      continue;
    }

    result.orders += 1;
    result.revenueCents += resolvePersistedOrderGrandTotalCents(order);
    result.deliveryFeeBreakdownCents += toNonNegativeCents(order?.deliveryFeeCents, 0);

    for (const line of lines) {
      const quantity = Math.max(0, toFiniteNumber(line?.quantity, 0));
      const { unitCostCents } = resolveOrderItemCostBasis(line);
      result.units += quantity;
      result.cogsCents += quantity * unitCostCents;
    }
  }

  result.units = Math.round(result.units);
  result.cogsCents = Math.round(result.cogsCents);
  return result;
};

export const buildPersistedOrderGrandTotalSql = (orderAlias = "o") => {
  const alias = normalizeSqlAlias(orderAlias);
  return `COALESCE(${alias}."grandTotalCents", ${alias}.total_amount)`;
};

export const buildCoreOrderRecognitionFilter = (orderAlias = "o") => {
  const alias = normalizeSqlAlias(orderAlias);
  return `
      AND LOWER(COALESCE(${alias}.status, '')) NOT IN ('cancelled', 'canceled', 'refunded')
      AND NOT EXISTS (
        SELECT 1
        FROM "orderItem" scoped_oi
        JOIN "product" scoped_p ON scoped_p.id = scoped_oi."productId"
        WHERE scoped_oi."orderId" = ${alias}.id
          AND scoped_oi."organizationId" = ${alias}."organizationId"
          AND UPPER(COALESCE(scoped_p."sourceCategoryCode", '')) = 'WATER'
      )`;
};

export const getFinancialScopeDecision = ({
  requestedScope = FINANCIAL_SCOPE.REEBS_CORE,
  canViewConsolidated = false,
} = {}) => {
  const scope = String(requestedScope || FINANCIAL_SCOPE.REEBS_CORE)
    .trim()
    .toLowerCase();

  if (!Object.values(FINANCIAL_SCOPE).includes(scope)) {
    return {
      allowed: false,
      scope,
      statusCode: 400,
      error: "Financial scope must be reebs-core or consolidated. Use the Water API for Water-only reporting.",
    };
  }

  if (scope === FINANCIAL_SCOPE.CONSOLIDATED && !canViewConsolidated) {
    return {
      allowed: false,
      scope,
      statusCode: 403,
      error: "Consolidated financial reporting permission is required.",
    };
  }

  return { allowed: true, scope };
};

export const buildConsolidatedFinancialSummary = ({
  reebsCore = {},
  water = {},
  shared = {},
} = {}) => Object.fromEntries(
  CONSOLIDATED_SUMMARY_FIELDS.map((field) => [
    field,
    [reebsCore, water, shared].reduce(
      (total, component) => total + toFiniteNumber(component?.[field], 0),
      0
    ),
  ])
);

/**
 * Creates an explicitly segmented response. Shared values are never allocated
 * into Core or Water implicitly; the visible summary is the exact component sum.
 */
export const buildConsolidatedFinancialResponse = ({
  reebsCore = {},
  water = {},
  shared = {},
  metadata = {},
} = {}) => {
  const scopedComponents = createConsolidatedAnalyticsResponse({
    reebsCore,
    water,
  });
  const scopedShared = withSharedBusinessContext(shared);

  return {
    ...scopedComponents,
    ...metadata,
    components: {
      ...scopedComponents.components,
      shared: scopedShared,
    },
    summary: buildConsolidatedFinancialSummary({
      reebsCore,
      water,
      shared: scopedShared,
    }),
  };
};
