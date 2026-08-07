# System Health Dashboard Phase 2

## Architecture

Phase 2 keeps the Phase 1 React hierarchy and adds a modular server-owned monitoring system under `apps/dev-erp/backend/monitoring`. The registry resolves trusted configuration; checkers return one minimized contract; the service coordinates retries, persistence, incidents, dependencies, and aggregation; the scheduler runs due checks with bounded concurrency; controllers expose secured APIs. Substantial monitoring logic does not live in `server.js`.

## Persistence

The additive migration creates `MonitoredService`, `HealthCheck`, `MonitoringIncident`, and `ServiceDependency`, plus category/check/status/incident enums and history/incident/dependency indexes. Targets, credentials, connection strings, authorization data, and full provider responses are not stored. `recoveryCount` supports threshold-based incident resolution.

The migration in `prisma/migrations/20260731181000_monitoring_foundation` is created only. It must be reviewed and deployed manually before monitoring is enabled.

## Registry and checks

The registry covers Business, API, Database, Infrastructure, External, and Worker services. Entries contain safe metadata, intervals, timeouts, limited retries, criticality, and dependency keys. Runtime targets are resolved from server environment variables and excluded from persistence/API serialization. Missing targets return `UNKNOWN`; disabled services remain registered and visible.

Supported checkers:

- HTTP/External: trusted GET/HEAD, expected status, redirect bound, strict abort timeout, latency degradation, optional validation, Faako user agent.
- Database: bounded `SELECT 1` through an injected existing database query function. Cross-app databases prefer application health endpoints.
- DNS: bounded resolution for a configured hostname.
- SSL: certificate validation and expiry classification (`>30` healthy, `7–30` degraded, `<7` down).
- TCP: trusted configured host/port only.
- Worker: configured heartbeat age classification.

No payment initiation/charge endpoint is called. No arbitrary URL or target appears in a request body or query parameter.

## Scheduler and incidents

The process-local scheduler ticks every 15 seconds by default, identifies enabled due services by their configured interval, prevents per-service overlap, limits concurrency, applies startup jitter, contains checker failures, and does not crash the API. Critical checks default to 60 seconds, normal checks to five minutes, infrastructure to ten minutes, and SSL to one hour.

`DOWN` checks open an incident after the configured consecutive-failure threshold (default 2). One continuous failure increments the active incident instead of opening duplicates. Consecutive healthy checks resolve it after the recovery threshold (default 2). `UNKNOWN` and `DEGRADED` do not open outage incidents by default.

This is not a distributed scheduler. Multiple API instances may each schedule checks. Run one monitoring-enabled instance until a distributed lease/worker is implemented.

## Dependencies, timelines, and scoring

Registry startup rejects circular dependency definitions. Direct and effective status remain distinct: direct Down stays Down; a Healthy service with a Down/Degraded dependency becomes effectively Degraded; Unknown remains Unknown.

History is aggregated server-side into chronological fixed arrays with newest last: 60 one-minute buckets for 1h, 288 five-minute buckets for 24h, 336 thirty-minute buckets for 7d, and 360 two-hour buckets for 30d. Missing buckets are Unknown and each populated bucket uses its worst status plus average latency, representative HTTP status, incident reference, and sample count.

Range metrics include current, minimum, maximum, average, P95, trend, and uptime. Health score weights are Business 35%, API 25%, Database 20%, Infrastructure 10%, External 5%, and Worker 5%, with 1.5x critical-service weight. Healthy=100, Degraded=60, Down=0; Unknown is excluded and score is suppressed below 50% coverage.

## APIs and authorization

- `GET /api/monitoring/summary`
- `GET /api/monitoring/services`
- `GET /api/monitoring/services/:id`
- `GET /api/monitoring/services/:id/history`
- `GET /api/monitoring/services/:id/incidents`
- `GET /api/monitoring/incidents`
- `GET /api/monitoring/dependencies`
- `POST /api/monitoring/services/:id/run-check`

All routes require authentication and System Health capability through the shared middleware. Manual checks additionally require the Admin role, shared CSRF protection, and a route-specific process-local rate limit; successful checks write a sanitized audit event. IDs and ranges are validated, and 404/error responses do not expose raw errors or targets.

## Frontend

The Phase 1 page fetches the summary/services compatibility shape, adapts API categories/statuses into existing sections, samples server buckets for the adjacent-block UI, polls every 30 seconds only while the document is visible, prevents overlap, and preserves range, filters, and scroll position. Loading, retry, stale-data warning, partial-error, empty, drawer, and manual-check states are supported. Dev ERP environment options are development and production only.

## Configuration

See `.env.example` for the complete safe server-only list. Core variables are `MONITORING_ENABLED`, concurrency/timeout/latency thresholds, incident thresholds, retention direction, scheduler tick, disabled keys, trusted app/API monitor URLs, optional safe provider status URLs, and worker heartbeat timestamps. Never rename them with a `VITE_` prefix or configure state-changing provider endpoints.

Coverage is calculated from enabled registry entries only. Put services that do not yet have a real, read-only signal in `MONITORING_DISABLED_SERVICES`; they remain visible for configuration but do not dilute the operational score. The summary reports `monitoringEnabled`, allowing the UI to distinguish a disabled scheduler from genuine low coverage.

## Retention and logging

`MONITORING_RETENTION_DAYS` documents the raw-history retention target (default 60 days). Destructive cleanup is intentionally not implemented in Phase 2. Structured monitoring logs contain service key, checker type, status, latency, retry count, and incident lifecycle metadata only. Secrets, targets, connection strings, auth headers, raw provider responses, and customer data are excluded.

## Known limitations and Phase 3

- Scheduler and manual rate limiting are process-local, not distributed.
- No WebSockets, alert delivery, pager escalation, SLA reports, maintenance windows, public status page, restart controls, AI root-cause analysis, log aggregation, or destructive retention cleanup.
- Worker heartbeats require existing infrastructure to publish timestamps; Phase 2 does not add Redis or queues.
- Provider status checks remain Unknown until a safe read-only status/synthetic target is configured.
- Phase 3 may add distributed leases, durable throttling, alert policies, maintenance windows, retention jobs, SLO/SLA reporting, and registry-managed heartbeat ingestion after separate security and infrastructure review.

## Manual deployment and verification

1. Review the additive migration SQL.
2. Back up the target database according to the normal deployment procedure.
3. Deploy the migration with the existing environment-specific Prisma deploy command; do not use development migration commands against production.
4. Keep `MONITORING_ENABLED=false` for the first application deploy and verify authenticated monitoring APIs/registry rows.
5. Configure only trusted server-side targets. Start with Dev ERP API/database and explicitly disable unsupported providers until a real signal exists.
6. Enable monitoring on one API instance, observe check creation and incident thresholds, and confirm no targets/secrets appear in responses or logs.
7. Test 1h/24h/7d/30d, hidden-tab polling pause, filters, drawer, non-admin denial, admin manual check/audit, dark mode, and mobile layout.
