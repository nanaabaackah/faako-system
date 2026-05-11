import { normalizePaymentMethod } from "./normalization.js";

export const normalizeReference = (value) => {
  const rawReference = String(value ?? "").trim();
  return {
    rawReference,
    normalizedReference: rawReference.replace(/\s+/g, "").toUpperCase(),
  };
};

export const normalizeTransactionMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  const reference = normalizeReference(source.reference || source.rawReference || source.gatewayReference);

  return {
    idempotencyKey: String(source.idempotencyKey || "").trim(),
    sourceApp: String(source.sourceApp || "").trim(),
    sourceType: String(source.sourceType || "").trim(),
    sourceId: source.sourceId ?? "",
    method: normalizePaymentMethod(source.method),
    provider: String(source.provider || source.gateway || "").trim(),
    rawReference: reference.rawReference,
    normalizedReference: reference.normalizedReference,
    gateway: String(source.gateway || "").trim(),
    gatewayReference: String(source.gatewayReference || "").trim(),
    webhookEventId: String(source.webhookEventId || "").trim(),
    offlineSyncId: String(source.offlineSyncId || "").trim(),
    reconciliationId: String(source.reconciliationId || "").trim(),
  };
};

export const normalizePaymentMetadata = (metadata = {}) => {
  const normalized = normalizeTransactionMetadata(metadata);
  return {
    ...normalized,
    phoneNumber: String(metadata?.phoneNumber || metadata?.momoPhoneNumber || "").trim(),
    notes: String(metadata?.notes || "").trim(),
  };
};

export const normalizeReceiptMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  return {
    sourceApp: String(source.sourceApp || "").trim(),
    sourceType: String(source.sourceType || "").trim(),
    sourceId: source.sourceId ?? "",
    paymentId: source.paymentId ?? "",
    deliveryChannel: String(source.deliveryChannel || "").trim(),
    deliveryTarget: String(source.deliveryTarget || "").trim(),
    offlineSyncId: String(source.offlineSyncId || "").trim(),
  };
};
