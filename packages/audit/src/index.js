export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./types/index.js";

// TODO(audit-backend-writer): design append-only server-side audit log writer after
//   database schema review and data-retention policy are defined. Keep the writer
//   separate from this package so frontend helpers remain safe to import.

// TODO(audit-activity-feed): build admin activity feed view after per-app audit event
//   contracts are stabilized and a safe read-only API endpoint is proven.

// TODO(audit-export): add exportable audit log format (CSV/JSON) after retention window,
//   PII redaction rules, and data-sensitivity classifications are documented.

// TODO(audit-dashboard): build operational audit dashboard after event ingestion,
//   retention, and per-organization access controls are proven.

// TODO(anomaly-detection): add threshold-based anomaly helpers after normal operational
//   baselines are measured and false-positive rates are reviewed.

// TODO(ai-operational-insights): connect operational audit patterns to AI analysis only
//   after data retention, consent, privacy rules, and customer data exclusions exist.

// TODO(audit-backend-reebs): wire createSyncAuditEvent into REEBS sync handlers after
//   offline POS order, payment, inventory, and booking sync paths are stable.

// TODO(audit-backend-dev-erp): wire createSyncAuditEvent into Dev ERP sync handlers
//   after rent payment queue behavior is proven and needs-review flows are reviewed.

// TODO(auth-audit-events): add LOGIN_SUCCESS / LOGIN_FAILURE events from auth middleware
//   after server-side audit writers and log retention are designed.

// TODO(inventory-audit-events): add INVENTORY_ADJUSTED events after stock mutation
//   idempotency and audit-safe metadata redaction are verified per app.

// TODO(payment-audit-events): add PAYMENT_RECORDED events only after payment persistence,
//   receipt generation, and audit-safe metadata are reviewed per app.
