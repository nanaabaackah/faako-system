import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeVisibleProducts,
  normalizeOrderCurrency,
  PRODUCT_SHOW_ALL_THRESHOLD,
} from "./orderBuilderUtils.js";

const makeProducts = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Product ${i + 1}` }));

describe("computeVisibleProducts", () => {
  it("returns all products when count is under threshold", () => {
    const products = makeProducts(10);
    const result = computeVisibleProducts(products, "", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.items.length, 10);
    assert.equal(result.capped, false);
  });

  it("caps the list when no query and count exceeds threshold", () => {
    const products = makeProducts(100);
    const result = computeVisibleProducts(products, "", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.items.length, PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.capped, true);
    assert.equal(result.total, 100);
  });

  it("shows all products when a query is provided, even over threshold", () => {
    const products = makeProducts(100);
    const result = computeVisibleProducts(products, "balloon", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.items.length, 100);
    assert.equal(result.capped, false);
  });

  it("returns empty list when filteredProducts is empty", () => {
    const result = computeVisibleProducts([], "", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.items.length, 0);
    assert.equal(result.capped, false);
  });

  it("treats whitespace-only query as no query — cap still applies", () => {
    const products = makeProducts(100);
    const result = computeVisibleProducts(products, "   ", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.capped, true);
    assert.equal(result.items.length, PRODUCT_SHOW_ALL_THRESHOLD);
  });

  it("caps when count is threshold + 1", () => {
    const threshold = 5;
    const products = makeProducts(6);
    const result = computeVisibleProducts(products, "", threshold);
    assert.equal(result.items.length, threshold);
    assert.equal(result.capped, true);
  });

  it("does not cap when count equals threshold exactly", () => {
    const threshold = 5;
    const products = makeProducts(5);
    const result = computeVisibleProducts(products, "", threshold);
    assert.equal(result.items.length, 5);
    assert.equal(result.capped, false);
  });

  it("preserves item identity — sliced items are the same references", () => {
    const products = makeProducts(100);
    const result = computeVisibleProducts(products, "", PRODUCT_SHOW_ALL_THRESHOLD);
    assert.equal(result.items[0], products[0]);
    assert.equal(result.items[PRODUCT_SHOW_ALL_THRESHOLD - 1], products[PRODUCT_SHOW_ALL_THRESHOLD - 1]);
  });
});

describe("normalizeOrderCurrency", () => {
  it("uses GHS when product currency is missing", () => {
    assert.equal(normalizeOrderCurrency(), "GHS");
    assert.equal(normalizeOrderCurrency(""), "GHS");
    assert.equal(normalizeOrderCurrency("   "), "GHS");
  });

  it("normalizes an explicit product currency", () => {
    assert.equal(normalizeOrderCurrency(" gbp "), "GBP");
  });
});
