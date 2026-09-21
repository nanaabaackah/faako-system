# REEBS staging runtime contract

This document defines the runtime contract for the REEBS API. Staging and
production use the same production-style Node runtime, while `APP_ENV` keeps
their data, provider, CORS, logging, and safety policies distinct.

## Authoritative environments

| Runtime | `APP_ENV` | `NODE_ENV` | Database migration command |
| --- | --- | --- | --- |
| Local development | `development` | `development` | `prisma migrate dev` for schema work; local startup uses `migrate deploy` |
| Railway staging | `staging` | `production` | `prisma migrate deploy` |
| Railway production | `production` | `production` | `prisma migrate deploy` with the existing production approval guard |

`APP_ENV` is authoritative. It recognizes exactly `development`, `staging`,
and `production`. A production-style Node process without an explicit
`APP_ENV`, or an unknown `APP_ENV`, fails closed. `NODE_ENV=production` on
staging is intentional and only controls production-style Node/build behavior.

Deployed runtimes use platform-injected variables. They do not load local
dotenv files. Never copy production credentials into staging.

## Railway commands

Configure the REEBS staging API service from the monorepo root:

```text
Build command: node ./scripts/railway-service.mjs build
Start command: node ./scripts/railway-service.mjs start
```

Set `RAILWAY_WORKSPACE` to `@faako/reebs-portal`. The workspace resolves these
commands to `railway:build` and `railway:start`. Neither command assigns
`APP_ENV`; Railway owns that value. Startup generates Prisma Client, runs
`prisma migrate deploy`, and then starts `backend/server.js`.

Set `RAILWAY_WORKSPACE` before the first build. The shared monorepo launcher
has a fallback for other Faako services, so a missing workspace selection can
build the wrong application.

For the recommended separate-project setup and the production-safe cutover
sequence, see [RAILWAY_PROJECT_MOVE.md](./RAILWAY_PROJECT_MOVE.md).

## Staging variable names

Required by the Railway service command or API process for the first staging
deployment:

- `RAILWAY_WORKSPACE`
- `APP_ENV`
- `NODE_ENV`
- `DATABASE_URL`
- `USER_APP_SECRET`

`RAILWAY_WORKSPACE` is consumed by the monorepo Railway command, not by the API
process itself. The API startup validator requires `DATABASE_URL` and
`USER_APP_SECRET` after `APP_ENV=staging` selects the deployed safeguards.

Required for staging portal/storefront browser traffic, but not merely for the
API process to start or for `/ready` to pass:

- `REEBS_PORTAL_URL`
- `REEBS_WEBSITE_URL`
- `CORS_ORIGINS_STAGING`

Required when the corresponding staging workflow is exercised:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `BREVO_API_KEY`
- `EMAIL_FORCE_TO`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `EMAIL_NOTIFICATIONS_ENABLED`
- `MANAGER_APP_SECRET`
- `MANAGER_PIN_HASH`
- `WATER_MOMO_WEBHOOK_SECRET`
- `RAILWAY_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_MANAGER_PHONE`

Required only while creating the first administrator in an empty staging
organization:

- `REEBS_ADMIN_BOOTSTRAP_ENABLED`
- `REEBS_ADMIN_BOOTSTRAP_SECRET`

Set the enable flag to `true` and use a unique secret of at least 32 characters.
The login page exposes the setup form only while the configured public
organization has no users. After creating the first administrator, remove the
secret and set the enable flag back to `false`. Later accounts use single-use,
72-hour invitations created by an authorized portal administrator; invitees set
their own password on the login page. Raw invitation tokens are returned once
and stored only as SHA-256 hashes.

Optional operational controls are documented by name in `.env.example`.
For a copy-ready placeholder inventory separated by API, portal, and storefront
scope, use [RAILWAY_STAGING_VARIABLES.example.txt](./RAILWAY_STAGING_VARIABLES.example.txt).

## Database safety

- Staging must have its own Railway Postgres database and its own
  environment-scoped `DATABASE_URL`.
- Staging never falls back to `DATABASE_URL_PRODUCTION`.
- `migrate dev` and `migrate reset` are blocked in staging and production.
- Production `migrate deploy` retains the existing Railway/explicit-approval
  guard.
- Seed endpoints are disabled in both deployed environments, even when
  `SEED_ENABLED` is set.
- No migration is run merely by a build. The start command runs the deployed
  migration path immediately before the API starts.

## CORS

Authenticated endpoints never use wildcard CORS. Development retains local
origins, production retains the published REEBS origins, and staging begins
with no implicit local or production frontend origins. Configure the staging
portal and website origins through `CORS_ORIGINS_STAGING` and the corresponding
REEBS URL variables.

## Paystack

The server-only `PAYSTACK_SECRET_KEY` selects Paystack test or live mode.
Staging must use a Paystack test credential; production must use a live
credential. Startup blocks an obvious live-key assignment in staging and an
obvious test-key assignment in production. No Paystack secret belongs in a
`VITE_*` variable.

## Email and other providers

Staging email is fail-safe: when email is enabled, `EMAIL_FORCE_TO` must name a
controlled sink/test recipient. Without that policy, staging email is skipped
instead of being sent to the requested customer address. Production does not
force recipients. Provider credentials remain environment-supplied and are
not selected from `NODE_ENV`.

For password-reset email testing, configure `EMAIL_NOTIFICATIONS_ENABLED`,
`BREVO_API_KEY`, `EMAIL_FORCE_TO`, `EMAIL_FROM`, and `EMAIL_REPLY_TO`, then
redeploy the API. `EMAIL_NOTIFICATIONS_ENABLED` must be `true`, and the sender
identity in `EMAIL_FROM` must be accepted by the staging Brevo account. Every
staging reset message is delivered to `EMAIL_FORCE_TO`, not to the account's
personal email. The API logs only safe delivery events and reason codes:
`auth.password_reset.email_unavailable`, `auth.password_reset.email_skipped`,
`auth.password_reset.email_sent`, or `auth.password_reset.email_failed`.

Before enabling any other outbound provider in staging, confirm that its
credential and destination belong to staging and cannot contact live customers
unintentionally.

Provider credentials are not general API startup or readiness dependencies.
Missing Paystack, Brevo, manager, Water webhook, Railway webhook, maps, OpenAI,
or WhatsApp configuration affects only the corresponding feature. Brevo email
delivery and staging email without `EMAIL_FORCE_TO` are skipped safely;
provider-backed operations that require a missing credential fail within that
feature without making `/ready` fail.

## Logging and health

Structured backend logs include `APP_ENV`, so staging and production events
are distinguishable without logging credentials. The health routes remain:

- `/live`
- `/ready`
- `/health/water`

They return service/readiness/build metadata only. They do not expose database
URLs, provider credentials, or Water financial values. Water remains a
standalone business domain; the Water health route only verifies database and
Water commercial-configuration readiness.

`/live` confirms only that the Node process can answer HTTP. `/ready` performs
one database `SELECT 1` through the health connection pool and returns `503`
when it cannot complete. It does not check Paystack, Brevo, email routing,
manager access, webhooks, maps, OpenAI, WhatsApp, or Water configuration.
`/health/water` separately checks the database and the Water commercial
configuration record without folding Water into general REEBS readiness.

## First staging deployment checklist

1. Create a separate Railway project for REEBS, then create persistent
   `staging` and `production` environments inside it.
2. In the staging environment, connect the API service to `develop` and give it
   a separate staging Postgres service.
3. Configure the required variable names above with staging-specific values.
4. Keep staging email disabled until a controlled `EMAIL_FORCE_TO` is set.
5. Use Paystack test credentials only.
6. Confirm `CORS_ORIGINS_STAGING` contains only approved staging frontends.
7. Run the build command, then the start command.
8. Verify `/live`, `/ready`, and `/health/water` without displaying provider or
   database configuration.
9. Exercise login, Paystack test checkout, and email-sink delivery manually.

This phase does not create Railway services, set variables, deploy code, or
apply any staging/production migration.
