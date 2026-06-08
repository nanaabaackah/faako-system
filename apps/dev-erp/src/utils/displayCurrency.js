import {
  DISPLAY_CURRENCY,
  DEFAULT_CAD_TO_GHS_RATE,
  convertAmountToGhs,
  formatAmountAsGhs as formatSharedAmountAsGhs,
  formatGhsAmount as formatSharedGhsAmount,
  parseCadToGhsRate,
  sumCurrencyAmountsAsGhs,
} from "../../shared/displayCurrency.js";
import { buildApiUrl } from "../api-url";

let activeCadToGhsRate = parseCadToGhsRate(
  import.meta.env?.VITE_CAD_TO_GHS_RATE,
  DEFAULT_CAD_TO_GHS_RATE
);

const getCadToGhsRate = () => parseCadToGhsRate(activeCadToGhsRate, DEFAULT_CAD_TO_GHS_RATE);

const withConfiguredRate = (options = {}) => ({
  cadToGhsRate: getCadToGhsRate(),
  ...options,
});

export const DISPLAY_CURRENCY_CODE = DISPLAY_CURRENCY;

export const getDisplayCadToGhsRate = () => getCadToGhsRate();

export const setDisplayCadToGhsRate = (rate) => {
  const previousRate = activeCadToGhsRate;
  const parsedRate = parseCadToGhsRate(rate, previousRate);
  activeCadToGhsRate = parsedRate;
  return parsedRate !== previousRate;
};

export const hydrateDisplayCurrencyRate = async ({ signal } = {}) => {
  try {
    const response = await fetch(buildApiUrl("/api/currency/display-rate"), {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return setDisplayCadToGhsRate(payload?.rate);
  } catch {
    return false;
  }
};

export const convertAmountToDisplayGhs = (amount, currency, options = {}) =>
  convertAmountToGhs(amount, currency, withConfiguredRate(options));

export const sumAmountsAsDisplayGhs = (
  entries = [],
  getAmount = (entry) => entry?.amount,
  getCurrency = (entry) => entry?.currency,
  options = {}
) => sumCurrencyAmountsAsGhs(entries, getAmount, getCurrency, withConfiguredRate(options));

export const formatGhsAmount = (amount, options = {}) =>
  formatSharedGhsAmount(amount, withConfiguredRate(options));

export const formatAmountAsGhs = (amount, currency, options = {}) =>
  formatSharedAmountAsGhs(amount, currency, withConfiguredRate(options));
