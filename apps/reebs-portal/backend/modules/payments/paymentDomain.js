export const PAYMENT_BUSINESS_UNITS = Object.freeze({
  CORE: "REEBS_CORE",
  WATER: "WATER",
});

export const PAYMENT_SOURCES = Object.freeze({
  MANUAL: "MANUAL",
  ONLINE_PROVIDER: "ONLINE_PROVIDER",
});

export const PAYMENT_VERIFICATION_STATES = Object.freeze({
  MANUAL_RECORDED: "MANUAL_RECORDED",
  PROVIDER_VERIFIED: "PROVIDER_VERIFIED",
  NOT_VERIFIED: "NOT_VERIFIED",
});

const PAYMENT_METHODS = new Map([
  ["cash", "Cash"],
  ["momo", "Mobile Money"],
  ["mobile_money", "Mobile Money"],
  ["mobilemoney", "Mobile Money"],
  ["bank", "Bank Transfer"],
  ["bank_transfer", "Bank Transfer"],
  ["transfer", "Bank Transfer"],
  ["card", "Card"],
  ["credit_card", "Card"],
  ["debit_card", "Card"],
  ["other", "Other"],
]);

export const cleanPaymentText = (value, max = 160) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const normalizePaymentMethod = (value) => {
  const key = cleanPaymentText(value, 80)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return PAYMENT_METHODS.get(key) || "Other";
};

export const normalizeExternalReference = (value) =>
  cleanPaymentText(value, 160).replace(/\s+/g, " ") || null;

export const normalizePaymentAmountCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
};

export const deriveOrderPaymentContext = (order = {}) => ({
  businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
  currency: cleanPaymentText(order.currency, 3).toUpperCase() || "GHS",
  customerId: Number(order.customerId) || null,
  payableType: "ORDER",
  payableId: Number(order.id) || null,
  payableReference: cleanPaymentText(order.orderNumber, 120),
});

export const getPaymentReference = (payment = {}) =>
  cleanPaymentText(payment.paymentReference, 120) ||
  (Number(payment.id) > 0 ? `REEBS-PAY-${String(payment.id).padStart(6, "0")}` : "");

export const getPaymentSource = (payment = {}) => {
  const confirmation = cleanPaymentText(payment.confirmationStatus, 80).toLowerCase();
  return confirmation === "provider_verified"
    ? PAYMENT_SOURCES.ONLINE_PROVIDER
    : PAYMENT_SOURCES.MANUAL;
};

export const getPaymentVerificationState = (payment = {}) => {
  const confirmation = cleanPaymentText(payment.confirmationStatus, 80).toLowerCase();
  if (confirmation === "provider_verified") {
    return PAYMENT_VERIFICATION_STATES.PROVIDER_VERIFIED;
  }
  if (confirmation === "manual_recorded") {
    return PAYMENT_VERIFICATION_STATES.MANUAL_RECORDED;
  }
  return PAYMENT_VERIFICATION_STATES.NOT_VERIFIED;
};

export const toPaymentAdminDto = (payment = {}) => {
  const context = deriveOrderPaymentContext({
    id: payment.orderId,
    orderNumber: payment.orderNumber,
    customerId: payment.customerId,
    currency: payment.currency,
  });
  return {
    id: payment.id,
    paymentReference: getPaymentReference(payment),
    amountCents: Number(payment.amountCents || 0),
    currency: context.currency,
    method: normalizePaymentMethod(payment.method),
    provider: cleanPaymentText(payment.provider, 120) || null,
    providerReference: normalizeExternalReference(
      payment.providerReference || payment.transactionReference
    ),
    verificationStatus: getPaymentVerificationState(payment),
    source: getPaymentSource(payment),
    status: cleanPaymentText(payment.status, 80).toLowerCase() || "successful",
    paidAt: payment.paidAt || null,
    createdAt: payment.createdAt || null,
    recordedByUserId: payment.recordedByUserId || null,
    notes: cleanPaymentText(payment.notes, 500) || null,
    customer: {
      id: context.customerId,
      name: cleanPaymentText(payment.customerName, 180) || null,
      phone: cleanPaymentText(payment.customerPhone, 80) || null,
    },
    relatedRecord: {
      type: context.payableType,
      id: context.payableId,
      reference: context.payableReference || null,
    },
    businessUnit: context.businessUnit,
  };
};

export const toUniversalPaymentAdminDto = (payment = {}) => ({
  id: payment.rowKey || `payment:${payment.id}`,
  paymentReference: cleanPaymentText(payment.paymentReference || payment.reference, 160),
  amountCents: Number(payment.amountCents || 0),
  currency: cleanPaymentText(payment.currency, 3).toUpperCase() || "GHS",
  method: normalizePaymentMethod(payment.method),
  provider: cleanPaymentText(payment.provider, 120) || null,
  providerReference: normalizeExternalReference(payment.providerReference),
  verificationStatus: cleanPaymentText(payment.verificationStatus, 80) || PAYMENT_VERIFICATION_STATES.NOT_VERIFIED,
  source: cleanPaymentText(payment.source, 80) || PAYMENT_SOURCES.MANUAL,
  status: cleanPaymentText(payment.status, 80).toLowerCase() || "paid",
  paidAt: payment.paidAt || null,
  createdAt: payment.createdAt || null,
  recordedByUserId: payment.recordedByUserId || null,
  notes: cleanPaymentText(payment.notes, 500) || null,
  customer: {
    id: Number(payment.customerId) || null,
    name: cleanPaymentText(payment.customerName, 180) || null,
    phone: cleanPaymentText(payment.customerPhone, 80) || null,
  },
  relatedRecord: {
    type: cleanPaymentText(payment.payableType, 40).toUpperCase() || null,
    id: Number(payment.payableId) || null,
    reference: cleanPaymentText(payment.payableReference, 160) || null,
  },
  businessUnit: PAYMENT_BUSINESS_UNITS.CORE,
});

export const assertManualPaymentInput = ({ amountCents, method } = {}) => {
  const normalizedAmount = normalizePaymentAmountCents(amountCents);
  if (normalizedAmount <= 0) {
    const error = new Error("Payment amount must be greater than zero.");
    error.statusCode = 400;
    error.code = "INVALID_PAYMENT_AMOUNT";
    throw error;
  }
  return {
    amountCents: normalizedAmount,
    method: normalizePaymentMethod(method),
  };
};
