# Stroane Environment Variables

## Frontend

- `VITE_API_BASE_URL`: primary browser-safe Stroane API base URL. Leave blank when using same-origin API routing or the local catalogue fallback.
- `VITE_BACKEND_BASE_URL`: legacy browser-safe API base URL fallback. Keep blank for new deployments unless an older build still depends on it.

Production Cloudflare Pages frontend:

- `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`

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

## Database

- `DATABASE_URL`: Railway Postgres URL for single-env deployments.
- `DATABASE_URL_DEVELOPMENT`: optional development database URL.
- `DATABASE_URL_PRODUCTION`: optional production database URL.

Use Railway Postgres for production. Prefer separate migration/runtime credentials where Railway setup allows it.

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

## Monitoring Metadata

Keep app-specific monitoring override names in private operations configuration, not in the public `.env.example`.
