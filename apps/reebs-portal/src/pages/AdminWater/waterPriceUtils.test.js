import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRetailPriceUpdatePayload,
  parseMoneyInputValue,
  toMoneyInputValue,
} from "./waterPriceUtils.js";

test("converts retail prices to and from the frontend currency input format", () => {
  assert.equal(toMoneyInputValue(2700), "27.00");
  assert.equal(toMoneyInputValue(2555), "25.55");
  assert.equal(toMoneyInputValue(0), "");
  assert.equal(parseMoneyInputValue("27.00"), 2700);
  assert.equal(parseMoneyInputValue("25.55"), 2555);
  assert.equal(parseMoneyInputValue("1,250.75"), 125075);
  assert.equal(parseMoneyInputValue("0"), null);
  assert.equal(parseMoneyInputValue("invalid"), null);
});

test("keeps the API payload in GHS while retaining the price in pesewas locally", () => {
  assert.deepEqual(buildRetailPriceUpdatePayload("25.55"), {
    cents: 2555,
    retailSingle: "25.55",
  });
  assert.deepEqual(buildRetailPriceUpdatePayload("25.555"), {
    cents: 2556,
    retailSingle: "25.56",
  });
  assert.equal(buildRetailPriceUpdatePayload("0"), null);
});
