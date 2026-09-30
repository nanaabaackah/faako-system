const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;

export const parseDecimal = (value) => {
  const match = String(value).trim().match(DECIMAL_PATTERN);
  if (!match) throw new TypeError("Rate must be a decimal string.");
  const fraction = match[3] || "";
  const denominator = 10n ** BigInt(fraction.length);
  const unsigned = BigInt(`${match[2]}${fraction}`);
  const numerator = match[1] === "-" ? -unsigned : unsigned;
  if (numerator <= 0n) throw new RangeError("Rate must be greater than zero.");
  return { numerator, denominator };
};

export const convertMinorUnits = (amountMinor, decimalRate) => {
  const amount = BigInt(amountMinor);
  if (amount < 0n) throw new RangeError("Amount must not be negative.");
  const { numerator, denominator } = parseDecimal(decimalRate);
  const scaled = amount * numerator;
  return (scaled + denominator / 2n) / denominator;
};

export const formatMinorUnits = (amountMinor, currency = "GHS", locale = "en-GH") => {
  const amount = BigInt(amountMinor);
  const whole = amount / 100n;
  const fraction = String(amount % 100n).padStart(2, "0");
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole);
  return `${currency} ${grouped}.${fraction}`;
};
