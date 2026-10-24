export const PAYSTACK_ENV_KEYS = Object.freeze({
  ENABLED: "PAYSTACK_PAYMENTS_ENABLED",
  MODE: "PAYSTACK_MODE",
  SECRET_KEY: "PAYSTACK_SECRET_KEY",
  CALLBACK_URL: "PAYSTACK_CALLBACK_URL",
  CURRENCY: "PAYSTACK_CURRENCY",
});

export const PAYSTACK_REQUIRED_SERVER_ENV_KEYS = Object.freeze([
  PAYSTACK_ENV_KEYS.SECRET_KEY,
  PAYSTACK_ENV_KEYS.CALLBACK_URL,
]);

export const PAYSTACK_DEFAULT_CURRENCY = "GHS";

export const PAYSTACK_REFERENCE_TYPES = Object.freeze({
  INVOICE: "invoice",
  STANDALONE: "standalone",
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
    enabled: String(env?.[PAYSTACK_ENV_KEYS.ENABLED] || "").toLowerCase() === "true",
    mode: String(env?.[PAYSTACK_ENV_KEYS.MODE] || "test").toLowerCase() === "live" ? "live" : "test",
    webhookVerificationConfigured: isConfigured(env, PAYSTACK_ENV_KEYS.SECRET_KEY),
    callbackUrlConfigured: isConfigured(env, PAYSTACK_ENV_KEYS.CALLBACK_URL),
    currency: normalizeCurrency(env?.[PAYSTACK_ENV_KEYS.CURRENCY]),
  };
};

export const PAYSTACK_FOUNDATION_NOTES = Object.freeze({
  behavior:
    "Hosted checkout is disabled by default. Enable only after migrations, test-mode webhooks, and reconciliation checks pass.",
  security:
    "Keep secret keys server-side, verify webhook signatures, store provider references only, and never store card or mobile-money sensitive details.",
  fallback:
    "Manual payment recording must remain available while Paystack support is introduced incrementally.",
});
