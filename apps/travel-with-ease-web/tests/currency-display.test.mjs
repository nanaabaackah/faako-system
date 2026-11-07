import test from "node:test";
import assert from "node:assert/strict";
import {
  moneySegments, convertedDisplay, supportedCurrency, validateDisplayRate, displayCurrencyPolicyHeading,
} from "../src/lib/currency-display.js";
import approved from "../content/approved-public-release.json" with { type: "json" };
import { readFileSync } from "node:fs";

test("only explicit GHS amounts become display prices and original wording remains intact", () => {
  const text = "From GHS 2,500; each additional traveller is GHS 250. No booking yet.";
  const segments = moneySegments(text);
  assert.equal(segments.map(item => item.text).join(""), text);
  assert.deepEqual(segments.filter(item => item.minor).map(item => item.minor), [250000, 25000]);
  assert.equal(moneySegments("GHS 1.05")[0].minor, 105);
  assert.equal(moneySegments("Price coming soon")[0].text, "Price coming soon");
  assert.equal(moneySegments("GHS 9999999999999999999999").some(item => item.minor), false);
  assert.equal(moneySegments("GHS 400.999").some(item => item.minor), false);
  assert.equal(supportedCurrency("<script>"), false);
});

test("display conversion uses exact integer rounding and unambiguous ISO labels", () => {
  assert.equal(convertedDisplay(2500000, "USD", "0.08"), "≈ USD 2,000.00");
  assert.equal(convertedDisplay(1, "GBP", "1.5"), "≈ GBP 0.02");
  assert.throws(() => convertedDisplay(-1, "USD", "1"));
  assert.throws(() => convertedDisplay(100, "XXX", "1"));
});

test("browser validates currency identity, positive rates, freshness and indicative status", () => {
  const value = { baseCurrency: "GHS", currency: "USD", rate: "0.08", provider: "exchange-rate-api", updatedAt: new Date().toISOString(), stale: false, indicative: true };
  assert.equal(validateDisplayRate(value, "USD"), value);
  for (const override of [{ baseCurrency: "EUR" }, { currency: "GBP" }, { rate: "0" }, { rate: "Infinity" }, { indicative: false }, { updatedAt: "bad" }, { updatedAt: new Date(Date.now() - 73 * 3_600_000).toISOString() }]) {
    assert.throws(() => validateDisplayRate({ ...value, ...override }, "USD"));
  }
});

test("the rate note is published in Terms and the compact selector belongs to the legal row", () => {
  const notice = approved.pages.terms.entries.find(entry => entry.heading === displayCurrencyPolicyHeading);
  assert.ok(notice);
  assert.match(notice.text, /not a live quote/);
  assert.match(notice.text, /72 hours/);
  const footer = readFileSync(new URL("../src/components/PublicFooter.astro", import.meta.url), "utf8");
  assert.match(footer, /<nav aria-label="Legal and preferences">[\s\S]*<CurrencySwitcher client:load/);
  assert.match(footer, /currencyNoticePublished/);
  const switcher = readFileSync(new URL("../src/components/CurrencySwitcher.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(switcher, /Conversion is a guide|Rates by ExchangeRate-API/);
});
