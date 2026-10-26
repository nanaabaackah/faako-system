# TWE staff portal hosting preparation

Superseded startup-gate status: [2026-10-24 staging activation](./staging-activation-2026-10-24.md)
implements staging-only API startup after preflight. Production remains blocked.

Status: local implementation; no deployment or hosting changes.

## Deployment decision

Retain React/Vite and the existing Access/PostgreSQL session model. Run a separate
Express portal process serving the Vite build and proxying staff requests. Server
code lives in `apps/travel-with-ease-api/src/portal/` to reuse existing server-only
dependencies and the Access verifier without bundling them into the frontend.
The portal process requires no database credentials. No new dependencies were added.

This supersedes the static-only portal hosting proposal: static hosting and Vite's
development proxy cannot provide hosted same-origin forwarding. Public Astro hosting
is unchanged, and the API and portal remain separate services.

## Controls and trade-offs

- Shell, assets and API routes require verified Access JWTs and the configured
  Host. Only `/healthz` is public: liveness is not authentication/database readiness.
- Explicit staff method/path allowlist; no public enquiries, legacy OIDC routes,
  unknown endpoints, arbitrary destinations, redirects or retries.
- Fixed HTTPS upstream. Forward only the assertion, original Origin, TWE session
  cookie, CSRF, existing request ID and media headers. Omit other cookies, bearer
  tokens, identity-email and forwarded-IP headers.
- API independently enforces verified identity, sessions, roles, tenants and CSRF.
  Shell access alone grants no application permissions.
- Requests: 32 KiB; image uploads: 8 MiB; responses: 16 MiB; upstream timeout: 15s.
- Private/no-store and noindex responses; shared security headers with a stricter
  same-origin CSP. No analytics. Errors use shared contracts; logs exclude tokens,
  cookies, bodies and upstream error details.
- Hosted builds reject nonempty `VITE_API_BASE_URL` to preserve same-origin sessions.

Trade-offs: API IP limits see the proxy address and may throttle staff collectively;
review edge limits rather than trusting arbitrary forwarded IPs. Access must enforce
independent MFA: JWT verification cannot prove the live policy. New API routes need
explicit proxy allowlist review. Static resources remain Access-protected.

## Staging configuration

2026-10-23 follow-up: the user supplied staging portal/API hostnames and a separate
Access AUD. They pass the local configuration validators and the audience differs
from production. Unauthenticated HTTPS checks outside the sandbox could not resolve
either hostname. Subsequent checks confirmed public portal DNS and an HTTP 302 to
the configured team's Cloudflare Access login. After the user's DNS correction,
authoritative and public DNS resolve the staging API through a Railway CNAME.
HTTPS verification now fails because the certificate does not cover the supplied
API hostname (`curl` error 60). TLS validation was not bypassed. Live MFA, backend routing
and hosting variables are not yet verified. No supplied values were written into
private environment files or hosting.

Create a separate staging Access application/AUD with exact staff allowlist and MFA.
Do not reuse the supplied production AUD. Supply staging portal/API hostnames and
Access identifiers; keep credentials in hosting secrets, not chat or tracked files.

Portal service, monorepo root working directory:

- `RAILWAY_WORKSPACE=@faako/travel-with-ease-portal` selects `railway:build` and
  `railway:start` through the existing root wrapper.
- `NODE_ENV=production`, `APP_ENV=staging`, empty `VITE_API_BASE_URL` at build time.
- Server-only: `TWE_AUTH_MODE`, `TWE_ACCESS_TEAM_DOMAIN`, `TWE_ACCESS_AUDIENCE`,
  `TWE_PORTAL_ORIGIN`, `TWE_PORTAL_API_ORIGIN`; hosting supplies `PORT`.
- No database, migration, R2, bootstrap or email credentials on this service.
- Protect all portal paths with Access; Cloudflare handles `/cdn-cgi/access/logout`.
  Alternate host requests are rejected except minimal liveness.
- Upstream is a distinct HTTPS API origin accepting the original staff assertion.
  Do not add a service token or bypass API JWT validation to make forwarding work.

API: matching staging Access identifiers/portal origin, separate database credentials
and exact allowed origins. Apply migration 006 through the existing reviewed process
with backup and environment/tenant checks; never migrate from portal startup.

With the API's hosting environment configured, run
`pnpm --filter @faako/travel-with-ease-api preflight:hosted` as a read-only check.
It requires `TWE_RELEASE_SHA`, production Node mode, explicit hosted environment,
Access settings, portal origin, organisation scope and `DATABASE_URL`. It rejects
local token/file adapters, a wrong database identity/version, superuser/BYPASSRLS
runtime roles, missing tenant and mismatched migration checksums. It does not prove
least privilege beyond those role flags, validate live Access policy, change data
or disable the startup guard. The command deliberately does not load a local `.env`.

## Remaining release gates (reconciled 2026-10-25)

1. Review TWE-only changes, PostgreSQL 17 evidence and exact release SHA. Do not
   deploy the mixed worktree wholesale or assume a dated local test is hosted proof.
2. Configure separate staging Access/MFA, database and hosts; verify actual TLS,
   Access policy, proxy routing and alternate-host protection.
3. **Staging API startup guard review completed 2026-10-24:** the API now accepts
   a successful read-only PostgreSQL/Access preflight and binds the receipt to
   persistent adapters. The guard remains active for production. Run
   `preflight:hosted` in the actual staging host, then verify startup repeats it.
4. Deploy staging with approval; test real login/provisioning, MFA, expiry,
   revocation, logout/re-login, role/tenant separation, uploads, CSRF and recovery.
5. Complete the functional MVP, alert and backup/restore evidence, then review
   production promotion separately. Back up before migrations, keep the previous
   release/maintenance option and prefer reviewed forward-fix when role changes
   make restoring old constraints unsafe. See [readiness check](./readiness-check.md).

No real staff bootstrap, live MFA acceptance, Railway/Cloudflare/database change or
Trello state change was performed by this preparation.

## Changed implementation files

- API: `src/portal/proxy.js`, `src/portal/server.js`, `src/portal/readiness.js`,
  `scripts/check-hosted-readiness.mjs`, `test/portal-proxy.test.js`,
  `test/hosted-readiness.test.js`, `package.json` scripts.
- Portal: `package.json` hosting scripts, `vite.config.js` build guard,
  `.env.example` variable names and same-origin default.
- TWE documentation: this decision/runbook, architecture, environment contract,
  README, staging operations, Access handoff and progress log.

No application dependencies or lockfile entries were changed in this preparation.

## Verification status

- Final API suite: 42/42 passed, including proxy and read-only preflight tests.
- API lint, portal lint/typecheck/test and staging-configured portal build passed.
- A hosted build with a nonempty cross-origin API URL was correctly rejected.
- Workspace manifests passed; registry check completed with the existing REEBS Water
  metadata warning. `git diff --check` passed.
- PostgreSQL 17.11 installation completed. The existing fresh-cluster drill **passed**:
  migration/tenant/auth tests, restart persistence and logical backup/restore;
  16 tables and 63 synthetic rows matched. The temporary server was stopped and
  its private evidence retained. No existing application database was modified.
  Homebrew created its default local cluster but no persistent service was started;
  the existing PostgreSQL 16 linking was preserved. Reproduce using
  `TWE_TEST_PG_BIN=/usr/local/opt/postgresql@17/bin pnpm --filter @faako/travel-with-ease-api test:db:isolated`.
  Evidence: `/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-isolated-pg17-wt2UDK`.
  Fingerprint: `b3dc044f1fd87545a4ec8c0a13ba1aaf8db0ecf6c4641187034c1afe0ddf2004`.
