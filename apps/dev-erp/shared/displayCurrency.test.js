import assert from "node:assert/strict";
import test from "node:test";

import {
  convertAmountToGhs,
  formatAmountAsGhs,
  formatGhsAmount,
  parseCadToGhsRate,
  sumCurrencyAmountsAsGhs,
} from "./displayCurrency.js";

test("parseCadToGhsRate falls back for missing or invalid values", () => {
  assert.equal(parseCadToGhsRate(undefined), 1);
  assert.equal(parseCadToGhsRate(""), 1);
  assert.equal(parseCadToGhsRate("-2"), 1);
  assert.equal(parseCadToGhsRate("12.5"), 12.5);
});

test("convertAmountToGhs converts CAD and leaves GHS unchanged", () => {
  assert.equal(convertAmountToGhs(10, "CAD", { cadToGhsRate: 8.25 }), 82.5);
  assert.equal(convertAmountToGhs(10, "GHS", { cadToGhsRate: 8.25 }), 10);
  assert.equal(convertAmountToGhs("not-a-number", "CAD", { cadToGhsRate: 8.25 }), 0);
});

test("sumCurrencyAmountsAsGhs aggregates mixed source currencies into GHS", () => {
  const entries = [
    { amount: 10, currency: "CAD" },
    { amount: 25, currency: "GHS" },
    { amount: "2.5", currency: "CAD" },
  ];

  assert.equal(sumCurrencyAmountsAsGhs(entries, undefined, undefined, { cadToGhsRate: 8 }), 125);
});

test("formatAmountAsGhs always uses the GHS display code", () => {
  assert.equal(formatAmountAsGhs(10, "CAD", { cadToGhsRate: 8.25 }), "GHS 82.50");
  assert.equal(formatGhsAmount(1234.5), "GHS 1,234.50");
});
