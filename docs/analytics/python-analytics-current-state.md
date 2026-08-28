# Python analytics current state

## Baseline at the start of this phase

The only Python analytics service was `services/reebs-analytics`. It was a small,
read-only FastAPI process for the REEBS management dashboard. The REEBS Node
backend queried its own organisation-scoped PostgreSQL data and pushed a compact
snapshot to Python. Python had no database credentials and returned deterministic
forecast, demand, inventory-risk and repeat-customer results.

| Area | Baseline evidence |
| --- | --- |
| Runtime | Python `>=3.11`; Docker uses Python 3.12 slim |
| Packaging | PEP 621 `pyproject.toml`; pip editable install for development |
| Libraries | FastAPI, Pydantic and Uvicorn; HTTPX and pytest for tests |
| Endpoints | `GET /health`, `POST /v1/dashboard/insights` |
| Input datasets | 90-day daily order/booking revenue, 180-day booking weekday counts, 90-day inventory movement aggregates, aggregate customer/repeat counts |
| Database access | None in Python; the authenticated REEBS backend owns SQL and tenant filters |
| File inputs | None |
| Scheduled jobs/workers | None |
| Notebooks | None |
| Scripts/model artefacts | None; calculations are ordinary Python functions |
| ML models | None. The revenue projection is a bounded trend heuristic, not machine learning |
| Outputs | JSON dashboard insights with a calculation version and confidence label |
| Deployment | Standalone Railway/Docker-compatible Uvicorn service |
| Tests | Deterministic unit tests for calculation defaults and bearer authentication |
| Security | Server-to-server bearer secret, no browser exposure, no database secret, fail-closed missing-secret behaviour |

## Coupling found

- Package, title, health response, environment names and documentation used REEBS naming.
- The input schema required an integer `organizationId` and assumed REEBS revenue,
  booking, inventory and customer fields.
- The only consumer used `/v1/dashboard/insights` and checked the returned
  `organizationId`, but there was no application identifier or credential-level
  tenant allow-list.
- Data-quality status, calculation periods and request IDs were not part of the
  response contract.
- The same heuristic existed in Node as a deliberate continuity fallback.

## State after this phase

- Logical package/service identity is `faako-analytics`; the physical directory
  remains unchanged during deployment migration.
- New endpoint boundary: `POST /api/analytics/{application}/{analysis}`.
- New requests bind application and tenant context in the path, body, headers and
  scoped service principal.
- New responses use shared analytical envelopes mirrored in `@faako/types`.
- Quality status, warnings, period, source/refresh timestamps, calculation version,
  confidence and request ID are explicit.
- REEBS consumes the new boundary through a compatibility adapter; its legacy
  route and configuration aliases remain available.
- Dev ERP operational health is implemented as a deterministic second pilot,
  ready for an authorised backend snapshot producer.
- Ruff and mypy are defined as CI gates alongside pytest.

## Important limitations

There is still no warehouse, historical analytical store, scheduler, notebook or
model registry. That is intentional. Current pilots are request/response analysis
of governed snapshots, not a claim of a complete data platform.
