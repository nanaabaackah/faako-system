export const DEFAULT_WATER_UNIT_COST = 2200;

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveUnitCost = (value, fallbackUnitCost) => {
  const parsed = Math.round(toFiniteNumber(value, 0));
  return parsed > 0 ? parsed : fallbackUnitCost;
};

const getTimestamp = (record) => {
  const datedAt = new Date(record?.date || "").getTime();
  if (Number.isFinite(datedAt)) return datedAt;
  const createdAt = new Date(record?.createdAt || "").getTime();
  return Number.isFinite(createdAt) ? createdAt : Number.NEGATIVE_INFINITY;
};

const compareDatedRecords = (left, right) => {
  const timestampDifference = getTimestamp(left) - getTimestamp(right);
  if (timestampDifference !== 0) return timestampDifference;
  const createdDifference = new Date(left?.createdAt || "").getTime()
    - new Date(right?.createdAt || "").getTime();
  if (Number.isFinite(createdDifference) && createdDifference !== 0) return createdDifference;
  return toFiniteNumber(left?.id, 0) - toFiniteNumber(right?.id, 0);
};

/**
 * Calculates the Water-only inventory cost basis in integer pesewas.
 *
 * New sales use their immutable unitCostAtSaleCents snapshot. Legacy sales use
 * the recorded cost from their Water restock period (the latest restock at or
 * before the sale). Inventory uses the latest recorded restock cost. This keeps
 * historical profit stable when a later restock has a different price and never
 * mixes Water costs into REEBS core inventory.
 */
export const calculateWaterCostBasis = ({
  restocks = [],
  sales = [],
  unitsSold = 0,
  stockOnHand = 0,
  fallbackUnitCost = DEFAULT_WATER_UNIT_COST,
} = {}) => {
  const safeFallbackUnitCost = Math.max(
    1,
    Math.round(toFiniteNumber(fallbackUnitCost, DEFAULT_WATER_UNIT_COST))
  );

  const orderedRestocks = [...(Array.isArray(restocks) ? restocks : [])]
    .filter((restock) => toFiniteNumber(restock?.quantity, 0) > 0)
    .sort(compareDatedRecords);
  const totals = orderedRestocks.reduce(
    (result, restock) => {
      const quantity = Math.max(0, toFiniteNumber(restock?.quantity, 0));
      if (quantity <= 0) return result;
      const unitCost = resolveUnitCost(restock?.unitCost, safeFallbackUnitCost);
      result.units += quantity;
      result.spend += quantity * unitCost;
      return result;
    },
    { units: 0, spend: 0 }
  );

  const latestUnitCost = orderedRestocks.length > 0
    ? resolveUnitCost(orderedRestocks.at(-1)?.unitCost, safeFallbackUnitCost)
    : safeFallbackUnitCost;
  const safeSales = Array.isArray(sales) ? sales : [];
  const datedCostOfGoodsSold = safeSales.reduce((total, sale) => {
    const snapshottedUnitCost = Math.round(
      toFiniteNumber(sale?.unitCostAtSaleCents, 0)
    );
    if (snapshottedUnitCost > 0) {
      return total + (
        Math.max(0, toFiniteNumber(sale?.quantity, 0)) * snapshottedUnitCost
      );
    }

    const saleTimestamp = getTimestamp(sale);
    let saleUnitCost = safeFallbackUnitCost;
    for (const restock of orderedRestocks) {
      if (getTimestamp(restock) > saleTimestamp) break;
      saleUnitCost = resolveUnitCost(restock?.unitCost, safeFallbackUnitCost);
    }
    return total + (Math.max(0, toFiniteNumber(sale?.quantity, 0)) * saleUnitCost);
  }, 0);
  const safeUnitsSold = Math.max(0, toFiniteNumber(unitsSold, 0));
  const safeStockOnHand = Math.max(0, toFiniteNumber(stockOnHand, 0));

  return {
    restockSpend: Math.round(totals.spend),
    currentUnitCost: latestUnitCost,
    costOfGoodsSold: Math.round(
      safeSales.length > 0 ? datedCostOfGoodsSold : safeUnitsSold * latestUnitCost
    ),
    inventoryValue: Math.round(safeStockOnHand * latestUnitCost),
  };
};
