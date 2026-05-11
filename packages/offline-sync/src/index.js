export * from "./components/index.js";
export * from "./constants/index.js";
export * from "./hooks/index.js";
export * from "./retry/retryMetadata.js";
export * from "./status/index.js";
export * from "./storage/index.js";
export * from "./types/index.js";

// TODO(shared-payment-service): connect payment queue actions only after backend permission rechecks exist.
// TODO(shared-receipt-engine): keep official receipt numbers server-confirmed; offline previews are not final receipts.
// TODO(shared-invoice-engine): add invoice draft queues only after app-specific validation contracts exist.
// TODO(offline-safe-finance-queue): add production sync only after idempotency, conflict handling, and audit logs are proven.
// TODO(payment-gateway-integrations): never trust offline gateway state without provider/webhook reconciliation.
// TODO(audit-logging): record actor, organization, source record, retries, conflicts, and server validation outcomes during future sync.
