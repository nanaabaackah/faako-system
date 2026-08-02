/**
 * @faako/audit — shared type definitions (JSDoc only, no runtime behavior)
 *
 * These types describe the shared audit event shape used by helpers and
 * intended to inform future backend audit log contracts. No TypeScript compilation
 * is required — consumers use JSDoc annotations for editor support.
 */

/**
 * A safe reference to the actor who performed an action.
 * Never include passwords, tokens, or secrets.
 *
 * @typedef {Object} AuditActor
 * @property {string} [id] - Internal user/staff ID (safe to log)
 * @property {string} [role] - User role label (e.g. "admin", "staff")
 * @property {string} [label] - Display name or redacted email for UI presentation
 * @property {string} [sourceApp] - Which app the actor was using (e.g. "dev-erp", "reebs-portal")
 */

/**
 * A safe reference to the organization context of an action.
 *
 * @typedef {Object} AuditOrganization
 * @property {string} [id] - Organization ID
 * @property {string} [label] - Organization display name
 */

/**
 * A normalized audit event record.
 *
 * This shape is used by shared helpers and is designed to inform future
 * backend audit log persistence contracts. The record itself is a plain
 * object — it does not emit, store, or transmit anything on its own.
 *
 * Rules:
 * - Never include passwords, tokens, or secrets in any field.
 * - Keep entityId as a string reference only — not a database join key.
 * - Keep metadata safe: use stripSensitiveMetadata before storing.
 * - status reflects the outcome of the action, not the app's local UI state.
 *
 * @typedef {Object} AuditEvent
 * @property {"audit"} kind - Separates audit events from diagnostic log records
 * @property {string} [id] - Optional persisted event identifier
 * @property {string} [application] - Stable application identifier
 * @property {string} eventName - Stable dotted event name
 * @property {string} action - From AUDIT_ACTION_TYPES
 * @property {string} entityType - From AUDIT_ENTITY_TYPES
 * @property {string} [entityId] - The affected entity's identifier (string only)
 * @property {AuditActor} [actor] - Safe reference to who performed the action
 * @property {AuditOrganization} [org] - Organization context
 * @property {string} source - From AUDIT_SOURCES (online | offline_sync | system)
 * @property {string} status - From AUDIT_STATUSES (success | failed | pending | conflict)
 * @property {string} severity - From AUDIT_SEVERITIES (info | warning | error | critical)
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} occurredAt - Canonical ISO 8601 occurrence time
 * @property {string} [requestId] - Transport request ID for correlation
 * @property {Record<string, unknown>} [metadata] - Safe additional context only
 */

export {};
