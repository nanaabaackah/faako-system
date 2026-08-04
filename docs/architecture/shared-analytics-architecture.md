# Shared analytics architecture

```text
transactional application
  -> authenticated backend + authoritative tenant permission
  -> governed/minimised tenant snapshot
  -> faako-analytics validation + quality checks + calculation
  -> stable analytical response contract
  -> backend adapter/cache
  -> approved dashboard, report, export or alert
```

## Current implementation

1. Transactional systems retain ownership of operational data and business writes.
2. An application backend queries only the authorised tenant and removes unnecessary
   personal fields.
3. The backend calls the private service with a caller credential plus matching
   application/tenant context in path, headers and body.
4. Python validates the contract and credential scope, runs quality checks, applies a
   versioned deterministic calculation and returns a framework-neutral envelope.
5. The backend validates returned context, blocks `dataQuality.status=blocked`, adapts
   for existing clients and uses a safe local fallback where approved.

## Evaluated ingestion patterns

| Pattern | Decision |
| --- | --- |
| Backend API snapshot push | Selected now: strongest existing tenant enforcement and no Python DB secret |
| Direct transactional DB access | Rejected now: risks workload contention and duplicated tenant enforcement |
| Read-only replica/analytics DB | Future option after isolation, lineage, retention and cost ADR |
| Scheduled extracts/materialised tables | Future option for expensive/history-dependent analyses |
| Event-driven ingestion | Future option after event contracts/idempotency are mature |
| Secure file ingestion | Exception only; requires malware/type/size/retention controls and provenance |

## Processing and storage

The service is stateless and currently stores neither raw snapshots nor results.
Calculations use Python standard-library logic; Pandas/NumPy objects never cross the
API. If storage is introduced, raw/curated/result zones, encryption, row-level tenant
keys, retention and deletion workflows must be approved first.

## Scheduling, retries and failure handling

- No scheduler or worker is enabled now.
- Callers may retry safe read/analysis requests with bounded backoff; request IDs must
  be retained. Unsafe operational mutations are outside the service.
- REEBS uses a deterministic Node fallback when Python is unavailable.
- Invalid/auth/permission/not-found/server responses use user-safe categories and a
  request ID. Stack traces and submitted records are not returned.
- A quality-blocked result is not silently shown as reliable analytics.

## Isolation

Credentials are scoped to application and allowed tenants. Header/body/path context
must agree. Platform-admin credentials require explicit configuration and do not
enable cross-tenant output automatically. Cross-tenant aggregation is unsupported in
the current API.

## Lineage and retention

Every result identifies application, tenant, period, source timestamp, refresh
timestamp, calculation version and metric IDs. Current request bodies live only for
request processing; platform access logs retain metadata, never payloads. Operational
log retention follows the central logging policy. Future dataset retention requires a
documented duration, purpose, deletion owner and backfill record.

