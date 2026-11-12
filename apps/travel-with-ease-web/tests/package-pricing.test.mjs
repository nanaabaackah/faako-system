import test from "node:test";
import assert from "node:assert/strict";
import { formatGhsMinor, packageStartingPrice, referenceMonthLabel } from "../src/lib/package-pricing.js";

test("package price display uses validated integer minor units", () => {
  assert.equal(formatGhsMinor(2500000), "GHS 25,000");
  assert.equal(formatGhsMinor(125), "GHS 1.25");
  for (const value of [-1, 0, null, 1.5, Infinity, "25000"]) {
    assert.equal(formatGhsMinor(value), null);
  }
  assert.equal(packageStartingPrice({ pricingStatus: "indicative",
    tiers: [{ amountMinor: 3200000 }, { amountMinor: 2500000 }] }), "From GHS 25,000");
  assert.equal(packageStartingPrice({ pricingStatus: "coming_soon",
    priceFrom: "GHS 1", tiers: [{ amountMinor: 1 }] }), "Price coming soon");
  assert.equal(referenceMonthLabel("2027-06"), "June 2027");
  assert.equal(referenceMonthLabel("2027-13"), "");
});
