# Analytics delivery strategy

| Output need | Calculation owner | Storage | Presentation/schedule owner | Default tool |
| --- | --- | --- | --- | --- |
| Simple current totals/status counts | Transactional SQL/backend | Transactional/approved cache | Application UI | SQL + existing API |
| Interactive advanced analysis | `faako-analytics` | Stateless/approved cache | Application backend/UI | Shared REST contract |
| Management trend dashboard | SQL/Python according to complexity | Future curated analytical table | Power BI/application dashboard | BI or app dashboard |
| Scheduled management report | Approved SQL/Python batch | Approved report dataset | Scheduler/report service | Report/Power BI |
| Alert/recommendation | Versioned rule in owning backend or analytics | Audit/notification record | Notifications package/worker | Existing alerting infrastructure |
| Export | Source/backend or approved analytical dataset | Time-limited export | Backend download flow | CSV/XLSX/PDF as justified |

Python must not recreate straightforward filtering, sums or chart rendering already
handled well by SQL, frontend code or Power BI.

## Integration contract

| Consumer | Authentication/context | Capability | Refresh/cache | UX states | Permission |
| --- | --- | --- | --- | --- | --- |
| REEBS Portal backend | Scoped server token; `reebs` + organisation tenant | `dashboard-insights` | On dashboard request; bounded backend timeout; existing fallback | loading, warning/stale, fallback, retry-safe error | Existing `financials:read` backend enforcement |
| Dev ERP backend (prepared) | Scoped server token; `dev-erp` + organisation tenant | `operational-health` | Proposed daily/on demand; short tenant-keyed cache only after approval | loading, empty, stale warning, blocked quality, retry | Operations/projects read permission to be selected before endpoint integration |
| Future apps | New scoped caller and approved metric | Explicit allow-listed route only | Per use case | Standard UX states | Backend permission is mandatory |

Frontends never receive service credentials and do not depend on FastAPI/Python types.
Application adapters may reshape stable results for existing UI compatibility.

## Pilot limitations

- REEBS uses provisional thresholds and a bounded heuristic; it is operational guidance,
  not a financial forecast or automated purchase order.
- Dev ERP identifies delay concentration, not causal process bottlenecks, because stage
  transition history is not currently available.
