# Stroane Environment Variables

## Frontend

- `VITE_BACKEND_BASE_URL`: optional browser-safe API base URL. Leave blank when using local fallback or same-origin API routing.

Do not place database URLs, Paystack secrets, Resend keys, auth secrets, service-role keys, or webhook signing values in `VITE_*` variables.

## Backend/API

- `NODE_ENV`: `development` or `production`.
- `APP_ENV`: `development` or `production`; used by Prisma/env resolution.
- `PORT`: backend server port.
- `CORS_ORIGINS`: comma-separated allowed browser origins.
- `TRUST_PROXY_HOPS`: trusted proxy hop count, usually `1` on Railway after verification.
- `STROANE_AUTH_SECRET`: backend-only signing secret for private admin/viewer sessions.

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

- `STROANE_WEB_BASE_URL`: public site URL.
- `STROANE_API_BASE_URL`: deployed API base URL when available.
- `STROANE_BACKEND_BASE_URL`: optional backend base URL alias for monitoring.
