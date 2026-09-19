import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStockStatus,
  getAvailableQuantity,
  getStockStatus,
  getVariantAvailableQty,
  getVariantParentStock,
  isLowStockItem,
} from "./inventoryViewModel.js";

test("derives available variant and parent quantities without counting inactive variants", () => {
  const variants = [
    { stockQty: 8, reservedQty: 3, status: "active" },
    { stockQty: 4, reservedQty: 0, status: "inactive" },
  ];

  assert.equal(getVariantAvailableQty(variants[0]), 5);
  assert.equal(getVariantParentStock(variants), 8);
});

test("keeps rental availability date-based instead of presenting sale stock", () => {
  const rental = {
    stock: 12,
    sourceCategoryCode: "RENTAL",
    availabilityMode: "DATE_BASED",
    reorderLevel: 20,
  };

  assert.equal(getAvailableQuantity(rental), null);
  assert.equal(isLowStockItem(rental), false);
});

test("uses the configured reorder level and keeps out-of-stock separate from low stock", () => {
  const item = { stock: 2, reorderLevel: 3 };
  assert.equal(isLowStockItem(item), true);
  assert.equal(getStockStatus(item), "low_stock");
  assert.equal(formatStockStatus(getStockStatus(item)), "Low stock");

  assert.equal(isLowStockItem({ ...item, stock: 0 }), false);
  assert.equal(getStockStatus({ ...item, stock: 0 }), "out_of_stock");
});
