# Analytics data contracts

The canonical language-neutral shape is implemented with Pydantic in
`services/reebs-analytics/app/contracts.py` and mirrored for TypeScript consumers
in `packages/types/src/analytics.ts`.

## Request envelope

| Field | Requirement |
| --- | --- |
| `context.applicationId` | Stable registered application key |
| `context.tenantId` | Opaque string tenant/organisation identifier |
| `period.startAt`, `period.endAt` | ISO timestamps; end cannot precede start |
| `sourceTimestamp` | When the source snapshot was generated |
| `data` | Analysis-specific, validated snapshot; never arbitrary query/code |

The application and tenant must also match the request path/headers and the caller's
credential scope.

## Response envelope

Every approved analysis returns:

- `analysisId` and `metricIds`
- `calculationVersion`
- matching application/tenant context
- calculation period
- source and refresh timestamps
- propagated/generated request ID
- JSON-safe result
- `low`, `medium`, `high` or `not_applicable` confidence
- warnings
- data-quality status and checks

`blocked` quality means the result must not be presented as decision-ready.

## Shared result contracts

`@faako/types` defines framework-independent shapes for time-series points, KPI
results, forecasts, anomalies, segments, recommendations, dashboard/report datasets
and quality results. Frontends must not import Pydantic, Pandas, NumPy or FastAPI types.

## Forecast contract rule

A forecast must identify its metric, horizon, baseline method, version, uncertainty
where supportable, and evaluation metric/value when evaluated. A heuristic without a
training/evaluation process must be labelled as a heuristic, not ML.

## Error contract

Errors return `ok=false` with `category`, stable `code`, safe `message` and
`requestId`. Supported categories include validation, authentication, permission,
not-found, rate-limit and server/unavailable. No stack trace or input record is returned.

## Versioning

Additive result fields may be introduced without changing a calculation version.
Formula, window, exclusion, grain or threshold changes require a new calculation
version and metric-catalogue review. Breaking envelope changes require a new API version.
