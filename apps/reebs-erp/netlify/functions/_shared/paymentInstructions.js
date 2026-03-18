/* eslint-disable no-undef */
const PAYMENT_METHODS = new Set(["card", "momo", "bank"]);

const MOMO_PROVIDER_LABELS = {
  "mtn-momo": "MTN MoMo",
  "telecel-cash": "Telecel Cash",
  "airteltigo-money": "AirtelTigo Money",
  "g-money": "G-Money",
};

const MOMO_PROVIDER_NUMBER_KEYS = {
  "mtn-momo": "EMAIL_PAYMENT_MOMO_MTN_NUMBER",
  "telecel-cash": "EMAIL_PAYMENT_MOMO_TELECEL_NUMBER",
  "airteltigo-money": "EMAIL_PAYMENT_MOMO_AIRTELTIGO_NUMBER",
  "g-money": "EMAIL_PAYMENT_MOMO_GMONEY_NUMBER",
};

const MOMO_PROVIDER_ALIASES = {
  mtn: "mtn-momo",
  "mtn-momo": "mtn-momo",
  vodafone: "telecel-cash",
  telecash: "telecel-cash",
  telecel: "telecel-cash",
  "telecel-cash": "telecel-cash",
  airteltigo: "airteltigo-money",
  "airtel-tigo": "airteltigo-money",
  "airteltigo-money": "airteltigo-money",
  gmoney: "g-money",
  "g-money": "g-money",
};

const readEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
};

const readMultilineEnv = (key) => {
  const value = readEnv(key);
  return value ? value.replace(/\\n/g, "\n") : "";
};

const getMomoProviderInstructionLines = (momoProvider) => {
  const providerLabel = MOMO_PROVIDER_LABELS[momoProvider] || "Mobile money";
  const accountName = readEnv("EMAIL_PAYMENT_MOMO_ACCOUNT_NAME");
  const providerNumberKey = MOMO_PROVIDER_NUMBER_KEYS[momoProvider];
  const providerNumber = providerNumberKey ? readEnv(providerNumberKey) : "";
  const lines = [];

  if (accountName) {
    lines.push(`Account name: ${accountName}`);
  }
  if (providerNumber) {
    lines.push(`Company ${providerLabel} number: ${providerNumber}`);
  }

  return lines;
};

export const sanitizePaymentPreference = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { method: "card", momoProvider: "" };
  }

  const method = PAYMENT_METHODS.has(String(value.method || "").trim())
    ? String(value.method).trim()
    : "card";
  const rawProvider = String(value.momoProvider || "").trim().toLowerCase();
  const momoProvider = MOMO_PROVIDER_ALIASES[rawProvider] || "";

  return {
    method,
    momoProvider: method === "momo" && MOMO_PROVIDER_LABELS[momoProvider] ? momoProvider : "",
  };
};

export const getPaymentMethodLabel = (paymentPreference) => {
  const { method, momoProvider } = sanitizePaymentPreference(paymentPreference);
  if (method === "momo") {
    return momoProvider && MOMO_PROVIDER_LABELS[momoProvider]
      ? `Mobile money (${MOMO_PROVIDER_LABELS[momoProvider]})`
      : "Mobile money";
  }
  if (method === "bank") return "Bank transfer";
  return "Card";
};

export const buildPaymentInstructionLines = ({
  paymentPreference,
  reference = "",
  internal = false,
}) => {
  const safePreference = sanitizePaymentPreference(paymentPreference);
  const lines = [`Preferred payment route: ${getPaymentMethodLabel(safePreference)}`];

  if (safePreference.method === "card") {
    lines.push(
      internal
        ? "Send the customer a secure card payment link or invoice."
        : "We will send you a secure card payment link separately. Do not send card numbers by email, SMS, or chat."
    );
    return lines;
  }

  if (safePreference.method === "momo" && safePreference.momoProvider) {
    lines.push(`Selected mobile money type: ${MOMO_PROVIDER_LABELS[safePreference.momoProvider]}`);
  }

  const detailKey =
    safePreference.method === "momo" ? "EMAIL_PAYMENT_MOMO_DETAILS" : "EMAIL_PAYMENT_BANK_DETAILS";
  const detailTitle =
    safePreference.method === "momo" ? "Mobile money details:" : "Bank transfer details:";
  const momoProviderDetails =
    safePreference.method === "momo"
      ? getMomoProviderInstructionLines(safePreference.momoProvider)
      : [];
  const configuredDetails = readMultilineEnv(detailKey);

  if (momoProviderDetails.length || configuredDetails) {
    lines.push("", detailTitle);
    if (momoProviderDetails.length) {
      lines.push(...momoProviderDetails);
    }
    if (configuredDetails) {
      lines.push(...configuredDetails.split(/\r?\n/).filter(Boolean));
    }
    if (reference) {
      lines.push(`Reference: ${reference}`);
    }
    if (!internal) {
      lines.push("Please use the reference above when you make payment.");
    }
    return lines;
  }

  lines.push(
    "",
    internal
      ? `Payment details are not configured for ${safePreference.method === "momo" ? "mobile money" : "bank transfer"} yet.`
      : `We will send your ${safePreference.method === "momo" ? "mobile money" : "bank transfer"} payment details separately.`
  );
  return lines;
};
