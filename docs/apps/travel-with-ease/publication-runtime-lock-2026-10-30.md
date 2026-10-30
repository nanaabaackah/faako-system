# Publication runtime lock correction

User reported staging Privacy publication returning the generic service error.
Code inspection found a deterministic privilege mismatch in enqueue/retry/confirm:
`SELECT ... FROM twe.organisations ... FOR UPDATE` needs UPDATE privilege, but
`grantRuntimeAccess()` deliberately grants only SELECT on organisations.
See [PostgreSQL SELECT privileges](https://www.postgresql.org/docs/current/sql-select.html).
This is a concrete matching defect; the specific hosted request was not traced
because no request ID or authenticated provider logs were available.

Use a transaction advisory lock keyed by application + environment + organisation
instead. It releases on commit/rollback and preserves tenant-specific serialization
without granting organisation UPDATE, ownership or DDL privileges. Existing unique
active-publication index, immutable manifests, explicit Owner permission, tenant scope,
reviewed SHA and verified-deployment confirmation remain unchanged. No migration.
Advisory locks: [official PostgreSQL reference](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

Expanded integration coverage runs the full publication lifecycle under
`SET ROLE twe_test_runtime`, explicitly verifies no organisation UPDATE, and adds
Privacy save/enqueue/confirm/audit and cross-tenant denial. Previous tests exercised
publication with migration-owner credentials and therefore missed this mismatch.
Unit lock-key separation test passed. The local restricted-role integration rerun
was not approved; required isolated CI must pass before merge. Do not label the
new regression integration verified until that check completes.

Publication request is still a queue, not automatic deployment. The reviewed
`TWE_RELEASE_SHA` and established build/deploy/marker-confirm process remain required.
This fix neither publishes unreviewed policy content nor removes pending-job guards.
After deploying to staging, an authorised Owner must retry Privacy publication and
record its job/deployment status; if another error occurs capture the request ID.
