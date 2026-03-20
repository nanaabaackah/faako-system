/* eslint-disable no-undef */
const PAYMENT_METHODS = new Set(["card", "momo", "bank", "cash", "pay-later"]);
const RECEIPT_CHANNELS = new Set(["email", "whatsapp", "none"]);
const DEFAULT_REMINDER_INTERVAL_DAYS = 14;

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

const normalizeInlineText = (value, maxLength = 120) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";

const normalizeIsoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const normalizeReminderCount = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizeReminderInterval = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REMINDER_INTERVAL_DAYS;
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
    return {
      method: "card",
      momoProvider: "",
      cashReceived: null,
      changeDue: null,
      recordedInStore: false,
      createdInStore: false,
      payLater: false,
      momoReference: "",
      receiptChannel: "",
      receiptContact: "",
      reminderIntervalDays: DEFAULT_REMINDER_INTERVAL_DAYS,
      reminderNextAt: "",
      reminderLastSentAt: "",
      reminderCount: 0,
    };
  }

  const rawMethod = String(value.method || "").trim();
  const payLater = Boolean(value.payLater) || rawMethod === "pay-later";
  const method = PAYMENT_METHODS.has(rawMethod)
    ? rawMethod
    : payLater
      ? "pay-later"
    : "card";
  const rawProvider = String(value.momoProvider || "").trim().toLowerCase();
  const momoProvider = MOMO_PROVIDER_ALIASES[rawProvider] || "";
  const cashReceived = Number(value.cashReceived);
  const changeDue = Number(value.changeDue);
  const recordedInStore = Boolean(value.recordedInStore);
  const createdInStore = Boolean(value.createdInStore);
  const receiptChannel = RECEIPT_CHANNELS.has(String(value.receiptChannel || "").trim().toLowerCase())
    ? String(value.receiptChannel).trim().toLowerCase()
    : "";
  const receiptContact = normalizeInlineText(value.receiptContact, 160);
  const momoReference = normalizeInlineText(value.momoReference, 80);

  return {
    method,
    momoProvider: method === "momo" && MOMO_PROVIDER_LABELS[momoProvider] ? momoProvider : "",
    cashReceived:
      method === "cash" && Number.isFinite(cashReceived) && cashReceived >= 0 ? cashReceived : null,
    changeDue:
      method === "cash" && Number.isFinite(changeDue) ? Math.max(0, changeDue) : null,
    recordedInStore,
    createdInStore,
    payLater,
    momoReference: method === "momo" ? momoReference : "",
    receiptChannel,
    receiptContact:
      receiptChannel && receiptChannel !== "none" ? receiptContact : "",
    reminderIntervalDays: normalizeReminderInterval(value.reminderIntervalDays),
    reminderNextAt: normalizeIsoDate(value.reminderNextAt),
    reminderLastSentAt: normalizeIsoDate(value.reminderLastSentAt),
    reminderCount: normalizeReminderCount(value.reminderCount),
  };
};

export const getReceiptChannelLabel = (paymentPreference) => {
  const { receiptChannel } = sanitizePaymentPreference(paymentPreference);
  if (receiptChannel === "email") return "Email";
  if (receiptChannel === "whatsapp") return "WhatsApp";
  if (receiptChannel === "none") return "No receipt";
  return "";
};

export const getPaymentMethodLabel = (paymentPreference) => {
  const { method, momoProvider } = sanitizePaymentPreference(paymentPreference);
  if (method === "pay-later") return "Pay later";
  if (method === "cash") return "Cash";
  if (method === "momo") {
    return momoProvider && MOMO_PROVIDER_LABELS[momoProvider]
      ? `Mobile money (${MOMO_PROVIDER_LABELS[momoProvider]})`
      : "Mobile money";
  }
  if (method === "bank") return "Bank transfer";
  return "Card";
};

const appendConfiguredPaymentOptionSections = (lines, reference = "") => {
  const momoDetails = readMultilineEnv("EMAIL_PAYMENT_MOMO_DETAILS");
  const bankDetails = readMultilineEnv("EMAIL_PAYMENT_BANK_DETAILS");

  lines.push("", "Payment options:");

  const momoSections = Object.keys(MOMO_PROVIDER_LABELS)
    .map((providerKey) => {
      const providerLines = getMomoProviderInstructionLines(providerKey);
      if (!providerLines.length && !momoDetails) return [];
      return [
        `${MOMO_PROVIDER_LABELS[providerKey]}:`,
        ...providerLines,
        ...(momoDetails ? momoDetails.split(/\r?\n/).filter(Boolean) : []),
        ...(reference ? [`Reference: ${reference}`] : []),
      ];
    })
    .filter((section) => section.length);

  if (momoSections.length) {
    momoSections.forEach((section, index) => {
      if (index > 0) lines.push("");
      lines.push(...section);
    });
  }

  if (bankDetails) {
    if (momoSections.length) lines.push("");
    lines.push(
      "Bank transfer:",
      ...bankDetails.split(/\r?\n/).filter(Boolean),
      ...(reference ? [`Reference: ${reference}`] : [])
    );
  }

  lines.push(
    "",
    "Card payment:",
    "Reply to this email if you prefer a secure card payment link."
  );

  if (reference) {
    lines.push("", "Please use the reference above when you make payment.");
  }
};

export const buildPaymentInstructionLines = ({
  paymentPreference,
  reference = "",
  internal = false,
}) => {
  const safePreference = sanitizePaymentPreference(paymentPreference);
  const lines = [`Preferred payment route: ${getPaymentMethodLabel(safePreference)}`];

  if (safePreference.payLater || safePreference.method === "pay-later") {
    lines.push(
      "",
      internal
        ? "Payment is still outstanding. Follow up with the customer using the options below."
        : "Payment is still outstanding. You can settle it using any of the options below."
    );
    appendConfiguredPaymentOptionSections(lines, reference);
    return lines;
  }

  if (safePreference.recordedInStore) {
    lines.push(
      "",
      internal ? "Payment was collected in store." : "This order was paid in store."
    );
    if (safePreference.method === "momo" && safePreference.momoReference) {
      lines.push(`MoMo reference: ${safePreference.momoReference}`);
    }
    if (internal && Number.isFinite(safePreference.cashReceived)) {
      lines.push(`Cash received: GHS ${safePreference.cashReceived.toFixed(2)}`);
    }
    if (internal && Number.isFinite(safePreference.changeDue)) {
      lines.push(`Change given: GHS ${safePreference.changeDue.toFixed(2)}`);
    }
    if (internal && safePreference.receiptChannel) {
      if (safePreference.receiptChannel === "none") {
        lines.push("Customer receipt: Not requested");
      } else {
        const receiptLabel = getReceiptChannelLabel(safePreference);
        const receiptTarget = safePreference.receiptContact
          ? `: ${safePreference.receiptContact}`
          : "";
        lines.push(`Customer receipt: ${receiptLabel}${receiptTarget}`);
      }
    }
    return lines;
  }

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
