# Staging API activation — 2026-10-24

Status: implemented locally; not deployed. Supersedes the blanket staging API
startup prohibition in the October 23 handoffs. Production API, notification
worker and publication CLI activation remain blocked pending live acceptance.

## Decision

The PostgreSQL 17 migration/restart/restore drill and local Access/proxy tests now
pass. Permit **staging only** after mandatory runtime preflight, so live acceptance
can be performed without enabling production or removing authentication controls.
No provider, session, schema or public URL changes are introduced.

The executable validates explicit hosted configuration, then performs read-only
database checks before listening: PostgreSQL 17, environment/tenant identity,
non-superuser/non-BYPASSRLS role, exact migration inventory/checksums and organisation
existence. Missing configuration, local file/token settings or failed checks stop
startup. Database preflight failures are logged without driver error details.

`prepareStagingStartup` issues an in-process receipt held in a private WeakMap;
the synchronous application factory accepts it only with the same PostgreSQL pool,
tenant, repository, Access-backed persistent session store, issuer, audience,
secure portal origin and allowed origins. This preserves the existing synchronous
factory contract while requiring asynchronous database verification first. A JSON
object or environment flag cannot manufacture a receipt. This guards accidental
misconfiguration, not malicious server code. Backend permissions/CSRF/JWT validation
remain mandatory on every private request.

## Operator sequence

1. Prepare a reviewed TWE-only release. The current branch/worktree also contains
   unrelated changes; do not publish it wholesale.
2. Configure the staging API's `APP_ENV`, `NODE_ENV`, `ALLOWED_ORIGINS`,
   `TWE_AUTH_MODE`, `TWE_ACCESS_TEAM_DOMAIN`, `TWE_ACCESS_AUDIENCE`,
   `TWE_PORTAL_ORIGIN`, `TWE_ORGANISATION_ID`, `TWE_RELEASE_SHA`, `DATABASE_URL`
   and verified database TLS settings. Use the supplied staging audience only.
   Remove local file/token and legacy OIDC variables. Never use a production DB.
3. Apply reviewed migration 006 with the separate migration credential after
   backup and identity checks. Runtime must use a separate non-superuser role;
   passing role-flag checks is not proof of complete least-privilege grants.
4. Run `pnpm --filter @faako/travel-with-ease-api preflight:hosted` in that hosting
   environment. This command does not load a local `.env` or change the database.
5. Deploy the API using `pnpm --filter @faako/travel-with-ease-api start` (or the
   existing Railway wrapper with the API workspace selected). Confirm `/healthz`
   and `/readyz`. Startup repeats the preflight even if the standalone command passed.
6. Deploy the portal using the [portal hosting handoff](./portal-hosting-preparation-2026-10-23.md).
   Keep its build-time API URL empty and server-only upstream configured.
7. Bootstrap approved staff through the audited command with independently verified
   subject/issuer and approval reference. Do not grant privileges based on email alone.
8. Verify actual Access allowlist/MFA, login, role separation, CSRF, expiry,
   revocation, logout/re-login, direct-origin denial and recovery in staging.
   Production promotion remains a separate reviewed change after this evidence.

No MFA claim follows from a successful preflight. The most recent external API
check validated HTTPS but returned Railway HTTP 502. That does not establish which
code is deployed or why its backend failed; deployment logs are still needed for
that diagnosis. The user reports working production login; this local work does
not claim to be the code currently running there.

## Files and verification

- Added `src/staging-startup.js` and `test/staging-startup.test.js` in the API.
- Updated API `src/server.js`, `src/app.js`, `src/auth/routes.js`, `.env.example`
  and `scripts/check-hosted-readiness.mjs`.
- API tests: 43/43 passed. API lint passed. Rejection tests cover unverified/forged
  receipts, production use, local bearer credentials, wrong adapters, different
  pool/tenant/audience/origins and unavailable database. Readiness tests separately
  cover database version, identity, role and migration mismatch.
- PostgreSQL 17.11 isolated drill rerun passed: migrations/auth/tenant tests,
  restart persistence and backup/restore matched 16 tables and 63 synthetic rows.
  Evidence: `/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-isolated-pg17-evTH3G`;
  fingerprint `56dc13763c8e4149258fd25623479080690b4d3f60371c74ae73b3a73ce4af33`.
  The temporary server was stopped. Startup receipt wiring is unit-tested with
  synthetic adapters; a deployed end-to-end login is still pending.
- No deployment, migration of a real database, bootstrap, secret changes, commits,
  pushes or Trello state changes were performed.
