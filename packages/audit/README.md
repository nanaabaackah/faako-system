# @faako/audit

Shared audit logging and operational visibility foundation for the Faako platform.

Provides audit event constants, action/entity/status types, safe actor and metadata helpers, event formatting helpers, and event normalization utilities. This package is a pure data and helper foundation — it does not emit, store, transmit, or log anything on its own. Actual persistence is always app-owned.

## What it is

- **Audit event constants** — action types, entity types, severity levels, sources, and statuses
- **Safe actor/org helpers** — build display-safe references from user objects without exposing passwords or tokens
- **Metadata normalization** — strip sensitive keys before passing metadata to any writer
- **Event formatting helpers** — human-readable labels and summaries for UI presentation
- **Event shape helpers** — `createAuditEvent`, `createSyncAuditEvent`, `createSettingsAuditEvent`

## What it is not

- A database writer (no persistence)
- A logging emitter (no console/file output)
- A notification sender (no email/SMS/push)
- A replacement for app-owned audit workflows

## Where it lives

```
packages/audit/
  src/
    constants/
      actionTypes.js     # AUDIT_ACTION_TYPES, AUDIT_ACTION_LABELS
      entityTypes.js     # AUDIT_ENTITY_TYPES, AUDIT_ENTITY_LABELS
      severities.js      # AUDIT_SEVERITIES, AUDIT_SEVERITY_LABELS
      sources.js         # AUDIT_SOURCES, AUDIT_SOURCE_LABELS
      statuses.js        # AUDIT_STATUSES, AUDIT_STATUS_LABELS
    helpers/
      actorHelpers.js    # createActorRef, createOrgRef, isSafeAuditMetadataKey
      eventFormatting.js # formatAuditEventSummary, formatAuditActor, getAudit*Label
      metadataNormalization.js  # createAuditEvent, createSyncAuditEvent, createSettingsAuditEvent, stripSensitiveMetadata
    types/
      index.js           # JSDoc type definitions: AuditEvent, AuditActor, AuditOrganization
    index.js
  test/
    audit.test.mjs
```

## Usage

```js
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  AUDIT_SOURCES,
  AUDIT_STATUSES,
  createActorRef,
  createAuditEvent,
  createSyncAuditEvent,
  formatAuditEventSummary,
} from "@faako/audit";

// Build a safe actor reference from a user session (no passwords/tokens)
const actor = createActorRef({ id: user.id, role: user.role, name: user.name });

// Create a normalized audit event (does not store or emit anything)
const event = createAuditEvent({
  action: AUDIT_ACTION_TYPES.SETTINGS_UPDATED,
  entityType: AUDIT_ENTITY_TYPES.SETTINGS,
  actor,
  source: AUDIT_SOURCES.ONLINE,
  status: AUDIT_STATUSES.SUCCESS,
});

// Map an offline sync queue item outcome to an audit event
const syncEvent = createSyncAuditEvent(queueItem, { status: "synced" });

// Display-safe summary for UI
const summary = formatAuditEventSummary(event);
// → "Settings updated (Settings) — Success via Online"
```

## Sub-path imports

```js
import { AUDIT_ACTION_TYPES } from "@faako/audit/constants";
import { createAuditEvent } from "@faako/audit/helpers";
```

## Security rules

- **Never include passwords, tokens, or secrets** in any audit event field or metadata.
- `createActorRef` picks only `id`, `role`, `name`/`email` (partially redacted), and `sourceApp`.
- `stripSensitiveMetadata` removes any metadata key whose lowercased form contains a blocked term (password, token, secret, apiKey, cvv, pin, ssn, etc.).
- `createAuditEvent` calls `stripSensitiveMetadata` automatically before returning.
- Error strings in metadata are capped at 200 characters by `createSyncAuditEvent`.

## Audit event shape

```js
{
  action: "OFFLINE_SYNC_FAILED",      // from AUDIT_ACTION_TYPES
  entityType: "QUEUE_ITEM",           // from AUDIT_ENTITY_TYPES
  entityId: "offline-2026-abc123",    // string reference only
  actor: { id: "u1", role: "staff" }, // from createActorRef
  org: { id: "org1", label: "REEBS" },// from createOrgRef
  source: "offline_sync",             // from AUDIT_SOURCES
  status: "failed",                   // from AUDIT_STATUSES
  severity: "error",                  // from AUDIT_SEVERITIES
  timestamp: "2026-05-12T10:00:00Z",  // ISO 8601
  metadata: { lastError: "Denied" },  // safe keys only
}
```

## Future work

- **Backend audit writer**: append-only server-side persistence after database schema and retention policy are defined.
- **Admin activity feed**: read-only feed view after per-app audit event contracts are stabilized.
- **Exportable audit logs**: CSV/JSON export after PII redaction rules and retention windows are documented.
- **Audit dashboard**: operational visibility dashboard after ingestion and org-level access controls are proven.
- **Anomaly detection**: threshold-based helpers after normal operational baselines are measured.
- **AI operational insights**: connect audit patterns to AI analysis only after consent, privacy, and customer data exclusions are in place.

See `src/index.js` for the full TODO list.

## Running tests

```sh
pnpm --filter @faako/audit test
# or
node --test packages/audit/test/audit.test.mjs
```
