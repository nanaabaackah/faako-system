import assert from "node:assert/strict";
import test from "node:test";
import { buildCoreInventoryPlan } from "./importCoreInventoryCsv.mjs";

test("Core Inventory CSV plan is deterministic, unique, and excludes Water", () => {
  const first = buildCoreInventoryPlan();
  const second = buildCoreInventoryPlan();
  assert.ok(first.length > 1_000);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((product) => product.sku)).size, first.length);
  assert.equal(first.some((product) => product.sourceCategoryCode === "WATER"), false);
  assert.ok(first.some((product) => product.sourceCategoryCode === "RENTAL"));
  assert.ok(first.some((product) => product.sourceCategoryCode === "SHOP"));
  assert.ok(first.some((product) => product.relationship?.type === "machine"));
  assert.ok(first.some((product) => product.relationship?.type === "bouncyCastle"));
  assert.ok(first.some((product) => product.relationship?.type === "indoorGame"));
});

test("Core Inventory CSV plan preserves non-negative money and stock values", () => {
  const products = buildCoreInventoryPlan();
  for (const product of products) {
    assert.ok(Number.isSafeInteger(product.price) && product.price >= 0, product.sku);
    assert.ok(Number.isSafeInteger(product.stock) && product.stock >= 0, product.sku);
    assert.equal(product.stockValue, product.price * product.stock, product.sku);
  }
});
