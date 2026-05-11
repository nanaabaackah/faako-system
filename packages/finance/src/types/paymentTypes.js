export const PAYMENT_TYPE_VERSION = "payment.v1";

export const PAYMENT_SOURCE_TYPES = Object.freeze({
  ORDER: "order",
  BOOKING: "booking",
  RENT: "rent",
  INVOICE: "invoice",
  SUBSCRIPTION: "subscription",
  SERVICE: "service",
  MANUAL: "manual",
  OTHER: "other",
});

export const PAYMENT_SHAPE = Object.freeze({
  id: "App-owned payment identifier.",
  organizationId: "Owning organization or tenant identifier.",
  sourceApp: "App that owns the payment, such as reebs-portal or dev-erp.",
  sourceType: "Payment source type, such as order, rent, invoice, or service.",
  sourceId: "App-owned source record identifier.",
  amountMinor: "Payment amount in the smallest currency unit when available.",
  amount: "Payment amount in major units when the app does not use minor units yet.",
  currency: "ISO-like currency code, for example GHS.",
  method: "Normalized payment method from PAYMENT_METHODS.",
  status: "Normalized payment status from PAYMENT_STATUSES.",
  paidAt: "Payment timestamp supplied by the app or provider.",
  recordedAt: "Timestamp when the app recorded the payment.",
  provider: "Payment provider, gateway, bank, or mobile money network.",
  reference: "Raw user-entered or provider-supplied payment reference.",
  normalizedReference: "Normalized reference object defined in transactionTypes.js.",
  metadata: "App-owned payment metadata that shared code must not mutate.",
  audit: "Audit metadata placeholder defined in transactionTypes.js.",
});

export const PAYMENT_REQUIRED_FIELDS = Object.freeze([
  "organizationId",
  "sourceApp",
  "sourceType",
  "sourceId",
  "method",
  "status",
]);

export const PAYMENT_METADATA_PLACEHOLDERS = Object.freeze({
  momoPhoneNumber: "Mobile money phone number when supplied.",
  gateway: "Gateway name such as paystack, hubtel, or flutterwave.",
  gatewayReference: "Gateway transaction or authorization reference.",
  idempotencyKey: "Client or server key used to avoid duplicate payment writes.",
  notes: "Operator notes or reconciliation notes.",
});
