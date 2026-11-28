# Environment-variable inventory

This records names and ownership only. Values, provider identifiers, tokens and
customer data must remain in their environment's provider secret store.

## Provider and reference values

| Name | Classification | Decision |
| --- | --- | --- |
| `PORT` | Railway-provided hosted; local override | Consume provider value in hosted services. |
| `RAILWAY_GIT_COMMIT_SHA` | Railway-provided | Authoritative hosted Git identity for API/worker publication checks; do not copy manually. |
| `CF_PAGES`, `CF_PAGES_COMMIT_SHA`, `CF_PAGES_BRANCH`, `CF_PAGES_URL` | Pages-provided build metadata | Use when build/deployment evidence requires it; do not create manual duplicates. |
| `DATABASE_URL` | Railway service reference; secret | Runtime-role connection for the correct environment. |
| `TWE_MIGRATION_DATABASE_URL` | Railway service reference/composed secret | Separate migration role; retain because runtime DDL is forbidden. |
| `TWE_DATABASE_TLS` | Redundant hosted override | Omit in Railway; verified TLS is the application default. `disable` is loopback-only. |
| `TWE_DATABASE_CA` | Conditional secret | Omit unless provider evidence requires a private CA. Never use a verification bypass. |

## Server runtime and identity

| Names | Scope |
| --- | --- |
| `NODE_ENV`, `APP_ENV` | Runtime mode; exact hosted value required. |
| `ALLOWED_ORIGINS`, `TWE_PORTAL_ORIGIN`, `TWE_PORTAL_API_ORIGIN`, `TWE_PUBLIC_SITE_ORIGIN`, `TWE_PUBLIC_API_ORIGIN` | Exact environment origins; portal upstream is server-only. |
| `TWE_ORGANISATION_ID` | Server-owned organisation UUID; must match database identity. |
| `TWE_AUTH_MODE`, `TWE_ACCESS_TEAM_DOMAIN`, `TWE_ACCESS_AUDIENCE` | Cloudflare Access assertion verification; distinct staging/production AUDs. |
| `TWE_SETUP_OPERATOR_SUBJECT` | Optional one-time bootstrap identity; remove after handover. |
| `TWE_ENQUIRY_CONTINUATION_SECRET` | Environment-specific signing secret, server-only. |
| `TWE_TURNSTILE_SECRET_KEY` | Server-side challenge verification secret. |
| `TWE_RESEND_API_KEY`, `TWE_EMAIL_FROM` | Notification worker transport and approved sender. |
| `TWE_R2_ACCOUNT_ID`, `TWE_R2_ACCESS_KEY_ID`, `TWE_R2_SECRET_ACCESS_KEY`, `TWE_R2_PRIVATE_BUCKET` | Private media storage; not a browser or database-backup contract. |
| `TWE_GOOGLE_SERVICE_ACCOUNT_JSON`, `TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID` | Approved media import only. |
| `EXCHANGE_RATE_API_BASE_URL`, `EXCHANGE_RATE_API_KEY`, `EXCHANGE_RATE_CACHE_TTL_SECONDS`, `EXCHANGE_RATE_TIMEOUT_MS` | Optional server-side display-rate provider and bounds. |

## Migration, one-time and worker values

| Names | Scope |
| --- | --- |
| `TWE_MIGRATION_APPROVED_ENV` | Pre-deploy guard; must equal the reviewed `APP_ENV`. |
| `TWE_DB_INITIALISE`, `TWE_ORGANISATION_NAME` | First-time setup only; remove/disable after successful initialisation. |
| `TWE_PROMOTION_ACTOR_ID` | One-time production content promotion actor; must be an active production privileged user. |
| `TWE_NOTIFICATION_BATCH_SIZE`, `TWE_NOTIFICATION_POLL_INTERVAL_MS` | Worker tuning, if configured; bounded defaults remain code-owned. |
| `TWE_PUBLICATION_*` operator/worker settings | Publication provider/origin controls; use only names documented in the executable example and publication runbook. |

## Browser/build and local/test values

| Names | Scope |
| --- | --- |
| `PUBLIC_SITE_URL`, `PUBLIC_API_BASE_URL`, `PUBLIC_APP_ENV`, `PUBLIC_SITE_INDEXABLE`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_GA_MEASUREMENT_ID` | Public build values only; anything with these prefixes is observable by browsers. |
| `VITE_API_BASE_URL` | Local portal development only; hosted portal leaves it empty and uses same-origin proxying. |
| `TWE_LOCAL_DATA_FILE` | Local development repository. |
| `TWE_TEST_DATABASE_URL`, `TWE_TEST_PG_BIN` | Disposable PostgreSQL tests only. |
| `TWE_CONTENT_SNAPSHOT`, `TWE_BUILD_PUBLIC_DIR`, `TWE_BUILD_OUT_DIR` | Private publication-build process values, never public input. |

Historical `TWE_OIDC_*`, `TWE_AGENT_API_TOKEN`, `TWE_EMAIL_RECIPIENT` and
`TWE_EMAIL_TEST_RECIPIENTS` are not active hosted contracts. Remove stale provider
entries after a value-free review confirms no rollback dependency. Do not delete
provider variables based only on this document.
