# Cloudflare Access and Faako platform administration

Status: local implementation; hosted security acceptance **not complete**.
Follow-up: [portal hosting preparation](./portal-hosting-preparation-2026-10-23.md)
implements the proxy described below. Live topology verification and API activation
remain pending; the results below describe the earlier authentication slice.
The user supplied an Access team domain and AUD and confirmed they are for
**production**. No production settings, identities, DNS, policies, databases or
deployments were changed. A distinct staging Access application is still required.

## ADR — provider and authority boundaries

Decision requested by the user on 2026-10-23: replace the proposed OIDC provider
with Cloudflare Access plus independent MFA. Retain PostgreSQL, local opaque
sessions, CSRF, revocation, tenant scoping and append-only audit records.
The executable now uses `access-config.js` and `access.js`. Historical `config.js`
and `oidc.js` under `src/auth/` remain isolated for regression/reference; they are
not imported by the executable. Nonempty `TWE_OIDC_*` settings fail Access startup.
No Auth0 setup, second deployed provider or password implementation is introduced.

The existing `assertLocalFoundation` guard remains unchanged. Configuration is not
evidence of policy enforcement. No environment variable may bypass this gate.

Before changes, the repository had working short server sessions, PKCE/state/nonce
regression tests, CSRF, revocation, active-user checks, five versioned migrations,
CMS/media and publication persistence. It lacked Access verification, platform role,
support grants and explicit route-level publishing permission. Existing TWE media
work and unrelated dirty TTNGH/shared-UI/lockfile changes were preserved.

## Permission matrix

| Capability | Platform Admin | Owner | Editor |
| --- | --- | --- | --- |
| Technical diagnostics / security-event references | Yes | No | No |
| Stage inactive Editor identity | Yes | Yes (active) | No |
| Activate/revoke Editors | Revoke only | Yes | No |
| Revoke local staff sessions/support grants | Yes | Editor status changes revoke sessions | No |
| Read/edit content and media | No | Yes | Yes |
| Publish/unpublish/retry publication | No | Yes | No |
| Read enquiries | Expiring support grant only | Yes | Yes |
| Approve/revoke support grants | No | Yes | No |
| Assign Owner or Platform Admin | Reviewed offline procedure only | No API permission | No |
| Provider ownership, billing, database credentials, other clients | Never conferred by an application role | Never conferred | Never conferred |

`src/auth/permissions.js` is the central policy, without role inheritance. Keep
policy app-owned; the framework-neutral decision shape can be extracted into an
existing Faako package only after a second real consumer and contract review.
Shared API contracts, security headers, audit, logger and React UI remain reused.

Platform provisioning cannot activate a second business identity. That prevents a
technical operator from manufacturing an Owner/Editor to bypass support approval.
The initial maintenance operation is session/support revocation, not shell/SQL
execution, arbitrary job replay, backup restoration or secret editing.

## Identity, sessions and origin protection

`jose` 6.2.12 (already in the workspace graph, now an explicit API dependency)
verifies RS256 against the configured team's `/cdn-cgi/access/certs`. Resolver
timeout is five seconds, refresh cooldown 30 seconds and cache maximum five minutes.
Issuer, single exact audience, JWT/app type, exp/iat/nbf, stable subject and identity
nonce are checked. Service-token shapes, missing/duplicate assertion headers,
malformed/oversized assertions and arbitrary issuers are rejected. No email header
is trusted. Application identity is `(organisation, issuer, subject, audience)`.

POST `/api/auth/access-session` requires an exact portal Origin, custom initiation
header and verified Access assertion. The cookie is HttpOnly, SameSite=Lax,
Secure on HTTPS and host-only; no tokens go into browser storage. Session expiry
is at most one hour and never exceeds the assertion expiry. Each protected request
requires the signed assertion **and** the same active local session/user binding.
A unique assertion hash prevents re-exchange after logout/revocation. Rotation or
expiry requires explicit reauthentication; a stolen Access bearer assertion alone
is not made non-replayable by signatures. Theft prevention still requires TLS,
secure edge routing and session hygiene. Hash binding does not replace MFA.

Logout revokes the local session before navigating to `/cdn-cgi/access/logout`.
Test application/global Access cookie behaviour in staging; local all-device
revocation is not a claim that all Cloudflare sessions were globally revoked.

`ALLOWED_ORIGINS` is CORS configuration, **not** an identity or ingress allowlist.
Do not add Railway aliases merely to make authentication work. Signed-JWT checks
remain mandatory at the Express origin even behind a proxy. Direct-origin requests
with forged headers cannot access private routes. Valid stolen credentials remain
a residual bearer-token risk; deploy network restrictions where available.

## Migrations, provisioning and elevation

Migration `006_access_roles.sql` replaces only the role check constraint, adds
nullable audience/session binding columns, and creates tenant-keyed support grants.
It does not delete users, reset data or email-link legacy identities. Legacy rows
retain null audiences and cannot sign into Access until explicitly remapped through
a separately reviewed identity migration. Do not edit applied migration checksums.
Roll forward is preferred; rolling back the constraint is unsafe while platform
rows or support references exist. Take a verified private backup before rollout.

`scripts/bootstrap-access-staff.mjs` is an administrative-shell operation using
`TWE_MIGRATION_DATABASE_URL`, environment/database identity checks, a verified live
assertion from stdin, independently pinned subject and approval reference. It accepts
only initial Owner/Platform Admin bootstrap and refuses an existing role. For the
developer it additionally checks the signed email against the requested identity;
email alone never grants access. It writes an audit event atomically and issues no
session. **It has not been run for any real identity.** Do not paste JWTs into chat,
terminal arguments/history, Trello or logs; use an approved non-echo input channel.

An Owner can grant `enquiries.read` to an active same-tenant Platform Admin for
1–30 minutes with a non-PII support ticket reference. The UI defaults to 15 minutes.
No self-approval, write access, content publishing or cross-tenant grant is allowed.
Each elevated read checks expiry/revocation and current approving Owner status and
persists an audit event before returning records. Revocation is available through
POST `/api/agent/administration/support-grants/:id/revoke`. Fine-grained per-record
support scope and an in-portal support-request queue are not implemented.

## Cloudflare configuration checklist (not yet verified)

1. TWE retains account/application ownership; Baaba uses delegated permissions.
   Do not make editors Cloudflare administrators. Confirm Free-plan suitability
   and feature availability in the actual account; no paid change is authorized.
2. In Zero Trust, configure One-time PIN explicitly and an exact staff-email
   allowlist. No Everyone, broad Bypass or staff service-token policy.
3. Access controls → Access settings → allow independent MFA using TOTP and/or
   WebAuthn. Require it on the staff application and every applicable policy.
   Inspect policy overrides; do not accept email PIN or inferred JWT claims as MFA.
4. Create separate self-hosted staging and production applications/audiences.
   Protect the portal shell and private API path; do not protect the public Astro
   site with the staff application. Restrict or disable alternate preview hosts.
5. Review the same-origin `portal.../api/*` proxy before hosting: fixed upstream,
   explicit endpoint/method allowlist, no arbitrary URL forwarding, no caching,
   preserved Access assertion and local cookie/CSRF headers, bounded request bodies,
   no secrets in browser bundles. This edge proxy is **not implemented/verified**
   by this slice. The existing Vite loopback proxy is development only.
6. Set server-only configuration names: `TWE_AUTH_MODE=cloudflare_access`,
   `TWE_ACCESS_TEAM_DOMAIN`, `TWE_ACCESS_AUDIENCE`, `TWE_PORTAL_ORIGIN`,
   `TWE_ORGANISATION_ID`, `DATABASE_URL`, and exact `ALLOWED_ORIGINS`.
   Keep `VITE_API_BASE_URL` empty for same-origin production portal calls. Do not
   configure a browser-facing Access token or copy a production AUD to staging.
7. Enroll authenticators in the team App Launcher under Account → MFA devices.
   Require another approved operator to verify identity before lost-factor resets;
   revoke local and Access sessions and review audit records first. Do not bypass
   MFA to recover an account. Recovery remains an account-admin procedure.
8. Verify staged login with MFA, denied/unprovisioned identities, disabled accounts,
   no-MFA policy denial, token expiry/rotation, logout and reauthentication, direct
   Railway/alternate-host denial, CSRF, headers and noindex. Record screenshots
   without cookies, JWTs, QR seeds or customer records. Only then review replacing
   the hosted-startup guard with evidence-backed readiness checks.

Official references reviewed: [Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[application token fields](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/),
[independent MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/),
[MFA policy precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/).

## Verification and outstanding acceptance

New synthetic tests cover cryptographic validation/key selection, role separation,
time-limited grants, signed-assertion/local-cookie binding, replayed exchange, CSRF
and origin-header forgery. Database tests add upgrade preservation, staging versus
activation, self-escalation denial, tenant denial, support audit/revocation and
assertion replay. Real MFA cannot be proved by mocked JWT tests.

No authenticated staging browser test or staging-login screenshot exists yet.
No production readiness, real developer provisioning or infrastructure access is
claimed. The separate staging Access app, reviewed edge proxy, target PostgreSQL 17
test run and live MFA/recovery/revocation acceptance remain release blockers.
Integration-secret editing, job repair and backup recovery remain controlled
operator runbooks, not unrestricted portal actions. Trello states are unchanged.

### Actual local results

- `node --test --test-reporter=spec apps/travel-with-ease-api/test/*.test.js`:
  **38/38 passed**, using synthetic identities and local HTTP servers.
- API lint; portal lint and production build: passed. No live deployment performed.
- The unchanged `test:db:isolated` runner correctly rejected the installed
  PostgreSQL 16.15 because the release target is PostgreSQL 17.
- A private temporary copy of that runner performed a **PostgreSQL 16 compatibility
  smoke check**, not target-version acceptance: migration upgrade preserved existing
  staff; role/provisioning/support/tenant tests passed; restart and logical restore
  preserved **16 tables / 63 rows**. Evidence directory:
  `/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-isolated-pg16-access-3Y24pN`.
  SHA-256: `7d679d1a8ed1101be7ab6c3a4bde6d9250e3e7e885b4199cf731849dd701f13c`.
  The fixture cluster was stopped; its synthetic backup is retained privately.
- No live MFA, actual JWKS network rotation, edge proxy or staging browser result
  is claimed. Crypto tests exercise signed key selection/rotation fixtures.

### Files inspected / changed for this slice

Inspected the API `src/auth/{config,oidc,routes,store}.js`, `src/{app,server,config,audit}.js`,
database repository/migration/connection code, migration 001–005, content/media
routes and services, notification/publication boundaries, portal `App.jsx`,
`WebsiteContent.jsx`, Vite configuration, package manifests and lockfile,
`packages/security/src/index.js`, and TWE architecture/security/environment and
staging documents. No private `.env` values were read or edited.

Added API `src/auth/{access-config,access,permissions,administration,administration-routes}.js`,
`db/migrations/006_access_roles.sql`, `scripts/bootstrap-access-staff.mjs`,
`test/access.test.js`; portal `src/{SystemAdministration,StaffAccess}.jsx`;
and this decision/runbook.

Modified API `src/{app,server}.js`, `src/auth/{routes,store}.js`,
`src/content/routes.js`, `src/media/routes.js`, `.env.example`, `package.json`,
`test/database-unit.test.js`, `test/integration/postgres.test.js`; portal `src/App.jsx`
and `src/WebsiteContent.jsx` (Owner-only publication controls);
the API importer in the already-dirty workspace lockfile; TWE documentation index,
architecture, security, environment, staging operations and progress log.
Other existing dirty files were not restored or staged.
