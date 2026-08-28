# ADR: Shared analytics service

- **Status:** Accepted
- **Decision date:** 2026-08-04
- **Selected logical name:** `faako-analytics`

## Context

The existing Python service demonstrated useful REEBS analytics but encoded REEBS
in its package, API and security context. Other applications have analytical needs,
but duplicating Python services would duplicate metrics, credentials and tenant risk.

## Decision

Use one shared, independently deployed `faako-analytics` capability for advanced,
governed analyses that genuinely need Python. Keep `services/reebs-analytics` and
the current deployment address as compatibility locations until a separately
scheduled deployment rename is proven safe. New code, health identity, package
metadata, contracts and documentation use the logical platform name.

Platform engineering owns service reliability and contract stewardship. Each metric
also requires a named business owner; metrics without one remain provisional.

## Boundary

- Application backends authenticate users and enforce permissions/tenant scope.
- Backends produce minimised tenant-scoped snapshots or approved extracts.
- Scoped service credentials restrict callers by application and tenant.
- Python validates context and input, performs approved deterministic analysis, and
  returns stable contracts with data-quality status.
- Frontends consume their own backend adapters, never Python implementation details
  or service credentials.
- Python does not write to transactional systems.

## Deployment and data access

One stateless service is deployed privately where possible. Current ingestion is
server-to-server snapshot push. A read-only analytics database, replica, event stream
or scheduled extract requires a later ADR, lineage, retention and isolation controls.

## API and batch boundary

- Interactive API: `/api/analytics/{application}/{analysis}` for approved bounded analyses.
- Legacy API: `/v1/dashboard/insights` remains during REEBS migration.
- Batch work: not enabled in this phase. Future jobs require idempotency, checkpoints,
  backfill controls and an operations owner.
- No arbitrary SQL, notebook execution, user-supplied Python or generic query endpoint.

## Intended consumers

Current: REEBS Portal backend. Prepared: Dev ERP backend. Candidate future consumers
include Faako ERP, Stroane admin and approved tenant applications after source/metric
review. Public Astro sites and browsers are not direct consumers.

## Supported use cases

- Deterministic descriptive and rule-based analyses over approved snapshots.
- Data-quality-aware operational, inventory, commercial and finance analyses.
- Explainable forecasts only after baseline/evaluation requirements are satisfied.

## Explicitly unsupported

- Unapproved cross-tenant reporting or tenant benchmarking.
- Employee, customer, donation or health-related model training without documented approval.
- Payment credentials, authentication secrets or raw sensitive records in snapshots.
- Real-time operational transaction decisions that cannot tolerate service latency/failure.
- Recreating simple SQL totals, frontend charts or Power BI presentation logic in Python.

## Consequences

The repository gains one governed platform boundary without a risky deployment rename.
Consumers must provide stable context and accept quality/staleness states. Some existing
REEBS naming remains temporarily and is tracked as migration debt.
