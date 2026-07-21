# Stroane Environment Variables

## Local Development

Use the ignored `apps/stroane-web/.env.development` file for local frontend and
API values. `apps/stroane-web/.env.example` is a public reference only and is
never a runtime configuration file.

From the monorepo root, `pnpm run dev:stroane` first runs Stroane
`predeploy:local`, then starts both the Vite frontend and the API backend in
development mode. Vite loads `.env.development`, and the API loads
`.env.development` with development values taking precedence over any generic
`.env` fallback. Prisma commands with `APP_ENV=development` follow the same
precedence. The backend resolves its env files from `apps/stroane-web` itself,
so direct API launches are not dependent on the current shell directory.
For non-development local checks, the backend and Prisma config load
`.env.<APP_ENV>` when present; for example, `APP_ENV=staging node
backend/server.js` loads `.env.staging` after `.env`.

For the standard local setup, leave `VITE_API_BASE_URL=` blank in
`.env.development`. Vite proxies same-origin `/api` requests to the local API on
`http://localhost:3000`. Do not append `/api` to configured base URLs; the
frontend helpers append route paths themselves.

Private user seeding follows the same separation:

- `pnpm --filter @faako/stroane-web run db:seed` targets `.env.development`.
- `pnpm --filter @faako/stroane-web run db:seed:prod` targets production and
  must be run only after explicitly verifying the intended database.

## Frontend

- `VITE_API_BASE_URL`: primary browser-safe Stroane API base URL. Leave blank when using same-origin API routing or the local catalogue fallback.
- `VITE_BACKEND_BASE_URL`: legacy browser-safe API base URL fallback. Keep blank for new deployments unless an older build still depends on it.
- `VITE_APP_SURFACE`: `storefront` or `portal` in Cloudflare Pages. Leave blank locally to expose both route areas for development and Playwright compatibility.
- `VITE_STOREFRONT_BASE_URL`: public storefront origin.
- `VITE_PORTAL_BASE_URL`: private operational portal origin.

Production Cloudflare Pages storefront:

- `VITE_API_BASE_URL=https://api.stroanesolutions.com`
- `VITE_APP_SURFACE=storefront`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

Production Cloudflare Pages operational portal:

- `VITE_API_BASE_URL=https://api.stroanesolutions.com`
- `VITE_APP_SURFACE=portal`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

Staging Cloudflare Pages storefront:

- `VITE_API_BASE_URL=https://api-staging.stroanesolutions.com`
- `VITE_APP_SURFACE=storefront`
- `VITE_STOREFRONT_BASE_URL=https://stage.stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal-stage.stroanesolutions.com`

Staging Cloudflare Pages operational portal:

- `VITE_API_BASE_URL=https://api-staging.stroanesolutions.com`
- `VITE_APP_SURFACE=portal`
- `VITE_STOREFRONT_BASE_URL=https://stage.stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal-stage.stroanesolutions.com`

`VITE_*` values are compiled into each Cloudflare Pages bundle. Redeploy the
affected project after any change.

Do not place database URLs, Paystack secrets, Resend keys, auth secrets, service-role keys, or webhook signing values in `VITE_*` variables.

## Backend/API

- `NODE_ENV`: usually `development` locally and `production` on hosted API services.
- `APP_ENV`: `development`, `staging`, or `production`; used by Prisma/env resolution.
- `PORT`: backend server port.
- `CORS_ORIGINS`: comma-separated exact allowed browser origins. It is required for hosted production/staging; development alone receives known localhost defaults.
- `TRUST_PROXY_HOPS`: trusted proxy hop count, usually `1` on Railway after verification.
- `APP_AUTH_SECRET`: backend-only signing secret for private admin/viewer sessions.
- `STROANE_ADMIN_AUTH_COOKIE_NAME`: optional staff cookie name override. Defaults to `stroane_admin_session`.
- `STROANE_ADMIN_AUTH_COOKIE_SECURE`: set `true` in HTTPS production.
- `STROANE_ADMIN_AUTH_COOKIE_SAME_SITE`: usually `Lax`.
- `STROANE_ADMIN_AUTH_COOKIE_DOMAIN`: leave blank for host-only cookies unless a reviewed cross-subdomain workflow requires otherwise.
- `STROANE_CUSTOMER_AUTH_COOKIE_NAME`: optional customer cookie name override. Defaults to `stroane_customer_session`.
- `STROANE_CUSTOMER_AUTH_COOKIE_SECURE`: set `true` in HTTPS production.
- `STROANE_CUSTOMER_AUTH_COOKIE_SAME_SITE`: usually `Lax`.
- `STROANE_CUSTOMER_AUTH_COOKIE_DOMAIN`: leave blank for host-only cookies unless a reviewed cross-subdomain workflow requires otherwise.
- `STROANE_STOREFRONT_BASE_URL`: public storefront origin used to generate customer invite signup URLs and password reset URLs.
- `STROANE_LOCATION_SEARCH_ENABLED`: enables the backend delivery-address search proxy. Defaults to enabled unless explicitly set to `false`.
- `STROANE_LOCATION_SEARCH_URL`: backend-only geocoding/search endpoint. Defaults to OpenStreetMap Nominatim.
- `STROANE_LOCATION_COUNTRY_CODES`: optional comma-separated country-code filter for address search. Defaults to `gh`.
- `STROANE_LOCATION_SEARCH_USER_AGENT`: backend-only provider user agent/contact string for location search requests.

Production Railway API service:

- `DATABASE_URL=<Railway Postgres connection string>`
- `NODE_ENV=production`
- `APP_ENV=production`
- `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com,https://portal.stroanesolutions.com`
- `TRUST_PROXY_HOPS=1` after confirming Railway proxy behavior
- `APP_AUTH_SECRET=<rotated backend-only signing secret>`
- `STROANE_ADMIN_AUTH_COOKIE_SECURE=true`
- `STROANE_CUSTOMER_AUTH_COOKIE_SECURE=true`
- `STROANE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `STROANE_LOCATION_SEARCH_ENABLED=true`
- `STROANE_LOCATION_SEARCH_USER_AGENT="StroaneSolutions/1.0 (orders@stroanesolutions.com)"`

Staging Railway API service:

- `DATABASE_URL=<staging Railway Postgres connection string>`
- `NODE_ENV=production`
- `APP_ENV=staging`
- `CORS_ORIGINS=https://stage.stroanesolutions.com,https://portal-stage.stroanesolutions.com`
- `TRUST_PROXY_HOPS=1` after confirming Railway proxy behavior
- `APP_AUTH_SECRET=<staging-only server secret>`
- `STROANE_ADMIN_AUTH_COOKIE_SECURE=true`
- `STROANE_CUSTOMER_AUTH_COOKIE_SECURE=true`
- `STROANE_STOREFRONT_BASE_URL=https://stage.stroanesolutions.com`
- `PAYSTACK_ALLOW_LIVE=false`

Do not place `VITE_API_BASE_URL` in the Railway API service unless a future backend feature explicitly needs it. It belongs on the Cloudflare Pages frontend.

Delivery address search is intentionally proxied through the Stroane API at
`GET /api/location/search` so the browser does not receive provider endpoints,
provider keys, database credentials, or server-side request headers.

Set `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com,https://portal.stroanesolutions.com` on the Railway API service. The backend no longer trusts all `.pages.dev` hosts. If an owned Pages preview is needed for development, add that one exact origin to `CORS_ORIGINS`; do not use wildcard or suffix-based CORS with credentials.

Current staff authentication stores only staff profile metadata in portal-origin
`sessionStorage`; the credential is an HttpOnly staff cookie. Current customer
authentication stores only a non-secret profile shell in storefront
`sessionStorage`; the credential is an HttpOnly customer cookie. Keep both
cookies host-only by leaving the domain variables blank unless a specific
cross-subdomain workflow has gone through CSRF/subdomain-risk review.

Use `APP_AUTH_SECRET` for new Railway deployments. `STROANE_AUTH_SECRET` remains a compatibility fallback in the current backend only; rotate any secret that has been pasted into chat, screenshots, tickets, or logs.

## Database

- `DATABASE_URL`: Railway Postgres URL for single-env deployments.
- `DATABASE_URL_DEVELOPMENT`: optional development database URL.
- `DATABASE_URL_PRODUCTION`: optional production database URL.

Use Railway Postgres for production. Prefer separate migration/runtime credentials where Railway setup allows it.

The Railway API requires a database URL at startup. If no production connection string is configured, it exits with a safe configuration error instead of attempting to run without a Prisma Postgres adapter.

## Payment And Email

- `PAYSTACK_SECRET_KEY`: backend-only Paystack secret.
- `PAYSTACK_PUBLIC_KEY`: server-side config value; do not expose unless a future client-side integration explicitly needs it.
- `PAYSTACK_WEBHOOK_SECRET`: backend-only webhook signing value; can match Paystack secret behavior.
- `PAYSTACK_CALLBACK_URL`: public Cloudflare Pages `/checkout/return` URL.
- `PAYSTACK_CURRENCY`: expected currency, currently `GHS`.
- `PAYSTACK_ALLOW_LIVE`: keep false until live keys are intentionally approved.
- `RESEND_API_KEY`: backend-only email key.
- `ORDER_NOTIFICATION_FROM`: customer-safe sender.
- `ORDER_NOTIFICATION_REPLY_TO`: customer-safe reply-to.
- `CUSTOMER_ACCOUNT_EMAIL_FROM`: customer account/password reset sender.
- `CUSTOMER_ACCOUNT_EMAIL_REPLY_TO`: customer account/password reset reply-to.

## Inventory Owner Alerts

These values belong on the Railway API service only. Never add recipient details
or scheduler secrets to Cloudflare Pages or any `VITE_*` variable.

- `STROANE_ALERT_EMAILS`: comma-separated owner/admin email recipients for grouped low-stock, out-of-stock, and restocked summaries.
- `STROANE_ALERT_WHATSAPP_NUMBERS`: comma-separated owner/admin WhatsApp recipients. The current phase prepares provider-neutral WhatsApp messages but does not send them.
- `STROANE_ALERT_FROM`: optional operational alert sender, for example `Example Store Operations <alerts@example.com>`.
- `STROANE_ALERT_REPLY_TO`: optional operational alert reply-to.
- `STROANE_ALERT_COOLDOWN_MINUTES`: optional duplicate-attempt cooldown. Defaults to `720` minutes.
- `STROANE_ALERT_CRON_SECRET`: backend-only bearer secret for scheduled `POST /api/internal/inventory/alerts/check` calls.

Operational email delivery also requires `RESEND_API_KEY`. If recipient or
provider configuration is absent, the inventory scan still records a safe
skipped dispatch audit entry instead of failing stock updates.

## Monitoring Metadata

Keep app-specific monitoring override names in private operations configuration, not in the public `.env.example`.
