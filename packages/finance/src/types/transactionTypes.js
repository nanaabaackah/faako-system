export const TRANSACTION_METADATA_VERSION = "transaction-metadata.v1";

export const NORMALIZED_REFERENCE_SHAPE = Object.freeze({
  rawReference: "Original user-entered or provider-supplied reference.",
  normalizedReference: "Trimmed, case-normalized reference for matching and reconciliation.",
  provider: "Payment provider, gateway, bank, or mobile money network.",
  method: "Normalized payment method from PAYMENT_METHODS.",
  sourceApp: "App that owns the transaction.",
  sourceType: "Transaction source type.",
  gatewayTransactionId: "Gateway transaction id when one exists.",
});

export const AUDIT_METADATA_SHAPE = Object.freeze({
  actorId: "Authenticated user or system actor identifier.",
  actorRole: "Actor role or capability label at the time of action.",
  organizationId: "Owning organization or tenant identifier.",
  requestId: "Request id, trace id, or function invocation id.",
  ipAddress: "Request IP address when available.",
  userAgent: "Request user agent when available.",
  reason: "Operator-supplied or system-generated audit reason.",
});

export const TRANSACTION_METADATA_SHAPE = Object.freeze({
  idempotencyKey: "Client or server idempotency key for write safety.",
  sourceApp: "App that owns the transaction.",
  sourceType: "Order, booking, rent, invoice, subscription, service, or manual.",
  sourceId: "App-owned source record identifier.",
  paymentReference: "Normalized payment reference object.",
  gateway: "Gateway name for future Paystack, Hubtel, or Flutterwave integrations.",
  gatewayReference: "Gateway transaction reference.",
  webhookEventId: "Gateway webhook event id for replay protection.",
  offlineSyncId: "Offline sync queue identifier for future offline payments.",
  reconciliationId: "Identifier for future reconciliation batches.",
  audit: "Audit metadata placeholder.",
});
