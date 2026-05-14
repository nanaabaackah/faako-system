export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./receipts/index.js";
export * from "./types/index.js";

// TODO(shared-payment-service): add app-adapter contracts before any shared payment write behavior.
// TODO(shared-receipt-service): add app-adapter contracts before any shared receipt numbering or persistence.
// TODO(gateway-integrations): add provider-specific contracts for Paystack, Hubtel, and Flutterwave after manual payment contracts are stable.
// TODO(offline-payment-sync): add pending/offline payment contracts only after online idempotency is proven.
// TODO(audit-logging): use createAuditEvent / AUDIT_ACTION_TYPES from @faako/audit to record payment and
//   receipt events without replacing app-owned writers. Wire only after payment idempotency, receipt
//   generation contracts, and data-retention policies are defined per app.
// TODO(org-settings-currency): use getOrganizationCurrency and getOrganizationCurrencySymbol from
//   @faako/org-settings to determine per-organization currency defaults in display helpers. Wire only
//   after an auth-scoped org settings API endpoint exists and per-app currency behavior is reviewed.
// TODO(momo-reconciliation): add reconciliation contracts after provider confirmation behavior is app-reviewed.
// TODO(receipt-automation): add WhatsApp/email receipt automation contracts after delivery audit rules are defined.
