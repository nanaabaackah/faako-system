export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./receipts/index.js";
export * from "./types/index.js";

// TODO(shared-payment-service): add app-adapter contracts before any shared payment write behavior.
// TODO(shared-receipt-service): add app-adapter contracts before any shared receipt numbering or persistence.
// TODO(gateway-integrations): add provider-specific contracts for Paystack, Hubtel, and Flutterwave after manual payment contracts are stable.
// TODO(offline-payment-sync): add pending/offline payment contracts only after online idempotency is proven.
// TODO(audit-logging): connect shared audit event contracts without replacing app-owned audit writers.
// TODO(momo-reconciliation): add reconciliation contracts after provider confirmation behavior is app-reviewed.
// TODO(receipt-automation): add WhatsApp/email receipt automation contracts after delivery audit rules are defined.
