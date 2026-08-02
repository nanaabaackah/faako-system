export const toMoneyInputValue = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return (amount / 100).toFixed(2);
};

export const parseMoneyInputValue = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
};

export const buildRetailPriceUpdatePayload = (value) => {
  const cents = parseMoneyInputValue(value);
  if (!cents) return null;

  return {
    cents,
    retailSingle: toMoneyInputValue(cents),
  };
};
