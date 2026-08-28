import assert from "node:assert/strict";
import test from "node:test";
import {
  isCoreCommercialProduct,
  isCoreOrderProduct,
  isWaterInventoryProduct,
} from "./coreCommercialInventory.js";

test("Water products stay outside REEBS Core commercial selectors", () => {
  const waterProduct = { id: 1, sourceCategoryCode: "WATER" };

  assert.equal(isWaterInventoryProduct(waterProduct), true);
  assert.equal(isCoreOrderProduct(waterProduct), false);
  assert.equal(isCoreCommercialProduct(waterProduct), false);
});

test("source category normalization covers legacy inventory response fields", () => {
  assert.equal(isWaterInventoryProduct({ sourcecategorycode: " water " }), true);
  assert.equal(isWaterInventoryProduct({ source_category_code: "Water" }), true);
});

test("core orders accept shop products and keep rentals in Bookings", () => {
  assert.equal(isCoreOrderProduct({ sourceCategoryCode: "INVENTORY" }), true);
  assert.equal(isCoreOrderProduct({ sourceCategoryCode: "RENTAL" }), false);
  assert.equal(isCoreCommercialProduct({ sourceCategoryCode: "RENTAL" }), true);
});

test("legacy products without a source category retain existing core behavior", () => {
  assert.equal(isCoreOrderProduct({ id: 4, name: "Legacy shop item" }), true);
  assert.equal(isCoreCommercialProduct({ id: 4, name: "Legacy shop item" }), true);
});

