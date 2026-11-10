import currencies from "../../../travel-with-ease-api/config/currencies.json" with { type: "json" };
import { convertMinorUnits } from "../../../travel-with-ease-api/src/domain/money.js";

export const displayCurrencies = currencies.filter(
  (item) => item.enabled && item.minorUnit === 2,
);
export const currencyPreferenceKey = "twe-display-currency-v1";
export const displayCurrencyPolicyHeading = "Display currency and indicative exchange rates";
export const supportedCurrency = (code) =>
  displayCurrencies.some((item) => item.code === code);

export function moneySegments(text) {
  const source = String(text || "");
  const result = [];
  let cursor = 0;
  for (const match of source.matchAll(
    /GHS\s+(\d[\d,]*(?:\.\d{1,2})?)(?![\d,]|\.\d)/g,
  )) {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(match[1])) continue;
    const [whole, fraction = ""] = match[1].replaceAll(",", "").split(".");
    const minor = Number(
      BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")),
    );
    if (!Number.isSafeInteger(minor) || minor <= 0) continue;
    if (match.index > cursor)
      result.push({ text: source.slice(cursor, match.index) });
    // Keep approved ISO-code source text; present the dedicated cedi sign to visitors.
    result.push({ text: match[0], displayText: `GH₵${match[1]}`, minor });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) result.push({ text: source.slice(cursor) });
  return result;
}

export function validateDisplayRate(data, currency, now = Date.now()) {
  const age = now - Date.parse(data?.updatedAt);
  if (
    !supportedCurrency(currency) ||
    data?.baseCurrency !== "GHS" ||
    data?.currency !== currency ||
    data?.indicative !== true ||
    data?.provider !== "exchange-rate-api" ||
    typeof data?.stale !== "boolean" ||
    !/^\d{1,8}(?:\.\d{1,12})?$/.test(data?.rate || "") ||
    Number(data.rate) <= 0 ||
    !Number.isFinite(age) ||
    age < -300_000 ||
    age > 72 * 60 * 60_000
  ) {
    throw new Error(
      "Currency estimates are unavailable. Prices remain in GHS.",
    );
  }
  return data;
}

export function convertedDisplay(minor, currency, rate) {
  if (
    !Number.isSafeInteger(minor) ||
    minor <= 0 ||
    !supportedCurrency(currency)
  )
    throw new Error("Invalid display amount.");
  const amount = convertMinorUnits(String(minor), rate);
  return `≈ ${currency} ${new Intl.NumberFormat("en-GH").format(amount / 100n)}.${String(amount % 100n).padStart(2, "0")}`;
}

export function applyDisplayCurrency(document, currency = "GHS", rate = "1") {
  for (const element of document.querySelectorAll("[data-twe-money]")) {
    const price = element.querySelector("[data-money-value]");
    const original = element.querySelector("[data-money-original]");
    if (!price || !original) continue;
    const base = element.getAttribute("data-ghs-label");
    price.textContent =
      currency === "GHS"
        ? base
        : convertedDisplay(
            Number(element.getAttribute("data-twe-money")),
            currency,
            rate,
          );
    original.hidden = currency === "GHS";
  }
  const hasPrices = document.querySelectorAll("[data-twe-money]").length > 0;
  document.querySelectorAll("[data-currency-attribution]").forEach((element, index) => {
    element.hidden = currency === "GHS" || !hasPrices || index > 0;
  });
}
