# Stroane Deployment Notes

## Current Hosting Direction

- Frontend: Cloudflare Pages.
- Backend/API: Railway service.
- Database: Railway Postgres.
- Domain/DNS: Cloudflare DNS/domain routing.

Do not assume Netlify for the current Stroane deployment. Railway is for the Stroane API/backend and database only.

## Cloudflare Pages Frontend

Run the build command from the monorepo root.

- Build command: `pnpm --filter @faako/stroane-web build`
- Output directory: `apps/stroane-web/dist`

Frontend environment variables:

- `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`

Cloudflare Pages bakes `VITE_*` values into the browser bundle at build time. After adding or changing `VITE_API_BASE_URL`, trigger a fresh Cloudflare Pages deploy before testing the live site.

Do not set `DATABASE_URL`, Paystack secrets, Resend keys, auth secrets, or webhook secrets in Cloudflare Pages.

## Railway API Service

Run commands from the monorepo root.

- Build command: `pnpm --filter @faako/stroane-web exec prisma generate`
- Start command: `pnpm --filter @faako/stroane-web start:api`
- Fallback start command if needed: `pnpm --filter @faako/stroane-web server:prod`

API environment variables:

- `DATABASE_URL=<Railway Postgres connection string>`
- `NODE_ENV=production`
- `APP_ENV=production`
- `PORT=<provided by Railway>`
- `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com`
- `TRUST_PROXY_HOPS=1` after confirming Railway proxy behavior
- `APP_AUTH_SECRET=<server-only secret>`

Payment/email provider variables, when enabled, belong on the Railway API service only.

Do not set `VITE_API_BASE_URL` on the Railway API service unless a future backend feature explicitly needs it. `VITE_API_BASE_URL` belongs on the Cloudflare Pages frontend.

The API also includes built-in CORS allow-list defaults for `https://stroanesolutions.com`, `https://www.stroanesolutions.com`, and Cloudflare Pages preview origins ending in `.pages.dev`. Keep `CORS_ORIGINS` set explicitly in Railway for production clarity; do not use `*` while credentials are enabled.

## Cloudflare DNS

Current recommended DNS setup:

- `stroanesolutions.com` -> Cloudflare Pages frontend
- `www.stroanesolutions.com` -> Cloudflare Pages frontend

The API currently uses the Railway public URL:

- `https://stroane-api-production.up.railway.app`

An `api.stroanesolutions.com` record can be considered later as a cleanup step, but it is not required for this phase.

## API Smoke Tests

After the API service deploys, test:

- `https://stroane-api-production.up.railway.app/health`
- `https://stroane-api-production.up.railway.app/api/catalogue/products`
- `https://stroane-api-production.up.railway.app/api/catalogue/categories`
- `https://stroane-api-production.up.railway.app/api/catalogue/products/<slug>`

Legacy read-only aliases should also remain available during rollout:

- `https://stroane-api-production.up.railway.app/api/products`
- `https://stroane-api-production.up.railway.app/api/categories`

If the storefront shows "Catalogue fallback active", open the browser console and confirm the logged public API base URL. A configured production build should call `https://stroane-api-production.up.railway.app/api/catalogue/products` and `https://stroane-api-production.up.railway.app/api/catalogue/categories`.

## Verification

Before promoting a deploy:

- Run `pnpm --filter @faako/stroane-web run build`.
- Run `pnpm --filter @faako/stroane-web exec prisma validate`.
- Confirm product images resolve under `/imgs/products/`.
- Confirm `/shop` and `/products/:id` still render from local fallback if the API URL is unavailable.
- Confirm Cloudflare Pages has only browser-safe `VITE_*` values.
- Confirm Railway API owns all server-only database/payment/email/auth secrets.
- Confirm any Cloudflare Pages environment change has been followed by a redeploy.
