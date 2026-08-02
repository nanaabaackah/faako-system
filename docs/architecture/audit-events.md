# Audit events

Status: shared convention adopted as of 2026-07-26.

Audit events are durable records of consequential business, security, and
administrative actions. They are not request logs, debug output, analytics
events, or error-monitoring breadcrumbs.

## Standard shape

```json
{
  "kind": "audit",
  "application": "reebs-portal",
  "eventName": "user.user_created",
  "action": "USER_CREATED",
  "entityType": "USER",
  "entityId": "123",
  "source": "online",
  "status": "success",
  "severity": "info",
  "occurredAt": "2026-07-26T12:00:00.000Z",
  "timestamp": "2026-07-26T12:00:00.000Z",
  "requestId": "transport-request-id",
  "actor": {
    "id": "12",
    "role": "admin"
  },
  "org": {
    "id": "7"
  },
  "metadata": {
    "assignedRole": "staff"
  }
}
```

`occurredAt` is canonical; `timestamp` is retained for existing consumers.
`requestId` correlates diagnostics but is not the audit event ID.

## Required semantics

- `eventName` is stable and machine-readable.
- `action` describes the business/security change, not an HTTP method.
- `entityType`/`entityId` identify the affected object.
- `actor` identifies who initiated the action using safe internal references.
- `org` identifies tenant scope.
- `status` is the outcome (`success`, `failed`, `pending`, or `conflict`).
- `severity` reflects audit significance, not logger verbosity.
- `metadata` contains changed-field names, reasons, or safe references, not
  snapshots of sensitive records.

## Standard actions

The shared constants include:

- `USER_CREATED`, `USER_DISABLED`;
- `ROLE_ASSIGNED`, `ROLE_UPDATED`, `PERMISSION_CHANGED`;
- `INVENTORY_ADJUSTED`;
- `INVOICE_STATUS_CHANGED`;
- `PAYMENT_RECORDED`, `PAYMENT_UPDATED`, `PAYMENT_STATUS_CHANGED`;
- `ORGANIZATION_SETTINGS_CHANGED`, `SETTINGS_UPDATED`;
- existing login, order, booking, integration, and offline-sync actions.

Use a more specific action instead of `ADMIN_ACTION` when one exists.

## Redaction and privacy

`createAuditEvent` and `stripSensitiveMetadata` remove sensitive metadata keys
recursively. Actor references no longer derive labels from email addresses.
Never include passwords, tokens, cookies, secrets, payment credentials, raw
request bodies, or unnecessary personal information.

An audit store may retain IDs needed for accountability, subject to access,
retention, export, and deletion policy. Audit read APIs must enforce the same
organisation rules as the underlying business operation.

## Diagnostic logs versus audit

| Diagnostic log | Audit event |
| --- | --- |
| Explains system operation/failure | Proves a consequential action/outcome |
| May be sampled or short-lived | Durable and append-oriented |
| HTTP request completion is normal | `USER_CREATED` is auditable |
| Owned by logger/observability | Owned by audit writer/domain service |

A failed API request may create a diagnostic error log. It creates an audit
event only if the attempted action itself is security/business significant and
the audit policy requires denied attempts.

## Persistence adapters

`@faako/audit` remains framework independent and returns plain records. Dev ERP
and REEBS retain their existing database writers and may map the shared record
to current column names. Stroane retains its current activity/audit persistence.
Do not add database clients to the shared package.

Writers must be append-oriented, tenant-scoped, redacted, and resilient to
duplicate delivery through an event/external reference where required. Whether
an audit write is transactionally mandatory is a domain decision:

- permission/role changes should normally commit with their audit event;
- low-risk notification metadata may use best-effort audit delivery;
- a writer failure must never be silently presented as a successful mandatory
  audit.

## Adoption sequence

1. Use shared constants/shape for new actions.
2. Add an app-local adapter to its existing writer.
3. Test redaction, tenant scope, actor, outcome, and idempotency.
4. Migrate one event family at a time.

Routine request-to-audit conversion is disabled by default in the standardized
Dev ERP request logger.
