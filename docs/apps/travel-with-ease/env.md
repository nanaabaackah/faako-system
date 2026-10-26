# Travel With Ease environment contract

> Implementation update, 2026-10-25: [hosted startup correction](./hosted-startup-2026-10-25.md)
> supersedes the production API blanket block and startup release-SHA requirement
> below. Both hosted API environments require verified persistence and Access;
> SHA remains mandatory for publishing. Worker and live-acceptance gates remain.

Current startup and environment decisions: [readiness check](./readiness-check.md),
[staging activation](./staging-activation-2026-10-24.md) and [portal hosting](./portal-hosting-preparation-2026-10-23.md).
The hosted Express portal uses server-only `TWE_PORTAL_API_ORIGIN` alongside
Access settings. Hosted `VITE_API_BASE_URL` must be **empty**.

Placeholders only; never commit values.

2026-10-23: executable staff authentication now uses `TWE_AUTH_MODE`,
`TWE_ACCESS_TEAM_DOMAIN`, `TWE_ACCESS_AUDIENCE` and `TWE_PORTAL_ORIGIN`.
`TWE_AUTH_MODE` must be `cloudflare_access`; nonempty historical `TWE_OIDC_*`
settings are rejected. Production and staging must use distinct Access applications.
The user confirmed the supplied AUD is **production**, not staging; private `.env`
files were not edited. See [setup and release gates](./access-platform-admin-2026-10-23.md).
The historical OIDC inventory below is not an active deployment contract.

## Required environment separation

| Concern | Local | Staging | Production |
| --- | --- | --- | --- |
| Website / portal / API | Local processes | Dedicated non-production deployments and origins | Approved live deployments and origins |
| Database | Isolated local/test data | Independent PostgreSQL and database credentials; synthetic data only | Independent PostgreSQL and least-privilege credentials |
| Storage / secrets | Development-only resources | Dedicated buckets, provider credentials and access policies; no production access | Independent media/private backup storage and server secrets |
| Email | Mock or capture sink | Sink or enforced recipient allowlist; no customer delivery | Approved sender and monitored delivery |
| Discovery / access | Local access | Review access restriction plus environment-specific `noindex`/`X-Robots-Tag`; no production sitemap submission | Approved canonical origin, robots and sitemap; protected staff portal |
| Purpose | Debugging and automated tests | Client review, integration and release acceptance | Approved live service, monitoring, backups and controlled rollback |

Never copy production customer records into local or staging. Staging identities must not be able to read production databases, objects or secrets. A different URL alone is not isolation. Robots directives are discovery controls, not access control. Verify the deployed HTML/headers and build-time frontend API origins independently in each environment.

**Current implementation (reviewed 2026-10-25):** runtime configuration validates development/test/staging/production and rejects unknown modes. The API now permits **staging only** with verified PostgreSQL 17/Access settings and a preflight-bound persistent adapter receipt. **Production API and background workers remain gated.** Web indexing requires both `PUBLIC_APP_ENV=production` and `PUBLIC_SITE_INDEXABLE=true`; default/staging builds are noindex with no sitemap. See the [current readiness check](./readiness-check.md) and [operations](./staging-operations.md).

Production readiness additionally requires monitoring/alert ownership, encrypted backups with restore evidence, approved migrations, recorded previous artifacts and rollback/forward-fix instructions. The branch-to-environment recommendation and release gates are in [design-engineering-standard.md](./design-engineering-standard.md#environments-git-and-deployment). No hosted resources or external deployment hooks were verified or changed by this alignment.

## Configuration inventory

The table records current/future variable names, not implemented capabilities. Public origins, API URLs, exact allowed origins and database credentials are required independently for both deployed environments once supported. Future payment/AI/currency capabilities remain subject to the October scope exclusions; their presence here does not approve launch use.

| Variable | Consumer | Required | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `PUBLIC_SITE_URL` | Web build | Production | No | Canonical public origin |
| `PUBLIC_API_BASE_URL` | Web browser | Production | No | Public API origin |
| `VITE_API_BASE_URL` | Portal browser | Local optional; hosted must be empty | No | Local dev API only; hosted portal uses same-origin proxy |
| `PORT` | API | No | No | Listen port |
| `APP_ENV` | API | Yes | No | Validated modes; staging requires verified startup preflight; production API remains blocked |
| `ALLOWED_ORIGINS` | API | Hosted | No | Comma-separated exact HTTPS allowed origins; include the configured portal origin |
| `DATABASE_URL` | API | Production | Yes | PostgreSQL connection URL |
| `TWE_MIGRATION_DATABASE_URL` | Migration CLI | PostgreSQL setup | Yes | Separate migration-role connection URL |
| `TWE_ORGANISATION_ID` | API / migrations | PostgreSQL mode | No | Server-owned UUID; must match persisted DB identity |
| `TWE_DATABASE_TLS` | API / migrations | No | No | Verified TLS by default; disable only for loopback development/test |
| `TWE_DATABASE_CA` | API / migrations | Provider-dependent | Yes | Trusted provider CA, not a TLS-verification bypass |
| `TWE_TEST_DATABASE_URL` | Integration tests only | test:db | Yes | Disposable loopback twe_test_* database |
| `TWE_LOCAL_DATA_FILE` | API | Development only | No | Local Phase 1 repository file |
| `TWE_TEST_PG_BIN` | Isolated test runner | test:db:isolated | No | Absolute PostgreSQL 17 bin directory; runner never consumes an application DB URL |
| `EXCHANGE_RATE_API_BASE_URL` | API | No | No | Provider endpoint override |
| `EXCHANGE_RATE_API_KEY` | API | Provider-dependent | Yes | Server-only provider credential |
| `EXCHANGE_RATE_CACHE_TTL_SECONDS` | API | No | No | Fresh cache duration |
| `EXCHANGE_RATE_TIMEOUT_MS` | API | No | No | Provider request timeout |
| `FIELD_ENCRYPTION_KEY_V1` | Future API | Before sensitive fields | Yes | Versioned application encryption key |
| `PRIVATE_DOCUMENT_BUCKET` | Future API | Before documents | No | Private object bucket name |
| `PAYSTACK_SECRET_KEY` | Future API | Before payments | Yes | Server initialise/verify/webhooks |
| `PAYSTACK_PUBLIC_KEY` | Payment UI | Before payments | No | Paystack client bootstrap only |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_APP_SECRET` | Future API | Before WhatsApp | Yes | Messaging/webhook verification |
| `AI_PROVIDER_API_KEY` | Future API | Before AI | Yes | Sanitised draft-generation requests |

Only variables intentionally prefixed `PUBLIC_` or `VITE_` enter browser builds. Provider secrets are API-only.

Additional implemented names (values belong in provider secret stores):

- Staff/Access: `TWE_AUTH_MODE=cloudflare_access`, `TWE_ACCESS_TEAM_DOMAIN`,
  `TWE_ACCESS_AUDIENCE`, `TWE_PORTAL_ORIGIN`; production and staging use
  different Access applications/AUDs. `TWE_PORTAL_API_ORIGIN` is a **portal
  process-only** upstream setting and never belongs in a browser bundle.
  Historical `TWE_OIDC_*` variables are **not** the current executable staff
  authentication contract and nonempty legacy values are rejected.
- Media: `TWE_R2_ACCOUNT_ID`, `TWE_R2_PRIVATE_BUCKET`,
  `TWE_R2_ACCESS_KEY_ID`, `TWE_R2_SECRET_ACCESS_KEY` (credentials secret).
- Notification worker: `TWE_RESEND_API_KEY` (secret), `TWE_EMAIL_FROM`,
  `TWE_EMAIL_RECIPIENT`, `TWE_EMAIL_TEST_RECIPIENTS`, `TWE_PORTAL_ORIGIN`.
- Publication: `TWE_RELEASE_SHA`, `TWE_PUBLIC_SITE_ORIGIN`,
  `TWE_PUBLIC_API_ORIGIN`. Build CLI sets private local `TWE_CONTENT_SNAPSHOT`,
  `TWE_BUILD_PUBLIC_DIR`, `TWE_BUILD_OUT_DIR`; never accept these from public API input.
- Web: `PUBLIC_APP_ENV`, `PUBLIC_SITE_INDEXABLE`; production indexing is explicit.

`TWE_AGENT_API_TOKEN` is no longer consumed by normal server startup or the portal.
Legacy factory-only compatibility tests do not constitute a deployed auth mode.
## Historical staff-assistance settings (retired)

`TWE_OIDC_RECOVERY_URL` and `TWE_OIDC_REGISTRATION_URL` belonged to the earlier
OIDC-provider design. Do not add them to current Access hosting configuration or
require them for launch. Staff onboarding, MFA recovery and disabled-account
operations follow the [Cloudflare Access runbook](./access-platform-admin-2026-10-23.md).
