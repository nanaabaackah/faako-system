# Travel With Ease — release readiness check

> 26 October: [public release and database compatibility update](./public-release-2026-10-26.md)
> supersedes the exact PostgreSQL 17 runtime requirement below. The detected server
> version is diagnostic; identity, runtime-role and migration checks still apply.

> Implementation update, 2026-10-25: [hosted startup correction](./hosted-startup-2026-10-25.md)
> supersedes the production API blanket block and startup release-SHA requirement
> below. Both hosted API environments require verified persistence and Access;
> SHA remains mandatory for publishing. Worker and live-acceptance gates remain.

Reviewed: 2026-10-25. Applies to the October 2026 website-and-staff-CMS
MVP. **Current decision: staging API activation is conditionally supported;
the complete MVP is not staging-accepted or production-certified.**

Use this checklist instead of earlier Phase 0/1 or pre-Access launch guards.
The records linked below remain valuable historical evidence, but their old
provider and deployment requirements must not be treated as active gates.
A passing local test or hosted database preflight never certifies the service.

## Gates by environment

| Gate | Checks to retain | Status |
| --- | --- | --- |
| Local foundation | Known APP_ENV; fail closed with production NODE_ENV; safe errors, database tests, local-only file/token adapters | Implemented in repository, subject to current CI |
| Staging API **startup** | NODE_ENV=production, APP_ENV=staging, exact HTTPS origins, Cloudflare Access configuration, independent staging AUD, organisation UUID, full reviewed release SHA, PostgreSQL 17 version/tenant/role/migrations and persistent Access sessions bound to the preflight receipt | Conditionally permitted by [24 October activation](./staging-activation-2026-10-24.md); **not** blanket-blocked |
| Staging **acceptance** | Working TLS/DNS and same-origin portal proxy, real Access MFA/allowlist, staff provisioning, denied/expired/revoked assertions, role/tenant/CSRF, alternate-host denial, safe storage/mail, monitoring and recovery evidence | Outstanding end-to-end; a DNS redirect or healthy DB is not enough |
| October MVP UAT | Approved public pages/packages, two enquiries with durable inbox and notifications, secure CMS/preview/publishing, journal, unified travel footprint map, WhatsApp click-to-chat, approved SEO/legal/consent and accessibility | Validate against the [October scope](./Travel_With_Ease_Solution_Roadmap.md#2-scope-and-exclusions); incomplete features remain blockers, not silent passes |
| Production API and workers | Production-specific resource isolation/Access, reviewed release, runtime role grants, live MFA/flows, encrypted backup/restore, operations/alerting, rollback and explicit approval | **Still blocked**; staging startup receipt is not production permission |

`preflight:hosted` performs **read-only** configuration/database checks.
It cannot prove MFA policy, route reachability, real identity, actual role grants
beyond its role flags, provider delivery, UAT, backup or a production release.
`/healthz` is liveness. `/readyz` is persistence readiness, not launch approval.

## Retained fail-closed guards

- Reject unknown `APP_ENV` and development/test adapters with
  `NODE_ENV=production`. Staging must not accept the legacy
  `TWE_AGENT_API_TOKEN` or `TWE_LOCAL_DATA_FILE` fallback.
- Require exact deployed HTTPS `ALLOWED_ORIGINS`, Access team issuer, one
  environment-specific Access AUD, portal origin, organisation ID and reviewed
  `TWE_RELEASE_SHA`. Remove nonempty legacy `TWE_OIDC_*` configuration.
- Keep database tenant/version/migration-checksum verification,
  non-superuser/non-BYPASSRLS runtime role tests and exact binding of the
  PostgreSQL repository/Access session store to the staging preflight receipt.
- Serve the hosted Vite portal from its **separate Express portal service**
  with the fixed server-only `TWE_PORTAL_API_ORIGIN`; hosted
  `VITE_API_BASE_URL` is empty to retain same-origin staff sessions.
  Continue verifying JWTs, local sessions, permissions, CSRF and tenant scope
  in the API itself; CORS/noindex cannot grant or replace authentication.
- Keep production API startup and background worker activation blocked
  pending their own reviewed release. Do not add bypass flags.

## Superseded checks — remove from active acceptance lists

| Historical requirement | Current decision |
| --- | --- |
| Refuse **all** staging API startups | Staging is permitted only after the documented verified preflight and adapter receipt; production is not. |
| Select a generic OIDC identity provider, configure `TWE_OIDC_*` callbacks, or require PKCE/ACR tests for the live deployment | Cloudflare Access JWT, independently enforced MFA, provisioned identities and persistent local sessions are authoritative. Retain historical OIDC tests only as compatibility/regression material, not deployment gates. |
| Deploy staff portal as static Cloudflare Pages with browser cross-origin API URL | Portal uses separate Express host/proxy; Astro public website hosting is unchanged. |
| Allow developer bearer token in a hosted staff UI | Local historical compatibility only; blocked for hosted API. |
| Treat estimator, exchange rates, full CRM, bookings, Paystack, invoices, itinerary/customer portal, AI and automated WhatsApp/social as October launch prerequisites | Deferred or separately scoped. Do not require their credentials/features to mark the agreed MVP complete. |
| Consider local PostgreSQL or synthetic auth tests sufficient for live readiness | Record observed staging Access/MFA, TLS, protected routing, R2/mail, recovery and UAT evidence. |

## Release operator sequence

1. Review TWE-only changes and exact SHA; compare applied SQL migration
   inventory with the release. Do not promote unrelated monorepo changes.
2. Configure isolated staging PostgreSQL, non-owner runtime role, Access
   application/AUD, portal/API origins, secret scopes and validated TLS.
   Execute migrations using the separate approved migration identity.
3. In the actual API host run
   `pnpm --filter @faako/travel-with-ease-api preflight:hosted`.
   Then start staging API; startup repeats verification before listening.
4. Start the hosted portal service, verify Access-protected shell, API
   `/healthz` and `/readyz`, same-origin forwarding, unauthorized and
   alternate-host denials, login/revocation/MFA/role separation.
5. Verify enabled enquiry/CMS/publication/media/notification flows, staging
   non-indexing, alert delivery, backup/restore and rollback evidence;
   record owner and client UAT approval. Do not record unobserved results.
6. Obtain separate production review/activation approval before changing
   startup policy, provider configuration, production DB or worker schedules.

## Evidence and source of truth

- [October solution scope](./Travel_With_Ease_Solution_Roadmap.md)
- [Staging activation, 24 October](./staging-activation-2026-10-24.md)
- [Cloudflare Access decision](./access-platform-admin-2026-10-23.md)
- [Hosted portal design](./portal-hosting-preparation-2026-10-23.md)
- [Staging operations](./staging-operations.md)
- Executable checks: `apps/travel-with-ease-api/src/portal/readiness.js`,
  `src/staging-startup.js`, `scripts/check-hosted-readiness.mjs`,
  `test/hosted-readiness.test.js` and `test/staging-startup.test.js`.

**This review changes the documentation of obsolete checks, not the
implemented fail-closed security controls.** No deployment or live provider
validation was carried out as part of the documentation review.
