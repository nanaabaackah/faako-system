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
configuration without folding Water into general REEBS readiness. It checks for
at least one organisation with a current GHS `waterProductConfig` row containing
Retail, Company and Bulk prices and one valid current Water discount rule in
`commercialConfiguration`. It does not read prices into the
response. A legacy `waterProductConfig` row is not sufficient. This is a global
probe: verify the actual signed-in organisation through its authorized Water
screen. Stock, historical cost completeness, migrations, providers and database
race/rollback behavior are not certified by this endpoint.

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

## Core Inventory and Rentals CSV import

The historical `scripts/imports/importProducts.js` importer remains evidence of
the production-era CSV mapping, but it is not approved for staging because its
reset mode truncates tables, it assumes an implicit organization, and it can
mix Water-linked rows into generic product imports.

Use the guarded staging importer instead. It reads the same Inventory, shop,
rental, machine, bouncy-castle and indoor-game CSV sources, preserves the
legacy SKU and price mapping, excludes every Water row, scopes writes to
`REEBS_PUBLIC_ORGANIZATION_ID`, records idempotent opening stock movements and
never deletes or overwrites an existing product. It only applies when both
`APP_ENV` and Railway's `RAILWAY_ENVIRONMENT_NAME` are `staging`.

Run the plan locally before deployment:

```bash
pnpm --filter @faako/reebs-portal run inventory:import:staging:plan
```

After the importer is deployed, run the apply command from the Railway staging
API service so Railway injects the staging database configuration:

```bash
pnpm --filter @faako/reebs-portal run inventory:import:staging:apply
```

If Inventory shows zero, first verify the Railway service uses the separate
staging database reference, then run this **read-only** check in that staging API
service (available after deploying the 2026-09-29 follow-up):

```bash
pnpm --filter @faako/reebs-portal run inventory:import:staging:check
```

It uses a read-only transaction and reports counts for CSV SKUs in the configured
organization, not credentials or individual product rows:

- `missingProducts`: items the apply command can insert.
- `existingZeroStockWithCsvStock`: existing items with zero stock but a positive
  historical CSV opening quantity. Apply deliberately leaves these unchanged;
  review their stock history before any correction, since zero may be legitimate.
- `currentMatchedStockUnits`: stock already present for those CSV SKUs. If this
  is positive while the Portal shows zero, check the logged-in organization,
  Inventory filters and the Portal's staging API connection.

The check refuses non-staging environments and cannot be combined with `--apply`.
The normal local `:plan` command remains offline and never writes to a database.
No import is automatically run on deploy, startup, or opening Inventory.

Before the new check command is deployed, the owner can obtain a count-only
snapshot from the **staging database's** query console. This does not change data
and does not expose customer records or credentials:

```sql
SELECT "organizationId",
       COUNT(*) AS items,
       COUNT(*) FILTER (WHERE stock > 0) AS items_with_stock,
       COALESCE(SUM(stock), 0) AS total_units
FROM "product"
GROUP BY "organizationId";
```

No rows means the product table is empty; rows with zero units mean existing
items have no recorded stock. Positive units under a different organization can
explain an empty scoped Portal view. These are stored product counts, not Water
stock, availability or financial metrics. Do not use a production query console.
The diagnostic follow-up's nine CSV/apply/read-only tests and changed-file lint
pass locally. The previously noted Travel With Ease security-gate blockers remain;
no deployment, push or live database operation was performed for this follow-up.

Then run `inventory:reconcile:staging` and verify Inventory, Rentals and the
public catalogue in staging. Do not set `IMPORT_RESET`; this importer has no
reset or production mode. Water stock and commercial configuration must be
seeded separately through the Water Business domain.

### Water customer search and import troubleshooting — 2026-09-28

The Water search's **Create** action now persists a customer immediately via
`POST /api/water` with `action: create_customer`; previously it only filled the
form and creation was deferred until a sale was recorded. The response selects
the saved identity in either the new-order form or the order editor. Failures
leave the typed name intact and show a retryable error. No sale or stock entry
is created by this action.

The API requires an authenticated owner/admin/Water operator with `water:write`,
uses the authenticated organization, accepts only name/phone identity fields,
and does not grant general Customers-module editing permissions. Duplicate
identities are reused without editing their details; archived matches require
administrator reactivation. Stock/cost writes remain owner/admin-only.

For a failed staging stock load, distinguish the guarded **Core CSV importer**
above from **Water Pricing & Restock**. The Core importer intentionally excludes
Water. Capture the command or Water action and the sanitized error/SQLSTATE code;
do not share connection URLs, environment values, cookies or authorization headers.
Do not retry a different importer, enable reset, or relax environment guards to
work around an unexplained failure.

Before any owner-run import, verify in Railway that the staging API's database
reference points to the separate staging database. Environment labels alone
cannot prove that a misconfigured database reference is safe. Mocked import tests
cover production/mismatched-environment rejection, explicit organization and
confirmation, scoped opening stock, no repeated stock on rerun, and rollback.
They do not certify the live staging schema, database reference or imported data.

No staging or production import, migration or database inspection was performed
for this code correction. The reported live import failure still needs its
sanitized error before a cause or successful fix can be claimed.

Local verification for this follow-up: 42 focused customer, Water and mocked
import tests passed; changed-file lint and the Portal production build passed
with environment-file loading disabled. Desktop (1280px) and mobile (390px,
isolated rerun after a cold-load timeout) browser scenarios passed for creation,
error/retry, persistence after reload and creation inside the order editor, with
all API calls mocked. The secret-safe scan passed. The global
security gate is separately blocked by Travel With Ease metadata (missing API/web
`appSystem.js`, and a missing Portal origin allowlist); those unrelated apps were
not modified by this fix. Deploy both the Water API and Portal changes to staging
before verifying the new creation behavior there.

This phase does not create Railway services, set variables, deploy code, or
apply any staging/production migration.
