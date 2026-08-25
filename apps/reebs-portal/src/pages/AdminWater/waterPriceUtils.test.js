import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMoneyInputValue,
  toMoneyInputValue,
} from "./waterPriceUtils.js";

test("converts Water money values to and from the frontend currency input format", () => {
  assert.equal(toMoneyInputValue(2700), "27.00");
  assert.equal(toMoneyInputValue(2555), "25.55");
  assert.equal(toMoneyInputValue(0), "");
  assert.equal(parseMoneyInputValue("27.00"), 2700);
  assert.equal(parseMoneyInputValue("25.55"), 2555);
  assert.equal(parseMoneyInputValue("1,250.75"), 125075);
  assert.equal(parseMoneyInputValue("0"), null);
  assert.equal(parseMoneyInputValue("invalid"), null);
});
