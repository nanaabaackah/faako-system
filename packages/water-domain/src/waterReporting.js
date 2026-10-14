import { calculateWaterCostBasis } from "./waterFinancials.js";
import { deriveWaterSettlement } from "./waterSettlement.js";

const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const active = (rows) => (rows || []).filter((row) => !row.archivedAt);
const method = (value) => {
  const key = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["momo", "mobilemoney"].includes(key)) return "momo";
  if (["credit", "paylater"].includes(key)) return "credit";
  return key;
};

// One Water-only definition for API, standalone Water and exports. Period callers filter
// collections by paidAt, not by the date of the sale they eventually settle.
export const buildWaterSummary = ({ restocks = [], sales = [], expenses = [], adjustments = [],
  collections = [], currentCostPrice, liveSummary } = {}) => {
  restocks = active(restocks);
  sales = active(sales);
  expenses = active(expenses);
  adjustments = active(adjustments);
  const sum = (rows, field) => rows.reduce((total, row) => total + amount(row[field]), 0);
  const unitsRestocked = sum(restocks, "quantity");
  const unitsSold = sum(sales, "quantity");
  const adjustmentUnits = sum(adjustments, "quantityDelta");
  const stockOnHand = liveSummary?.stockOnHand ?? (unitsRestocked - unitsSold + adjustmentUnits);
  const revenue = sum(sales, "totalAmount");
  const projected = sales.map((sale) => ({ ...sale, ...deriveWaterSettlement(sale, {
    amountPaidCents: sale.collectedCents, applicationCount: sale.applicationCount,
  }) }));
  const balanceFor = (paymentMethod) => projected.reduce((total, sale) => total
    + (method(sale.paymentMethod) === paymentMethod ? sale.balanceDueCents : 0), 0);
  const salesFor = (paymentMethod) => sum(sales.filter((sale) => method(sale.paymentMethod) === paymentMethod), "totalAmount");
  const validCollections = collections.filter((row) => row.status === "PAID" && row.applicationStatus === "APPLIED");
  const received = validCollections.map((row) => ({ ...row, receivedCents: row.cashReceivedCents ?? row.amountCents }));
  const cashCollected = sum(received, "receivedCents");
  const cashCollections = sum(received.filter((row) => method(row.method) === "cash"), "receivedCents");
  const momoCollections = sum(received.filter((row) => method(row.method) === "momo"), "receivedCents");
  const extraExpenses = sum(expenses, "amount");
  const costs = calculateWaterCostBasis({ restocks, sales, stockOnHand, currentUnitCost: currentCostPrice });
  const grossProfit = costs.profitabilityAvailable ? revenue - costs.costOfGoodsSold : null;
  return {
    unitsRestocked, unitsSold, adjustmentUnits, stockOnHand, revenue, extraExpenses, ...costs,
    grossProfit, netProfit: grossProfit === null ? null : grossProfit - extraExpenses,
    cashCollected, cashCollections, momoCollections,
    cashPosition: costs.restockSpend === null ? null : cashCollected - costs.restockSpend - extraExpenses,
    outstandingBalance: liveSummary?.outstandingBalance ?? sum(projected, "balanceDueCents"),
    outstandingCredit: liveSummary?.outstandingCredit ?? balanceFor("credit"),
    pendingCash: liveSummary?.pendingCash ?? balanceFor("cash"),
    pendingMomo: liveSummary?.pendingMomo ?? balanceFor("momo"),
    cashSalesTotal: salesFor("cash"), momoSalesTotal: salesFor("momo"), creditSalesTotal: salesFor("credit"),
    legacyPaidTotal: sum(projected, "legacyPaidCents"),
    legacyPaidSaleCount: projected.filter((sale) => sale.legacyPaymentCompatibility).length,
    inventoryValue: liveSummary?.inventoryValue === undefined ? costs.inventoryValue : liveSummary.inventoryValue,
  };
};
