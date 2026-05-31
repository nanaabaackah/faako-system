# Stroane Environment Variables

## Local Development

Use the ignored `apps/stroane-web/.env.development` file for local frontend and
API values. `apps/stroane-web/.env.example` is a public reference only and is
never a runtime configuration file.

From the monorepo root, `pnpm run dev:stroane` starts both the Vite frontend and
the API backend in development mode. Vite loads `.env.development`, and the API
loads `.env.development` with development values taking precedence over any
generic `.env` fallback. Prisma commands with `APP_ENV=development` follow the
same precedence.

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

- `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`
- `VITE_APP_SURFACE=storefront`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

Production Cloudflare Pages operational portal:

- `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`
- `VITE_APP_SURFACE=portal`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

`VITE_*` values are compiled into each Cloudflare Pages bundle. Redeploy the
affected project after any change.

Do not place database URLs, Paystack secrets, Resend keys, auth secrets, service-role keys, or webhook signing values in `VITE_*` variables.

## Backend/API

- `NODE_ENV`: `development` or `production`.
- `APP_ENV`: `development` or `production`; used by Prisma/env resolution.
- `PORT`: backend server port.
- `CORS_ORIGINS`: comma-separated allowed browser origins.
- `TRUST_PROXY_HOPS`: trusted proxy hop count, usually `1` on Railway after verification.
- `APP_AUTH_SECRET`: backend-only signing secret for private admin/viewer sessions.

Production Railway API service:

- `DATABASE_URL=<Railway Postgres connection string>`
- `NODE_ENV=production`
- `APP_ENV=production`
- `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com,https://portal.stroanesolutions.com`
- `TRUST_PROXY_HOPS=1` after confirming Railway proxy behavior
- `APP_AUTH_SECRET=<rotated backend-only signing secret>`

Do not place `VITE_API_BASE_URL` in the Railway API service unless a future backend feature explicitly needs it. It belongs on the Cloudflare Pages frontend.

Set `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com,https://portal.stroanesolutions.com` on the Railway API service for explicit production config. The backend also allows these origins by default and supports Cloudflare Pages preview origins ending in `.pages.dev`; do not use wildcard CORS with credentials.

Current staff authentication stores a short-lived bearer token in
portal-origin `sessionStorage`. There is no Stroane parent-domain auth cookie to
configure. If cookie sessions are introduced later, prefer secure, HTTP-only,
host-only cookies and complete a CSRF/subdomain-risk review first.

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
