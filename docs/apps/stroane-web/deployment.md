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
- Static response headers: `apps/stroane-web/public/_headers`

Frontend environment variables:

- `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`

Cloudflare Pages bakes `VITE_*` values into the browser bundle at build time. After adding or changing `VITE_API_BASE_URL`, trigger a fresh Cloudflare Pages deploy before testing the live site.

Do not set `DATABASE_URL`, Paystack secrets, Resend keys, auth secrets, or webhook secrets in Cloudflare Pages.

`public/_headers` is copied into the built static assets and applies the Cloudflare Pages browser-security baseline. It allows the Railway API origin and the existing Paystack browser asset while keeping database, auth, and provider secrets out of the bundle. Stroane no longer depends on Netlify configuration.

## Railway API Service

Run commands from the monorepo root.

- Build command: `pnpm --filter @faako/stroane-web exec prisma generate`
- Pre-deploy migration command: `pnpm --filter @faako/stroane-web run db:deploy:prod`
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

Run the production migration command as a separate Railway pre-deploy/release step. Do not combine schema migration with the long-running start command. The existing migration set is forward-only and additive; verify the target Railway Postgres database before running it.

The API intentionally fails fast with a safe configuration message when no database URL is present. Public storefront resilience is provided by the Cloudflare frontend's local catalogue fallback, not by starting a partially configured API.

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

Protected supplier/inventory admin routes should be tested with a backend `SiteUser` bearer token, never from the public storefront bundle:

- `GET https://stroane-api-production.up.railway.app/api/admin/suppliers`
- `GET https://stroane-api-production.up.railway.app/api/admin/inventory`
- `GET https://stroane-api-production.up.railway.app/api/admin/inventory/movements`
- `GET https://stroane-api-production.up.railway.app/api/admin/products`

After the API routes pass, authenticate with a private backend `SiteUser` account and smoke test the protected frontend route:

- `https://stroanesolutions.com/admin/signin`
- `https://stroanesolutions.com/admin/inventory`
- `https://stroanesolutions.com/admin/suppliers`
- `https://stroanesolutions.com/admin/products`
- `https://stroanesolutions.com/admin/operations`

Confirm an `ADMIN` can record a test adjustment against a configured inventory item, confirm its before/after quantity in the activity view, edit one non-critical product media path/publishing draft, and confirm a `VIEWER` can read the dashboards without seeing write actions.

Legacy read-only aliases should also remain available during rollout:

- `https://stroane-api-production.up.railway.app/api/products`
- `https://stroane-api-production.up.railway.app/api/categories`

If the storefront shows "Catalogue fallback active", open the browser console and confirm the logged public API base URL. A configured production build should call `https://stroane-api-production.up.railway.app/api/catalogue/products` and `https://stroane-api-production.up.railway.app/api/catalogue/categories`.

The catalogue endpoint now keeps category and product sources coherent during rollout: persisted categories are returned only when persisted published products also exist. If Railway Postgres is only partially seeded, both public reads fall back to the normalized JSON seed until the production catalogue seed is intentionally run.

## Production Rollout Sequence

1. Confirm the intended Railway Postgres database and take a backup.
2. Set Railway API environment variables and run `pnpm --filter @faako/stroane-web exec prisma generate`.
3. Run `pnpm --filter @faako/stroane-web run db:deploy:prod`.
4. Start or redeploy the Railway API with `pnpm --filter @faako/stroane-web start:api`.
5. Confirm `/health`, catalogue endpoints, and unauthenticated rejection on `/api/admin/inventory` and `/api/admin/products`.
6. Set `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app` in Cloudflare Pages and trigger a fresh Pages deploy.
7. Confirm `/shop`, `/catalogue`, one product detail route, public customer `/signin`, private staff `/admin/signin`, authenticated `/admin/inventory`, and authenticated `/admin/products`.

If persisted catalogue rows should replace seed fallback, run the catalogue seed only after reviewing the target database:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue
```

The seed upserts catalogue records. Review existing active category rows before running it against production because rollout databases may still contain earlier category records.

## Verification

Before promoting a deploy:

- Run `pnpm --filter @faako/stroane-web run build`.
- Run `pnpm --filter @faako/stroane-web exec prisma validate`.
- Confirm product images resolve under `/imgs/products/`.
- Confirm admin product media edits accept only safe `/imgs/products/` paths and that draft/archived rows do not appear in public catalogue responses.
- Confirm `/shop` and `/products/:id` still render from local fallback if the API URL is unavailable.
- Treat the checked-in browser fallback as a public outage snapshot: when an existing fallback product is archived or should no longer be public, update that snapshot and redeploy Cloudflare Pages as part of the publishing change.
- Confirm Cloudflare Pages has only browser-safe `VITE_*` values.
- Confirm Cloudflare Pages serves the response headers from `public/_headers`.
- Confirm Railway API owns all server-only database/payment/email/auth secrets.
- Confirm any Cloudflare Pages environment change has been followed by a redeploy.
