export const DEFAULT_CURRENCY = "GHS";

export const SUPPORTED_CURRENCIES = Object.freeze([
  { code: "GHS", symbol: "₵",   name: "Ghanaian Cedi" },
  { code: "USD", symbol: "$",   name: "US Dollar" },
  { code: "EUR", symbol: "€",   name: "Euro" },
  { code: "GBP", symbol: "£",   name: "British Pound" },
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R",   name: "South African Rand" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc" },
]);

export const CURRENCY_CODES = Object.freeze(SUPPORTED_CURRENCIES.map((c) => c.code));
