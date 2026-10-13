import assert from "node:assert/strict";
import test from "node:test";
import { buildWaterSummary } from "./waterReporting.js";

test("Water summary distinguishes sale revenue, applied collections and live balance", () => {
  const summary = buildWaterSummary({ sales: [{ quantity: 2, totalAmount: 6000, unitCostAtSaleCents: 2000,
    paymentMethod: "Mobile Money", paymentStatus: "partially_paid", collectedCents: 2500, applicationCount: 1 }],
  collections: [{ amountCents: 2500, method: "mobile_money", status: "PAID", applicationStatus: "APPLIED" },
    { amountCents: 500, method: "momo", status: "PAID", applicationStatus: "REVERSED" }] });
  assert.equal(summary.revenue, 6000);
  assert.equal(summary.cashCollected, 2500);
  assert.equal(summary.momoCollections, 2500);
  assert.equal(summary.momoSalesTotal, 6000);
  assert.equal(summary.pendingMomo, 3500);
  assert.equal(summary.outstandingBalance, 3500);
  assert.equal(summary.grossProfit, 2000);
});

test("payment-date periods can contain collections of earlier sales without repeating revenue", () => {
  const summary = buildWaterSummary({ sales: [],
    collections: [{ amountCents: 2500, method: "Cash", status: "PAID", applicationStatus: "APPLIED" }],
    liveSummary: { stockOnHand: 12, outstandingBalance: 3500, pendingMomo: 3500, outstandingCredit: 0, pendingCash: 0 } });
  assert.equal(summary.revenue, 0);
  assert.equal(summary.cashCollected, 2500);
  assert.equal(summary.outstandingBalance, 3500);
  assert.equal(summary.stockOnHand, 12);
});

test("legacy paid and reversed records never become fabricated verified collections", () => {
  const summary = buildWaterSummary({ sales: [
    { totalAmount: 3000, paymentStatus: "paid", paymentMethod: "cash", applicationCount: 0 },
    { totalAmount: 2000, paymentStatus: "paid", paymentMethod: "cash", applicationCount: 1, collectedCents: 0 },
  ] });
  assert.equal(summary.cashCollected, 0);
  assert.equal(summary.legacyPaidTotal, 3000);
  assert.equal(summary.legacyPaidSaleCount, 1);
  assert.equal(summary.outstandingBalance, 2000);
});
