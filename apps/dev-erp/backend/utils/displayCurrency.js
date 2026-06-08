import process from "node:process";
import {
  DISPLAY_CURRENCY,
  DEFAULT_CAD_TO_GHS_RATE,
  convertAmountToGhs,
  formatAmountAsGhs as formatSharedAmountAsGhs,
  formatGhsAmount as formatSharedGhsAmount,
  parseCadToGhsRate,
  sumCurrencyAmountsAsGhs,
} from "../../shared/displayCurrency.js";

let activeCadToGhsRate = parseCadToGhsRate(
  process.env.CAD_TO_GHS_RATE ?? process.env.VITE_CAD_TO_GHS_RATE,
  DEFAULT_CAD_TO_GHS_RATE
);

const getCadToGhsRate = () =>
  parseCadToGhsRate(activeCadToGhsRate, DEFAULT_CAD_TO_GHS_RATE);

const withConfiguredRate = (options = {}) => ({
  cadToGhsRate: getCadToGhsRate(),
  ...options,
});

export const DISPLAY_CURRENCY_CODE = DISPLAY_CURRENCY;

export const getDisplayCadToGhsRate = () => getCadToGhsRate();

export const setDisplayCadToGhsRate = (rate) => {
  const parsedRate = parseCadToGhsRate(rate, activeCadToGhsRate);
  activeCadToGhsRate = parsedRate;
  return parsedRate;
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
