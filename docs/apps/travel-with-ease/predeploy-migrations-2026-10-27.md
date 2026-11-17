# TWE pre-deployment migrations — 27 October 2026

## Decision

Keep the existing versioned SQL migrations; do not introduce Prisma or a permanent
migration service. Railway's pre-deploy hook runs inside the private network before
starting the replacement API. Failure blocks deployment without retrying the hook.
See [Railway pre-deploy documentation](https://docs.railway.com/deployments/pre-deploy-command).

The hook and API share service variables. Separate database users provide permission
separation, **not secret isolation**: the migration credential remains available in
the service environment. For stronger isolation use a separately scoped release job.
Never expose either credential to the website or portal.

## Configure staging first

In the TWE API Railway service only, keep repository root as the working directory
and select `/apps/travel-with-ease-api/railway.json` as the config file. Alternatively
set its pre-deploy command to `pnpm --filter @faako/travel-with-ease-api db:deploy`,
and retain the normal API start command. Do not apply this file to the portal service.
This repository change alone does not update the Railway dashboard setting.

Required service variables:

- `APP_ENV`: staging first; production configured independently after approval.
- `NODE_ENV`: production.
- `TWE_MIGRATION_APPROVED_ENV`: exactly the target APP_ENV. This deliberately
  opts that environment into applying reviewed migrations on deployment.
- `DATABASE_URL`: restricted runtime login.
- `TWE_MIGRATION_DATABASE_URL`: separate migration login with schema/table ownership
  and permission to grant access, on the **same private hostname, port and database**.
- `TWE_DATABASE_CA`: complete trusted CA PEM for that environment.
- `TWE_DATABASE_TLS`: require. Certificate and hostname verification stay enabled.
- `TWE_ORGANISATION_ID`: approved environment-specific UUID, matching API configuration.
- First deployment only: `TWE_DB_INITIALISE` true and `TWE_ORGANISATION_NAME` set
  to the approved name. Remove/disable initialisation after successful setup.

Create the runtime login once through the database administrator. It must be a
simple lowercase role name, with no superuser, BYPASSRLS, CREATEDB, CREATEROLE,
replication, inherited roles, database/schema/table ownership or schema CREATE.
Configure its password privately in the runtime URL; never commit credentials.
The pre-deploy hook does not create roles, generate passwords or provision staff.

## What runs

1. Validate explicit environment approval, organisation identity, verified TLS,
   distinct role names and matching connection endpoints. No local .env is loaded.
2. Acquire the existing transaction-scoped migration lock. Refuse wrong environment,
   tenant, modified history and out-of-order migrations. Create a fresh schema only
   with explicit initialisation. Apply pending SQL atomically.
3. During explicit initialisation, insert the organisation if absent and append an
   audit event. Existing names/data are not overwritten; repeats are idempotent.
4. Validate the existing runtime role and grant only the enumerated permissions in
   `src/db/runtime-grants.js`, in the same transaction. No default privileges or
   grants on future tables. Append-only records receive SELECT/INSERT, metadata
   SELECT, operational tables SELECT/INSERT/UPDATE and auth flows SELECT/INSERT/DELETE.
   Existing extra grants are not automatically revoked; review the role's grants
   before adoption. Application permission and tenant enforcement remain authoritative.
5. Reconnect with the runtime credential, verify environment/tenant/organisation,
   migration inventory and role flags, then check operational-table reads. Startup
   independently rechecks readiness. The reported PostgreSQL version is not pinned.

Runtime credentials, permissions and Access configuration must be valid before the
API can start. A passing migration is not proof of live login, MFA or release acceptance.

## Failure and rollback

Configuration failures now report a stable reason and fixed corrective guidance,
without logging connection strings, passwords, certificate contents or raw error
objects. For example, `migration_approval_mismatch` identifies
`TWE_MIGRATION_APPROVED_ENV`; `database_endpoint_mismatch` identifies the two
connection URLs; `runtime_url_options_forbidden` identifies query/fragment options
in `DATABASE_URL`. Correct the named setting on the Railway **API service**:
editing a local .env does not change hosted variables. `TWE_DATABASE_TLS=require`
is accepted. Configuration-phase failure precedes any database queries; it is not
evidence of a network outage or missing tables. Unexpected errors remain redacted.
No guards were removed or relaxed by this diagnostic change.

Migration, organisation and grant failures roll back their shared transaction.
A later runtime-readiness failure blocks release but **does not undo committed
migrations**. Correct configuration/grants; do not reset the database. Existing
migrations are additive but review compatibility and backup/restore before each
release. Roll back application revisions only when compatible with the applied
schema; use reviewed forward migrations for schema repair.

The old `db:migrate` operator command is retained unchanged. The initial `--plan`
lists local migration files only; it is not a live dry run. No hosted database was
modified while developing this hook.


## Production migration incident: safe diagnostics (2026-11-15)

A production deployment supplied a screenshot with the pre-deploy hook failing
during migrations as `database_unavailable`. This is a catch-all response,
not evidence by itself that PostgreSQL is offline. A CA/TLS configuration
change was attempted, but a successful connection was not established or
verified from the screenshot.

The deployment hook now classifies a *small fixed allowlist* of root-cause codes
without logging database URLs, usernames, hostnames, SQL text, certificate
contents, password values, driver error messages or stack traces. The next
deployment log will distinguish:
- `database_tls_hostname_mismatch` / `database_tls_trust_failed`
- `database_dns_unavailable` / `database_connection_failed`
- `database_authentication_failed` / `database_missing`
- `database_permission_denied` / `database_object_missing`
- `database_initialisation_required`, identity/history/order mismatch,
  other `database_sql_error`, and finally `database_unavailable`.

The fix is diagnostic only; it does not alter migrations, SSL verification,
runtime privilege checks, database credentials, rollout commands or state.
It cannot disclose the original error object, and it does not auto-retry,
change user roles, initialise or reset anything. Production deployment and
the actual root cause remain separate, not claimed as fixed.

### Browser-only triage

In Railway's browser dashboard, open the TWE project → Production → TWE_API →
Deployments → failed deployment → Deploy logs. After a reviewed deployment
including this diagnostics change, search for `migration.predeploy_failed`
and report only its fixed `reason` category and `phase`.
Do not share database URLs, PEM private keys or credential-containing logs.

Verify Production PostgreSQL exists and is healthy. Check the API service's
production Variables panel for the *presence* (not values) of
`TWE_MIGRATION_DATABASE_URL`, `DATABASE_URL`,
`TWE_DATABASE_TLS=require`, `TWE_DATABASE_CA`,
`TWE_ORGANISATION_ID`, `TWE_MIGRATION_APPROVED_ENV=production`,
and `TWE_DB_INITIALISE`. Runtime and migration URLs must target the same
database while using separate roles. Do not enable `TWE_DB_INITIALISE=true`
unless the database is verified empty and the initialisation is approved.

A failing production API must never be hidden by bypassing verification or
using staging credentials. The unrelated public website holding page can be
deployed independently through Cloudflare Pages.
