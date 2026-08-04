# Analytics operations runbook

## Normal checks

1. Confirm `/health` identifies `faako-analytics` and read-only mode.
2. Confirm `/ready` succeeds; failure means authentication configuration is absent.
3. Trace a reported issue by request ID, application, tenant and analysis metadata.
4. Check whether the response was `good`, `warning` or `blocked` quality.
5. Check the source timestamp before treating output as current.

## Common incidents

| Symptom | Check | Safe response |
| --- | --- | --- |
| 401 | Caller credential/rotation and Authorization transport | Restore scoped credential; never print it |
| 403 | Path/header/body context and principal scopes | Correct producer scope; do not broaden tenant access as a shortcut |
| 422 | Producer contract/version | Fix producer or use documented adapter; do not bypass validation |
| 503 readiness | Authentication configuration | Restore configuration; keep consumers on fallback |
| Quality warning | Freshness/empty/incomplete checks | Show stale/limited state; refresh source |
| Quality blocked | Duplicate grain, invalid lifecycle or negative values | Suppress decision output and remediate source |
| Timeout/unavailable | Service/network/CPU | Use approved fallback; retry bounded safe requests only |

## Credential rotation

Add a new scoped caller secret, deploy/update the consumer, verify authorised/denied
tests, then remove the old secret. Rotate only the affected caller where possible.

## Backfills and batch jobs

No backfill or scheduler exists. Future backfills require a ticket with owner, tenant
scope, period, source version, idempotency key, expected row counts, quality checks,
rollback and an audit record. Never run an unreviewed script against production.

## Data-quality triage

Confirm intended grain, duplicate rate, freshness, invalid dates/negative values,
schema change and control totals. Record affected tenant/period and calculation version.
Do not edit analytical output manually to hide a source issue.

## Model artefacts

There are no trained models. If introduced later, operations must track model version,
training/evaluation periods, metric, artefact checksum/location, retraining cadence,
fallback and rollback.

## Local/CI validation

Use the service virtual environment and run Ruff, mypy and pytest. CI uses Python 3.12
without production credentials. Deterministic fixtures cover calculations, contracts,
empty/stale data and tenant isolation.

