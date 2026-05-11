export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  MOBILE_MONEY: "mobile_money",
  MTN_MOMO: "mtn_momo",
  TELECEL_CASH: "telecel_cash",
  AIRTELTIGO_MONEY: "airteltigo_money",
  BANK_TRANSFER: "bank_transfer",
  CARD: "card",
  OTHER: "other",
});

export const PAYMENT_METHOD_LABELS = Object.freeze({
  [PAYMENT_METHODS.CASH]: "Cash",
  [PAYMENT_METHODS.MOBILE_MONEY]: "Mobile Money",
  [PAYMENT_METHODS.MTN_MOMO]: "MTN MoMo",
  [PAYMENT_METHODS.TELECEL_CASH]: "Telecel Cash",
  [PAYMENT_METHODS.AIRTELTIGO_MONEY]: "AirtelTigo Money",
  [PAYMENT_METHODS.BANK_TRANSFER]: "Bank Transfer",
  [PAYMENT_METHODS.CARD]: "Card",
  [PAYMENT_METHODS.OTHER]: "Other",
});

export const MOBILE_MONEY_PAYMENT_METHODS = Object.freeze([
  PAYMENT_METHODS.MOBILE_MONEY,
  PAYMENT_METHODS.MTN_MOMO,
  PAYMENT_METHODS.TELECEL_CASH,
  PAYMENT_METHODS.AIRTELTIGO_MONEY,
]);
