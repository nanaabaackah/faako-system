import assert from "node:assert/strict";
import test from "node:test";
import {
  didWaterSalePricingBasisChange,
  resolveWaterPriceDecision,
} from "./water.js";

test("Water sales use the configured current price as their standard", () => {
  assert.deepEqual(
    resolveWaterPriceDecision({ standardPriceCents: 2700 }),
    {
      unitPrice: 2700,
      standardUnitPrice: 2700,
      isOverride: false,
      overrideReason: null,
    }
  );
});

test("a zero current price remains valid while negative or missing prices fail closed", () => {
  assert.equal(resolveWaterPriceDecision({ standardPriceCents: 0 }).unitPrice, 0);
  assert.equal(resolveWaterPriceDecision({ standardPriceCents: -1 }).statusCode, 503);
  assert.equal(resolveWaterPriceDecision({ standardPriceCents: null }).statusCode, 503);
});

test("sale price overrides still require pricing permission", () => {
  const denied = resolveWaterPriceDecision({
    standardPriceCents: 2700,
    submittedPriceCents: 2500,
    hasSubmittedPrice: true,
  });
  assert.equal(denied.statusCode, 403);

  const allowed = resolveWaterPriceDecision({
    standardPriceCents: 2700,
    submittedPriceCents: 2500,
    hasSubmittedPrice: true,
    canOverride: true,
  });
  assert.equal(allowed.unitPrice, 2500);
  assert.equal(allowed.standardUnitPrice, 2700);
});

test("sale edits re-resolve current pricing when quantity or sale channel changes", () => {
  const existing = { quantity: 9, saleChannel: "retail", date: "2026-08-20T00:00:00.000Z" };
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing }), false);
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing, quantity: 10 }), true);
  assert.equal(didWaterSalePricingBasisChange(existing, { ...existing, saleChannel: "company" }), true);
});
