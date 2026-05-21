export const PAYSTACK_ENV_KEYS = Object.freeze({
  SECRET_KEY: "PAYSTACK_SECRET_KEY",
  PUBLIC_KEY: "PAYSTACK_PUBLIC_KEY",
  WEBHOOK_SECRET: "PAYSTACK_WEBHOOK_SECRET",
  CALLBACK_URL: "PAYSTACK_CALLBACK_URL",
  CURRENCY: "PAYSTACK_CURRENCY",
});

export const PAYSTACK_REQUIRED_SERVER_ENV_KEYS = Object.freeze([
  PAYSTACK_ENV_KEYS.SECRET_KEY,
  PAYSTACK_ENV_KEYS.WEBHOOK_SECRET,
  PAYSTACK_ENV_KEYS.CALLBACK_URL,
]);

export const PAYSTACK_DEFAULT_CURRENCY = "GHS";

export const PAYSTACK_REFERENCE_TYPES = Object.freeze({
  INVOICE: "invoice",
  RENT_PAYMENT: "rent_payment",
  MANUAL_PAYMENT: "manual_payment",
});

const normalizeCurrency = (value) => {
  const normalized = String(value || PAYSTACK_DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : PAYSTACK_DEFAULT_CURRENCY;
};

const isConfigured = (env, key) => typeof env?.[key] === "string" && env[key].trim().length > 0;

export const getPaystackConfigStatus = (env = globalThis.process?.env ?? {}) => {
  const missingRequiredKeys = PAYSTACK_REQUIRED_SERVER_ENV_KEYS.filter(
    (key) => !isConfigured(env, key)
  );

  return {
    configured: missingRequiredKeys.length === 0,
    missingRequiredKeys,
    publicKeyConfigured: isConfigured(env, PAYSTACK_ENV_KEYS.PUBLIC_KEY),
    webhookVerificationConfigured: isConfigured(env, PAYSTACK_ENV_KEYS.WEBHOOK_SECRET),
    callbackUrlConfigured: isConfigured(env, PAYSTACK_ENV_KEYS.CALLBACK_URL),
    currency: normalizeCurrency(env?.[PAYSTACK_ENV_KEYS.CURRENCY]),
  };
};

export const PAYSTACK_FOUNDATION_NOTES = Object.freeze({
  behavior:
    "Planning/config foundation only. Do not generate payment links or update invoice/payment records until server verification, webhook handling, and persistence contracts are implemented.",
  security:
    "Keep secret keys server-side, verify webhook signatures, store provider references only, and never store card or mobile-money sensitive details.",
  fallback:
    "Manual payment recording must remain available while Paystack support is introduced incrementally.",
});
