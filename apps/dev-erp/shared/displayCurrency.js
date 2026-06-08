export const DISPLAY_CURRENCY = "GHS";
export const DEFAULT_CAD_TO_GHS_RATE = 1;

export const toFiniteDisplayAmount = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const roundDisplayAmount = (value) => {
  const amount = toFiniteDisplayAmount(value);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const normalizeCurrencyCode = (value, fallback = DISPLAY_CURRENCY) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || fallback;
};

export const parseCadToGhsRate = (value, fallback = DEFAULT_CAD_TO_GHS_RATE) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getCurrencyRateToGhs = (currency, options = {}) => {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  if (normalizedCurrency === "CAD") {
    return parseCadToGhsRate(options.cadToGhsRate);
  }
  return 1;
};

export const convertAmountToGhs = (amount, currency, options = {}) =>
  roundDisplayAmount(toFiniteDisplayAmount(amount) * getCurrencyRateToGhs(currency, options));

export const sumCurrencyAmountsAsGhs = (
  entries = [],
  getAmount = (entry) => entry?.amount,
  getCurrency = (entry) => entry?.currency,
  options = {}
) =>
  roundDisplayAmount(
    (Array.isArray(entries) ? entries : []).reduce(
      (total, entry) => total + convertAmountToGhs(getAmount(entry), getCurrency(entry), options),
      0
    )
  );

export const formatGhsAmount = (amount, options = {}) => {
  const {
    locale = "en-GH",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return `${DISPLAY_CURRENCY} ${toFiniteDisplayAmount(amount).toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
};

export const formatAmountAsGhs = (amount, currency, options = {}) =>
  formatGhsAmount(convertAmountToGhs(amount, currency, options), options);
