# Hosted API startup correction — 2026-10-25

This implementation supersedes earlier statements that production API startup
is unconditionally blocked or that a release SHA is required to start the API.
It does not certify production acceptance or activate background workers.

## Changes and retained controls

- Both staging and production can start only after read-only database preflight.
  The process-local receipt binds environment, tenant, pool, persistent Access
  sessions, issuer, audience and exact allowed origins. Receipts cannot cross
  environments or be supplied as configuration flags.
- `TWE_RELEASE_SHA` is no longer an API startup prerequisite. The existing
  publication repository still refuses publishing without a valid reviewed SHA.
  Operators must configure the reviewed revision before enabling publication.
- Keep explicit `APP_ENV`, production `NODE_ENV`, HTTPS origins, Cloudflare
  Access, organisation identity, PostgreSQL 17, non-superuser/non-BYPASSRLS
  runtime role and exact migration checksums. These are not obsolete guards.
- No automatic migrations, staff grants, token fallback, database resets or
  environment bypasses were added. Worker/CLI activation remains separate.
- Typed preflight failures distinguish version, role, migration and organisation
  failures without logging credentials. Unclassified database failures remain
  redacted; inspect host configuration privately, never paste database URLs.

## Incident evidence

The supplied container log fails at the reviewed-release-SHA check, before
database readiness. It does not demonstrate missing database configuration.
Removing this misplaced gate permits subsequent checks, not a guaranteed start.

On 25 October, the staging portal passed HTTPS validation and redirected to
Cloudflare Access. The staging API passed TLS validation but returned Railway
HTTP 502. This indicates backend availability/routing trouble, not the earlier
certificate mismatch. A login redirect does not verify MFA or staff permissions.

## Release verification and rollback

Run API lint, build, unit tests and isolated PostgreSQL integration tests, then
require passing develop and main-promotion CI. No destructive test targets a
hosted database. Deploy migrations separately before dependent application code.
After deployment check liveness, persistence readiness and authenticated portal
flows on each environment; verify MFA, tenant/role denial and session revocation.
If a later database guard fails, correct the environment-specific configuration
or reviewed migration deployment instead of weakening that guard.

Rollback to the prior application revision and matching configuration if needed;
this change introduces no database migration. Prior code still requires the SHA
and blocks production startup. Keep operational release approval, backup/restore
evidence and client content approval separate from process startup.
