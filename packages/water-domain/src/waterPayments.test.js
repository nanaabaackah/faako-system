import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWaterPaymentMethod, defaultNewWaterPaymentStatus } from "./waterPayments.js";

test("Water recognizes provider Mobile Money labels without classifying them as cash", () => {
  for (const method of ["momo", "MoMo", "Mobile Money", "mobile_money", "mobile-money"]) {
    assert.equal(normalizeWaterPaymentMethod(method), "momo");
    assert.equal(defaultNewWaterPaymentStatus(method), "pending");
  }
});

test("new Water collections default to paid cash, unconfirmed MoMo and unpaid credit", () => {
  assert.equal(defaultNewWaterPaymentStatus("cash"), "paid");
  for (const method of ["credit", "Pay later", "paylater"]) {
    assert.equal(normalizeWaterPaymentMethod(method), "credit");
    assert.equal(defaultNewWaterPaymentStatus(method), "unpaid");
  }
});
