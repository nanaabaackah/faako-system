import { AUDIT_ACTION_LABELS } from "../constants/actionTypes.js";
import { AUDIT_ENTITY_LABELS } from "../constants/entityTypes.js";
import { AUDIT_SEVERITY_LABELS } from "../constants/severities.js";
import { AUDIT_SOURCE_LABELS } from "../constants/sources.js";
import { AUDIT_STATUS_LABELS } from "../constants/statuses.js";

/** Returns a human-readable label for an audit action type. */
export const getAuditActionLabel = (action) =>
  AUDIT_ACTION_LABELS[action] || action || "Unknown action";

/** Returns a human-readable label for an audit entity type. */
export const getAuditEntityLabel = (entityType) =>
  AUDIT_ENTITY_LABELS[entityType] || entityType || "Unknown entity";

/** Returns a human-readable label for an audit severity. */
export const getAuditSeverityLabel = (severity) =>
  AUDIT_SEVERITY_LABELS[severity] || severity || "Unknown severity";

/** Returns a human-readable label for an audit source. */
export const getAuditSourceLabel = (source) =>
  AUDIT_SOURCE_LABELS[source] || source || "Unknown source";

/** Returns a human-readable label for an audit status. */
export const getAuditStatusLabel = (status) =>
  AUDIT_STATUS_LABELS[status] || status || "Unknown status";

/**
 * Returns a short, display-safe summary of an audit event for UI presentation.
 * Intentionally omits actor IDs, entity IDs, org IDs, and raw metadata.
 *
 * @param {object} [event]
 * @returns {string}
 */
export const formatAuditEventSummary = (event = {}) => {
  const action = getAuditActionLabel(event.action);
  const entity = event.entityType ? getAuditEntityLabel(event.entityType) : undefined;
  const status = getAuditStatusLabel(event.status);
  const source = getAuditSourceLabel(event.source);
  return [action, entity ? `(${entity})` : undefined, `— ${status}`, `via ${source}`]
    .filter(Boolean)
    .join(" ");
};

/**
 * Returns a display-safe actor label for UI presentation.
 * Falls back gracefully when the actor reference is missing or incomplete.
 *
 * @param {object} [actor]
 * @returns {string}
 */
export const formatAuditActor = (actor = {}) => {
  if (!actor || typeof actor !== "object") return "Unknown actor";
  if (actor.label) return String(actor.label);
  if (actor.role) return `${actor.role} user`;
  return "System";
};

/**
 * Returns a locale-formatted timestamp string for an audit event.
 * Accepts an ISO 8601 string or a Date object.
 * Falls back to the raw timestamp value if parsing fails.
 *
 * @param {string | Date} [timestamp]
 * @returns {string}
 */
export const formatAuditTimestamp = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString();
  } catch {
    return String(timestamp);
  }
};
