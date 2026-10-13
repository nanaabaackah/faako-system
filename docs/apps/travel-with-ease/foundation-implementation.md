# Prompt 03 implementation record

Date: 2026-10-11. Status: **in progress, not staging-ready**.
Owner workstreams: TWE-005 (database), TWE-017 (staff/CMS/publishing),
TWE-022 (deployment/monitoring/data protection).

## Scope and sequence

The supplied Prompt 03 supersedes the earlier plan's allocation of CMS/media
editing and publication to Prompt 04. Those capabilities now belong to this
foundation task. Full public package/journal/map/enquiry screens remain Prompt 04.

1. Runtime safeguards and canonical API/browser contracts.
2. PostgreSQL schema, migrations, persistence and isolated integration tests.
3. Provider-neutral OpenID Connect, revocable server sessions and portal access.
4. Structured content revisions, protected preview, media and tracked publication.
5. Controlled hosting configuration, CI, backup/restore and manual staging setup.
6. End-to-end acceptance and the Prompt 03 completion report.

The user confirmed there is **no existing identity provider** and accepted a
provider-neutral OpenID Connect direction. No vendor, provider account, MFA
policy or live callback is configured. Login must remain unavailable until the
provider and staff identities are configured. No password/token workaround is
approved for hosted staff access.

## Implemented so far

- `src/config.js`: explicit environment/port/origin validation; reject unknown
  modes and production runtime with development/test adapters. Both executable
  and app factory reject staging/production while integration is incomplete.
- API request IDs reuse the shared validator; canonical safe JSON handles
  malformed, oversized and unexpected errors. The shared structured logger is
  wired without logging request bodies or raw exception text. API responses are
  noindex; this does not protect or noindex the static website.
- The local limiter has bounded client storage and expired-entry eviction.
  Proxy trust remains off. This is not distributed rate limiting or an assertion
  about Railway's proxy topology.
- Calendar validation rejects impossible dates; existing estimator contracts and
  money/currency logic are preserved.
- `pg` connection/transaction helpers enforce certificate verification outside
  explicit loopback development/test. A persisted database identity checks the
  environment and server-owned organisation. This is defence in depth, not a
  substitute for separate credentials and provider resources.
- Versioned `twe` schema and transactional advisory-locked migration runner;
  checksums reject changed, missing and out-of-order applied migrations. No
  automatic migrations at API startup. Historical `db/001_phase1.sql` unchanged.
- Optional local PostgreSQL compatibility repository writes legacy enquiry and
  notification-outbox rows atomically; reads are organisation-scoped and capped
  at 100. No notification delivery worker or new public enquiry interface yet.
- `/healthz` reports process liveness; `/readyz` returns 503 without configured,
  matching PostgreSQL/organisation. Readiness is persistence-only at this stage,
  not overall Prompt 03 readiness.
- Scoped GitHub workflow includes PostgreSQL 17 integration tests. No deployment
  jobs, hosting credentials or production promotion; workflow has not run remotely.

## Schema inventory

`twe.organisations`, `staff_users`, `staff_sessions`, `content_items`,
`content_revisions`, `media`, `content_media`, `enquiries`,
`notification_outbox`, `travel_activity`, `audit_records`, `publication_jobs`.
Migration infrastructure adds `environment_identity` and `schema_migrations`.
Packages/articles use typed `content_items.kind`, not duplicate content systems.

Cross-record foreign keys include organisation scope. Revision pointers also
include the owning content ID. Revision/audit update/delete triggers reject
ordinary mutation. Owners/superusers can still change schema/triggers: runtime
must not use the migration role. Country validation currently enforces a
two-letter format only; the future activity API must validate actual ISO codes.
JSON shape checks do not replace future per-domain input schemas. Schema
existence does not mean authentication/CMS/media/publishing works.

## Migration and local setup

Use an isolated empty PostgreSQL 17 database. No shared database is reset and no
existing CRM data is migrated implicitly. Configure secrets outside source
control. The API dev command loads its optional `.env` using Node's env-file
support; shell variables take precedence. The root `pnpm run dev:twe` is retained.

Required names for PostgreSQL: `APP_ENV`, `DATABASE_URL`,
`TWE_MIGRATION_DATABASE_URL`, `TWE_ORGANISATION_ID`, `TWE_DATABASE_TLS`;
`TWE_DATABASE_CA` for a provider-specific trusted CA where needed. Connection
URLs must not contain SSL query parameters that override explicit TLS policy.
Only loopback development/test may use `TWE_DATABASE_TLS=disable`.

```sh
pnpm --filter @faako/travel-with-ease-api run db:migrate --plan
pnpm --filter @faako/travel-with-ease-api run db:migrate --initialise
pnpm --filter @faako/travel-with-ease-api run db:migrate
pnpm --filter @faako/travel-with-ease-api run test:db
pnpm run dev:twe
```

`--plan` prints local file names/checksums only: it does not connect to the DB or
predict unapplied migrations. `--initialise` permits creating the `twe` schema
and identity only when that schema does not already exist; an existing schema
with missing/mismatched identity fails. Provision the organisation separately
before runtime readiness; no hardcoded business/admin identity is seeded.
Production migration additionally requires `--confirm-production`, but that
flag is **not release approval** and no production migration has been run.

`test:db` requires `APP_ENV=test` and `TWE_TEST_DATABASE_URL` identifying a
loopback database named `twe_test_*`. It fails rather than silently skips when
not configured. Fixtures are synthetic. Use a disposable cluster/database; tests
leave fixture rows and never reset shared state. CI creates a fresh service DB.

Recovery: failed migration transactions roll back together, including migration
history. Investigate with a privileged operator without exposing raw connection
errors in user logs. Never edit an applied migration or remove history to force
a retry. Before a deployed migration, take and verify an encrypted backup; on
failure retain the previous application artifact and forward-fix. Database
restore requires an approved isolated target/data-loss decision. A successful
`--plan` is not a restore or migration test.

## Dependency decision: pg 8.20.0

1. Required for durable PostgreSQL transactions in Prompt 03.
2. Already present in the monorepo lockfile; shared packages do not provide a DB
   driver. Do not import another application's database/session implementation.
3. Node has no native PostgreSQL driver; parameterised SQL is simpler here than
   adding an ORM and model generator.
4. Backend only; no accessibility change or browser fallback is required.
5. No browser bundle/hydration impact; five-connection pool with bounded waits.
   Installation reused cached packages; lockfile adds only TWE's importer entry.
6. MIT-licensed existing driver version, pinned; ongoing dependency review and
   migration/role operations are still necessary. No lifecycle scripts executed.
7. Durable atomic persistence justifies this server-only dependency.

Reference: [node-postgres transactions](https://node-postgres.com/features/transactions)
and [TLS configuration](https://node-postgres.com/features/ssl). A transaction
uses one checked-out client; URL SSL options must not overwrite verification.

## Verification and outstanding gates

API unit/HTTP regression tests: **16/16 passed** with permitted isolated
loopback access. Lint, current API syntax build, local migration inventory and
36-package workspace manifest validation passed. SQL integration is not yet
verified locally or in GitHub Actions. The integration suite intentionally
fails without its explicit test database; no mock is represented as PostgreSQL.

Homebrew PostgreSQL installation was attempted with approval but interrupted
when it proposed unrelated dependency upgrades/source builds. Homebrew updated
its package metadata/download cache. No PostgreSQL service was started; no
hosted database contacted. Existing local web/portal servers were not stopped.

Remaining implementation: full auth/session integration and tests, CMS/editor,
media upload/replacement/archive, static publication/preview lifecycle, responsive
portal, full environment/noindex configuration, controlled staging delivery and
backup/restore tooling/runbooks. Provider choice, external accounts, staff
provisioning, domain ownership, bucket/database identities, MFA/recovery and
staging deployment/verification remain external gates. No staging URLs verified.

Trello update draft (not posted): TWE-005/017/022 remain in progress; initial
safeguards and PostgreSQL code present, integration/hosting acceptance outstanding.
Dev ERP milestone draft (not posted): foundation implementation started;
no client-stage delivery or production readiness claimed. Prompt 04 is not ready.
