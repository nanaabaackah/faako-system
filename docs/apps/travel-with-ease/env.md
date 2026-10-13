# Travel With Ease environment contract

Placeholders only; never commit values.

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

**Current implementation (2026-10-11, Prompt 03 in progress):** explicit runtime validation now recognises development/test/staging/production and rejects unknown modes. Both executable and app factory refuse staging/production while deployed adapters remain incomplete; the staging bypass is closed. Optional local PostgreSQL persistence, migration tooling and database identity checks are implemented but SQL integration remains unverified. See [foundation implementation](./foundation-implementation.md). The web layout still emits `index, follow`; static staging indexing protection is outstanding.

Production readiness additionally requires monitoring/alert ownership, encrypted backups with restore evidence, approved migrations, recorded previous artifacts and rollback/forward-fix instructions. The branch-to-environment recommendation and release gates are in [design-engineering-standard.md](./design-engineering-standard.md#environments-git-and-deployment). No hosted resources or external deployment hooks were verified or changed by this alignment.

## Configuration inventory

The table records current/future variable names, not implemented capabilities. Public origins, API URLs, exact allowed origins and database credentials are required independently for both deployed environments once supported. Future payment/AI/currency capabilities remain subject to the October scope exclusions; their presence here does not approve launch use.

| Variable | Consumer | Required | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `PUBLIC_SITE_URL` | Web build | Production | No | Canonical public origin |
| `PUBLIC_API_BASE_URL` | Web browser | Production | No | Public API origin |
| `VITE_API_BASE_URL` | Portal browser | Production | No | API origin |
| `PORT` | API | No | No | Listen port |
| `APP_ENV` | API | Yes | No | Validated development/test/staging/production; both deployed modes remain blocked pending integration |
| `ALLOWED_ORIGINS` | API | Production | No | Comma-separated exact web/portal origins |
| `DATABASE_URL` | API | Production | Yes | PostgreSQL connection URL |
| `TWE_MIGRATION_DATABASE_URL` | Migration CLI | PostgreSQL setup | Yes | Separate migration-role connection URL |
| `TWE_ORGANISATION_ID` | API / migrations | PostgreSQL mode | No | Server-owned UUID; must match persisted DB identity |
| `TWE_DATABASE_TLS` | API / migrations | No | No | Verified TLS by default; disable only for loopback development/test |
| `TWE_DATABASE_CA` | API / migrations | Provider-dependent | Yes | Trusted provider CA, not a TLS-verification bypass |
| `TWE_TEST_DATABASE_URL` | Integration tests only | test:db | Yes | Disposable loopback twe_test_* database |
| `TWE_LOCAL_DATA_FILE` | API | Development only | No | Local Phase 1 repository file |
| `TWE_AGENT_API_TOKEN` | API + manually entered in development portal | Development only | Yes | Temporary staff gate; forbidden as production auth |
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
