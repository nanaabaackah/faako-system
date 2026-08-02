import { AUDIT_SEVERITIES } from "../constants/severities.js";
import { AUDIT_SOURCES } from "../constants/sources.js";
import { AUDIT_STATUSES } from "../constants/statuses.js";
import { AUDIT_ACTION_TYPES } from "../constants/actionTypes.js";
import { AUDIT_ENTITY_TYPES } from "../constants/entityTypes.js";
import { isSafeAuditMetadataKey } from "./actorHelpers.js";

const nowIso = () => new Date().toISOString();

const redactSensitiveAuditText = (value) =>
  String(value)
    .replace(/\b(bearer)\s+[a-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(
      /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi,
      "[REDACTED]",
    )
    .replace(
      /\b(password|token|secret|api[_-]?key|card[_-]?number|cvv|cvc|pin)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(
      /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi,
      "[REDACTED]",
    );

/**
 * Strips any potentially sensitive keys from audit event metadata.
 * Keys whose lowercased form contains a blocked term are removed silently.
 *
 * @param {object} [metadata]
 * @returns {object}
 */
export const stripSensitiveMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const normalize = (value, depth = 0) => {
    if (depth > 6) return "[TRUNCATED]";
    if (Array.isArray(value)) {
      return value.map((entry) =>
        entry && typeof entry === "object"
          ? normalize(entry, depth + 1)
          : typeof entry === "string"
            ? redactSensitiveAuditText(entry)
            : entry
      );
    }
    if (typeof value === "string") return redactSensitiveAuditText(value);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => isSafeAuditMetadataKey(key))
        .map(([key, entry]) => [
          key,
          entry && typeof entry === "object"
            ? normalize(entry, depth + 1)
            : typeof entry === "string"
              ? redactSensitiveAuditText(entry)
              : entry,
        ])
    );
  };

  return normalize(metadata);
};

/**
 * Creates a normalized audit event with safe defaults.
 * The returned object is a plain data record — it does not emit, store, or send anything.
 * Pass it to an app-owned audit writer when persistence is needed.
 *
 * @param {object} [fields]
 * @returns {import("../types/index.js").AuditEvent}
 */
export const createAuditEvent = (fields = {}) => {
  const occurredAt = fields.occurredAt || fields.timestamp || nowIso();
  const event = {
    kind: "audit",
    action: fields.action || "",
    entityType: fields.entityType || "",
    eventName:
      fields.eventName ||
      [fields.entityType, fields.action]
        .filter(Boolean)
        .join(".")
        .toLowerCase(),
    source: fields.source || AUDIT_SOURCES.ONLINE,
    status: fields.status || AUDIT_STATUSES.SUCCESS,
    severity: fields.severity || AUDIT_SEVERITIES.INFO,
    occurredAt,
    timestamp: occurredAt,
  };
  if (fields.id != null) event.id = String(fields.id);
  if (fields.application) event.application = String(fields.application);
  if (fields.requestId) event.requestId = String(fields.requestId).slice(0, 120);
  if (fields.entityId != null) event.entityId = String(fields.entityId);
  if (fields.actor && typeof fields.actor === "object") event.actor = { ...fields.actor };
  if (fields.org && typeof fields.org === "object") event.org = { ...fields.org };
  if (fields.metadata && typeof fields.metadata === "object") {
    const safe = stripSensitiveMetadata(fields.metadata);
    if (Object.keys(safe).length > 0) event.metadata = safe;
  }
  return event;
};

/**
 * Maps an offline queue item and its sync outcome to a shared audit event.
 * Does not emit, store, or send anything — returns a plain data object.
 *
 * Designed to accept a queue item from @faako/offline-sync without importing it directly.
 * Call this from app-level sync handlers when you want to record a sync outcome.
 *
 * @param {object} [queueItem] - A queue item from the offline sync store
 * @param {object} [outcome] - The sync result (status, error, conflictStatus)
 * @returns {import("../types/index.js").AuditEvent}
 */
export const createSyncAuditEvent = (queueItem = {}, outcome = {}) => {
  const { id: entityId, actorId, organizationId, sourceApp } = queueItem;
  const { status = "", error, conflictStatus = "none" } = outcome;

  const hasConflict = conflictStatus && conflictStatus !== "none";
  const auditStatus = hasConflict
    ? AUDIT_STATUSES.CONFLICT
    : status === "failed" || status === "needs_review"
      ? AUDIT_STATUSES.FAILED
      : status === "synced"
        ? AUDIT_STATUSES.SUCCESS
        : AUDIT_STATUSES.PENDING;

  const auditAction = hasConflict
    ? AUDIT_ACTION_TYPES.OFFLINE_SYNC_CONFLICT
    : auditStatus === AUDIT_STATUSES.FAILED
      ? AUDIT_ACTION_TYPES.OFFLINE_SYNC_FAILED
      : auditStatus === AUDIT_STATUSES.SUCCESS
        ? AUDIT_ACTION_TYPES.OFFLINE_SYNC_COMPLETED
        : AUDIT_ACTION_TYPES.OFFLINE_SYNC_RETRIED;

  const severity =
    auditStatus === AUDIT_STATUSES.CONFLICT
      ? AUDIT_SEVERITIES.WARNING
      : auditStatus === AUDIT_STATUSES.FAILED
        ? AUDIT_SEVERITIES.ERROR
        : AUDIT_SEVERITIES.INFO;

  return createAuditEvent({
    action: auditAction,
    entityType: AUDIT_ENTITY_TYPES.QUEUE_ITEM,
    entityId: entityId ? String(entityId) : undefined,
    actor: actorId ? { id: String(actorId), sourceApp: sourceApp || undefined } : undefined,
    org: organizationId ? { id: String(organizationId) } : undefined,
    source: AUDIT_SOURCES.OFFLINE_SYNC,
    status: auditStatus,
    severity,
    metadata: error ? { lastError: String(error).slice(0, 200) } : undefined,
  });
};

/**
 * Creates an audit event for a settings update action.
 * Safe to call from settings pages — does not emit or store anything.
 *
 * @param {object} [fields]
 * @param {object} [fields.actor] - Safe actor reference (use createActorRef)
 * @param {object} [fields.org] - Safe org reference (use createOrgRef)
 * @param {string} [fields.settingsKey] - Which setting changed (no values)
 * @param {string} [fields.source] - AUDIT_SOURCES value
 * @returns {import("../types/index.js").AuditEvent}
 */
export const createSettingsAuditEvent = (fields = {}) =>
  createAuditEvent({
    action: AUDIT_ACTION_TYPES.SETTINGS_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SETTINGS,
    actor: fields.actor,
    org: fields.org,
    source: fields.source || AUDIT_SOURCES.ONLINE,
    status: AUDIT_STATUSES.SUCCESS,
    severity: AUDIT_SEVERITIES.INFO,
    metadata: fields.settingsKey ? { settingsKey: String(fields.settingsKey) } : undefined,
  });
