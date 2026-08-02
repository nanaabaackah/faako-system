import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  AUDIT_SEVERITIES,
  AUDIT_SOURCES,
  AUDIT_STATUSES,
  createActorRef,
  createAuditEvent,
  createOrgRef,
  createSettingsAuditEvent,
  createSyncAuditEvent,
  formatAuditActor,
  formatAuditEventSummary,
  formatAuditTimestamp,
  getAuditActionLabel,
  getAuditStatusLabel,
  isSafeAuditMetadataKey,
  stripSensitiveMetadata,
} from "../src/index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

test("AUDIT_ACTION_TYPES covers auth, payment, order, booking, inventory, sync, settings, and system", () => {
  assert.equal(typeof AUDIT_ACTION_TYPES.LOGIN_SUCCESS, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.PAYMENT_RECORDED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.ORDER_CREATED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.BOOKING_UPDATED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.INVENTORY_ADJUSTED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.OFFLINE_SYNC_RETRIED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.SETTINGS_UPDATED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.SYSTEM_EVENT, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.USER_CREATED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.PERMISSION_CHANGED, "string");
  assert.equal(typeof AUDIT_ACTION_TYPES.INVOICE_STATUS_CHANGED, "string");
});

test("AUDIT_ACTION_TYPES is frozen", () => {
  assert.throws(() => {
    AUDIT_ACTION_TYPES.CUSTOM_ACTION = "custom";
  }, TypeError);
});

test("AUDIT_STATUSES covers success, failed, pending, and conflict", () => {
  assert.equal(AUDIT_STATUSES.SUCCESS, "success");
  assert.equal(AUDIT_STATUSES.FAILED, "failed");
  assert.equal(AUDIT_STATUSES.PENDING, "pending");
  assert.equal(AUDIT_STATUSES.CONFLICT, "conflict");
});

test("AUDIT_SOURCES covers online, offline_sync, and system", () => {
  assert.equal(AUDIT_SOURCES.ONLINE, "online");
  assert.equal(AUDIT_SOURCES.OFFLINE_SYNC, "offline_sync");
  assert.equal(AUDIT_SOURCES.SYSTEM, "system");
});

// ─── Actor helpers ────────────────────────────────────────────────────────────

test("isSafeAuditMetadataKey blocks password, token, and secret", () => {
  assert.equal(isSafeAuditMetadataKey("password"), false);
  assert.equal(isSafeAuditMetadataKey("accessToken"), false);
  assert.equal(isSafeAuditMetadataKey("secret"), false);
  assert.equal(isSafeAuditMetadataKey("cvv"), false);
  assert.equal(isSafeAuditMetadataKey("apiKey"), false);
});

test("isSafeAuditMetadataKey allows safe operational keys", () => {
  assert.equal(isSafeAuditMetadataKey("settingsKey"), true);
  assert.equal(isSafeAuditMetadataKey("lastError"), true);
  assert.equal(isSafeAuditMetadataKey("conflictReason"), true);
  assert.equal(isSafeAuditMetadataKey("attempts"), true);
});

test("createActorRef picks only safe fields", () => {
  const actor = createActorRef({ id: "u1", role: "admin", label: "Administrator", name: "Ama", email: "ama@example.com", password: "secret123" });
  assert.equal(actor.id, "u1");
  assert.equal(actor.role, "admin");
  assert.equal(actor.label, "Administrator");
  assert.equal(actor.password, undefined);
});

test("createActorRef does not derive audit labels from email addresses", () => {
  const actor = createActorRef({ id: "u2", email: "abcdef@example.com" });
  assert.equal(actor.id, "u2");
  assert.equal(actor.label, undefined);
});

test("createActorRef returns undefined for empty input", () => {
  assert.equal(createActorRef({}), undefined);
  assert.equal(createActorRef(), undefined);
});

test("createOrgRef picks id and label", () => {
  const org = createOrgRef({ id: "org1", name: "REEBS HQ" });
  assert.equal(org.id, "org1");
  assert.equal(org.label, "REEBS HQ");
});

// ─── Metadata normalization ───────────────────────────────────────────────────

test("stripSensitiveMetadata removes blocked keys", () => {
  const safe = stripSensitiveMetadata({
    lastError: "Tenant not found",
    token: "should-be-removed",
    password: "also-removed",
    attempts: 3,
  });
  assert.equal(safe.lastError, "Tenant not found");
  assert.equal(safe.attempts, 3);
  assert.equal(safe.token, undefined);
  assert.equal(safe.password, undefined);
});

test("createAuditEvent produces a normalized event with defaults", () => {
  const event = createAuditEvent({
    action: AUDIT_ACTION_TYPES.SETTINGS_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SETTINGS,
  });
  assert.equal(event.action, AUDIT_ACTION_TYPES.SETTINGS_UPDATED);
  assert.equal(event.entityType, AUDIT_ENTITY_TYPES.SETTINGS);
  assert.equal(event.source, AUDIT_SOURCES.ONLINE);
  assert.equal(event.status, AUDIT_STATUSES.SUCCESS);
  assert.equal(event.severity, AUDIT_SEVERITIES.INFO);
  assert.equal(event.kind, "audit");
  assert.equal(event.eventName, "settings.settings_updated");
  assert.equal(typeof event.timestamp, "string");
  assert.equal(event.occurredAt, event.timestamp);
  assert.ok(event.timestamp.includes("T"));
});

test("createAuditEvent carries application and request correlation without secrets", () => {
  const event = createAuditEvent({
    application: "reebs-portal",
    requestId: "request-1",
    action: AUDIT_ACTION_TYPES.USER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    metadata: {
      assignedRole: "staff",
      nested: { accessToken: "secret", reason: "new starter" },
    },
  });
  assert.equal(event.application, "reebs-portal");
  assert.equal(event.requestId, "request-1");
  assert.equal(event.metadata.nested.accessToken, undefined);
  assert.equal(event.metadata.nested.reason, "new starter");
});

test("createAuditEvent strips sensitive metadata keys", () => {
  const event = createAuditEvent({
    action: AUDIT_ACTION_TYPES.SYSTEM_EVENT,
    entityType: AUDIT_ENTITY_TYPES.USER,
    metadata: { token: "should-be-gone", role: "admin" },
  });
  assert.equal(event.metadata?.token, undefined);
  assert.equal(event.metadata?.role, "admin");
});

test("createAuditEvent redacts secrets and personal data embedded in safe text fields", () => {
  const event = createAuditEvent({
    metadata: {
      lastError:
        "Bearer abc123 failed for person@example.com with token=secret-value",
    },
  });

  assert.equal(event.metadata.lastError.includes("abc123"), false);
  assert.equal(event.metadata.lastError.includes("person@example.com"), false);
  assert.equal(event.metadata.lastError.includes("secret-value"), false);
});

test("createAuditEvent omits metadata key when all fields are stripped", () => {
  const event = createAuditEvent({
    action: AUDIT_ACTION_TYPES.SYSTEM_EVENT,
    entityType: AUDIT_ENTITY_TYPES.USER,
    metadata: { token: "gone", password: "gone" },
  });
  assert.equal(event.metadata, undefined);
});

// ─── Sync audit event helper ──────────────────────────────────────────────────

test("createSyncAuditEvent maps a successful sync outcome", () => {
  const event = createSyncAuditEvent(
    { id: "q1", actorId: "u1", organizationId: "org1", sourceApp: "reebs-portal" },
    { status: "synced" }
  );
  assert.equal(event.action, AUDIT_ACTION_TYPES.OFFLINE_SYNC_COMPLETED);
  assert.equal(event.status, AUDIT_STATUSES.SUCCESS);
  assert.equal(event.severity, AUDIT_SEVERITIES.INFO);
  assert.equal(event.source, AUDIT_SOURCES.OFFLINE_SYNC);
  assert.equal(event.entityId, "q1");
  assert.equal(event.actor?.id, "u1");
  assert.equal(event.org?.id, "org1");
});

test("createSyncAuditEvent maps a failed sync outcome", () => {
  const event = createSyncAuditEvent(
    { id: "q2", actorId: "u2" },
    { status: "failed", error: "Permission denied" }
  );
  assert.equal(event.action, AUDIT_ACTION_TYPES.OFFLINE_SYNC_FAILED);
  assert.equal(event.status, AUDIT_STATUSES.FAILED);
  assert.equal(event.severity, AUDIT_SEVERITIES.ERROR);
  assert.equal(event.metadata?.lastError, "Permission denied");
});

test("createSyncAuditEvent maps a conflict outcome", () => {
  const event = createSyncAuditEvent(
    { id: "q3" },
    { status: "needs_review", conflictStatus: "detected" }
  );
  assert.equal(event.action, AUDIT_ACTION_TYPES.OFFLINE_SYNC_CONFLICT);
  assert.equal(event.status, AUDIT_STATUSES.CONFLICT);
  assert.equal(event.severity, AUDIT_SEVERITIES.WARNING);
});

test("createSyncAuditEvent maps a retry (pending) outcome", () => {
  const event = createSyncAuditEvent({ id: "q4" }, { status: "pending" });
  assert.equal(event.action, AUDIT_ACTION_TYPES.OFFLINE_SYNC_RETRIED);
  assert.equal(event.status, AUDIT_STATUSES.PENDING);
  assert.equal(event.severity, AUDIT_SEVERITIES.INFO);
});

// ─── Settings audit event helper ─────────────────────────────────────────────

test("createSettingsAuditEvent produces a safe settings event", () => {
  const actor = createActorRef({ id: "u1", role: "admin" });
  const org = createOrgRef({ id: "org1", name: "Dev ERP" });
  const event = createSettingsAuditEvent({ actor, org, settingsKey: "alertPreferences" });
  assert.equal(event.action, AUDIT_ACTION_TYPES.SETTINGS_UPDATED);
  assert.equal(event.entityType, AUDIT_ENTITY_TYPES.SETTINGS);
  assert.equal(event.status, AUDIT_STATUSES.SUCCESS);
  assert.equal(event.metadata?.settingsKey, "alertPreferences");
});

// ─── Event formatting ─────────────────────────────────────────────────────────

test("getAuditActionLabel returns a readable label for known actions", () => {
  assert.equal(getAuditActionLabel(AUDIT_ACTION_TYPES.LOGIN_FAILURE), "Login failed");
  assert.equal(getAuditActionLabel(AUDIT_ACTION_TYPES.OFFLINE_SYNC_CONFLICT), "Offline sync conflict detected");
  assert.equal(getAuditActionLabel(AUDIT_ACTION_TYPES.PAYMENT_RECORDED), "Payment recorded");
});

test("getAuditActionLabel falls back to the raw value for unknown actions", () => {
  assert.equal(getAuditActionLabel("CUSTOM_UNKNOWN_ACTION"), "CUSTOM_UNKNOWN_ACTION");
  assert.equal(getAuditActionLabel(""), "Unknown action");
});

test("getAuditStatusLabel returns readable labels", () => {
  assert.equal(getAuditStatusLabel(AUDIT_STATUSES.CONFLICT), "Conflict");
  assert.equal(getAuditStatusLabel(""), "Unknown status");
});

test("formatAuditEventSummary returns a display-safe summary string", () => {
  const event = createAuditEvent({
    action: AUDIT_ACTION_TYPES.OFFLINE_SYNC_FAILED,
    entityType: AUDIT_ENTITY_TYPES.QUEUE_ITEM,
    source: AUDIT_SOURCES.OFFLINE_SYNC,
    status: AUDIT_STATUSES.FAILED,
  });
  const summary = formatAuditEventSummary(event);
  assert.match(summary, /Offline sync failed/);
  assert.match(summary, /Queue item/);
  assert.match(summary, /Failed/);
  assert.match(summary, /offline/i);
});

test("formatAuditActor returns safe display strings", () => {
  assert.equal(formatAuditActor({ label: "Ama K." }), "Ama K.");
  assert.equal(formatAuditActor({ role: "staff" }), "staff user");
  assert.equal(formatAuditActor({}), "System");
  assert.equal(formatAuditActor(null), "Unknown actor");
});

test("formatAuditTimestamp formats valid ISO timestamps", () => {
  const ts = "2026-05-12T10:30:00.000Z";
  const result = formatAuditTimestamp(ts);
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("formatAuditTimestamp falls back gracefully on invalid input", () => {
  assert.equal(formatAuditTimestamp(""), "");
  assert.equal(formatAuditTimestamp(undefined), "");
  const result = formatAuditTimestamp("not-a-date");
  assert.equal(typeof result, "string");
});
