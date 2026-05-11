export const RECEIPT_TYPE_VERSION = "receipt.v1";

export const RECEIPT_DELIVERY_CHANNELS = Object.freeze({
  PRINT: "print",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  DOWNLOAD: "download",
  OFFLINE_PREVIEW: "offline_preview",
});

export const RECEIPT_SHAPE = Object.freeze({
  id: "App-owned receipt identifier.",
  organizationId: "Owning organization or tenant identifier.",
  sourceApp: "App that owns the receipt, such as reebs-portal or dev-erp.",
  sourceType: "Receipt source type, such as order payment, rent payment, or invoice.",
  sourceId: "App-owned source record identifier.",
  paymentId: "Related app-owned payment identifier when one exists.",
  receiptNumber: "Server-confirmed receipt number. Never renumber historical receipts.",
  status: "Normalized receipt status from RECEIPT_STATUSES.",
  issuedAt: "Timestamp when the server generated the official receipt.",
  snapshot: "Immutable receipt snapshot created by the app-owned receipt adapter.",
  delivery: "Delivery metadata for print, WhatsApp, email, download, or offline preview.",
  audit: "Audit metadata placeholder defined in transactionTypes.js.",
});

export const RECEIPT_REQUIRED_FIELDS = Object.freeze([
  "organizationId",
  "sourceApp",
  "sourceType",
  "sourceId",
  "receiptNumber",
  "status",
]);

export const RECEIPT_SNAPSHOT_PLACEHOLDERS = Object.freeze({
  payer: "Customer, tenant, client, or organization snapshot.",
  lineItems: "Receipt line item snapshot.",
  totals: "Total, paid, balance, tax, discount, and currency snapshot.",
  payment: "Payment method, reference, provider, and paid timestamp snapshot.",
  source: "Order, rent, invoice, subscription, or service source snapshot.",
});
