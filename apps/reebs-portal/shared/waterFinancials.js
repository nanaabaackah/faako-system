const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeWaterUnitCost = (value) => {
  const parsed = Math.round(toFiniteNumber(value, 0));
  return parsed > 0 ? parsed : null;
};

const getTimestamp = (record) => {
  const datedAt = new Date(record?.date || "").getTime();
  if (Number.isFinite(datedAt)) return datedAt;
  const createdAt = new Date(record?.createdAt || "").getTime();
  return Number.isFinite(createdAt) ? createdAt : Number.NEGATIVE_INFINITY;
};

const compareDatedRecords = (left, right) => {
  const timestampDifference = getTimestamp(left) - getTimestamp(right);
  if (Number.isFinite(timestampDifference) && timestampDifference !== 0) return timestampDifference;
  if (getTimestamp(left) !== getTimestamp(right)) return getTimestamp(left) < getTimestamp(right) ? -1 : 1;
  const createdDifference = new Date(left?.createdAt || "").getTime()
    - new Date(right?.createdAt || "").getTime();
  if (Number.isFinite(createdDifference) && createdDifference !== 0) return createdDifference;
  return toFiniteNumber(left?.id, 0) - toFiniteNumber(right?.id, 0);
};

// Shared by the API and Portal. Reading a dashboard must never invent or
// restate historical costs; only the explicit restock correction writes them.
export const calculateWaterCostSummary = (sales = []) => {
  let knownCostOfGoodsSold = 0;
  let missingCostSaleCount = 0;
  for (const sale of Array.isArray(sales) ? sales : []) {
    const quantity = Math.max(0, toFiniteNumber(sale?.quantity));
    const unitCost = normalizeWaterUnitCost(sale?.unitCostAtSaleCents ?? sale?.unitCostAtTransaction);
    if (unitCost === null) {
      missingCostSaleCount += 1;
      continue;
    }
    knownCostOfGoodsSold += quantity * unitCost;
  }
  return {
    costOfGoodsSold: missingCostSaleCount > 0 ? null : Math.round(knownCostOfGoodsSold),
    knownCostOfGoodsSold: Math.round(knownCostOfGoodsSold),
    missingCostSaleCount,
    profitabilityAvailable: missingCostSaleCount === 0,
  };
};

/** Water-only costs, in integer pesewas. Unknown costs stay null, never zero or
 * a compatibility price. Inventory uses the latest recorded restock cost;
 * filtered Portal summaries can supply the dashboard's current recorded cost.
 */
export const calculateWaterCostBasis = ({
  restocks = [],
  sales = [],
  stockOnHand = 0,
  currentUnitCost,
} = {}) => {
  const orderedRestocks = [...(Array.isArray(restocks) ? restocks : [])]
    .filter((restock) => toFiniteNumber(restock?.quantity, 0) > 0)
    .sort(compareDatedRecords);
  let restockSpend = 0;
  let missingCostRestockCount = 0;
  for (const restock of orderedRestocks) {
    const cost = normalizeWaterUnitCost(restock?.unitCost);
    if (cost === null) missingCostRestockCount += 1;
    else restockSpend += toFiniteNumber(restock.quantity) * cost;
  }
  const latestUnitCost = normalizeWaterUnitCost(
    currentUnitCost === undefined ? orderedRestocks.at(-1)?.unitCost : currentUnitCost
  );
  const safeStockOnHand = Math.max(0, toFiniteNumber(stockOnHand, 0));

  return {
    ...calculateWaterCostSummary(sales),
    restockSpend: missingCostRestockCount > 0 ? null : Math.round(restockSpend),
    missingCostRestockCount,
    currentUnitCost: latestUnitCost,
    inventoryValue: safeStockOnHand === 0 ? 0
      : latestUnitCost === null ? null : Math.round(safeStockOnHand * latestUnitCost),
  };
};
