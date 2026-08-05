# Python analytics reuse assessment

| Component or concern | Classification | Assessment and action |
| --- | --- | --- |
| FastAPI/Uvicorn deployment | Reusable, production-ready baseline | Retained as an independently deployed service |
| Pydantic boundary validation | Reusable, production-ready baseline | Extended with application-neutral contracts |
| Push-based aggregate snapshots | Reusable | Preferred initial ingestion pattern; keeps transactional secrets out of Python |
| Constant-time bearer comparison | Reusable but previously too broad | Extended to caller/application/tenant-scoped principals |
| Revenue trend heuristic | REEBS-specific, experimental | Preserved for compatibility; must not be marketed as ML or used for commitments |
| Weekday booking demand | REEBS-specific | Retained only in the REEBS dashboard pilot |
| Inventory days-cover rule | Reusable calculation with domain-specific thresholds | Pilot retained; thresholds require business ownership before broader reuse |
| Repeat-customer calculation | REEBS-specific definition | Not promoted to a shared metric until identity/window rules are approved |
| Node continuity fallback | REEBS-specific, production-ready continuity | Retained to avoid dashboard outage when Python is unavailable |
| `organizationId`-only scope | Insufficiently governed | Replaced on new APIs by string tenant and application context |
| Raw `dict[str, Any]` API outputs | Unsafe for reuse | Wrapped in explicit response and data-quality contracts |
| Direct database access | Not present and unsupported | Keep absent until an approved read-only analytics store/replica ADR exists |
| File/notebook ingestion | Not present | Allowed only through future governed ingestion and review policy |
| Arbitrary queries/code execution | Unsafe and unsupported | Must never be exposed |
| ML/model lifecycle | Not present | Do not add until history, baselines, evaluation and ownership requirements are met |

## Reuse rule

A calculation is not reusable merely because its code is generic. It becomes a
shared metric only after its business definition, source grain, exclusions, owner,
refresh cadence and data-quality requirements are approved in the metric catalogue.

