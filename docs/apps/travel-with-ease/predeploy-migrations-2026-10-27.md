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

Migration, organisation and grant failures roll back their shared transaction.
A later runtime-readiness failure blocks release but **does not undo committed
migrations**. Correct configuration/grants; do not reset the database. Existing
migrations are additive but review compatibility and backup/restore before each
release. Roll back application revisions only when compatible with the applied
schema; use reviewed forward migrations for schema repair.

The old `db:migrate` operator command is retained unchanged. The initial `--plan`
lists local migration files only; it is not a live dry run. No hosted database was
modified while developing this hook.
