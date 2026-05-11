export const toFiniteAmount = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const majorToCents = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallback;
};

export const centsToMajor = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : fallback;
};

export const formatMajorAmountNumber = (value, options = {}) => {
  const {
    locale = "en-US",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return toFiniteAmount(value).toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

export const formatCurrencyMajor = (value, currency = "GHS", options = {}) => {
  const {
    locale = "en-GH",
    display = "symbol",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;
  const normalizedCurrency = String(currency || "GHS").trim().toUpperCase() || "GHS";
  const amount = toFiniteAmount(value);

  if (display === "code") {
    return `${normalizedCurrency} ${formatMajorAmountNumber(amount, {
      locale,
      minimumFractionDigits,
      maximumFractionDigits,
    })}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(maximumFractionDigits)}`;
  }
};

export const formatCurrencyFromCents = (value, currency = "GHS", options = {}) =>
  formatCurrencyMajor(centsToMajor(value), currency, options);
