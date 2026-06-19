# Stroane Deployment Notes

## Current Hosting Direction

- Frontend: Cloudflare Pages.
- Backend/API: Railway service.
- Database: Railway Postgres.
- Domain/DNS: Cloudflare DNS/domain routing.

Railway is for the Stroane API/backend and database only.

## Cloudflare Pages Frontends

Deploy two Cloudflare Pages projects from the same workspace so public and
operational hostnames have explicit surfaces. Run the build command from the
monorepo root for both projects.

- Build command: `pnpm --filter @faako/stroane-web build`
- Output directory: `apps/stroane-web/dist`
- Static response headers: `apps/stroane-web/public/_headers`

Public storefront project environment variables:

- `VITE_API_BASE_URL=https://api.stroanesolutions.com`
- `VITE_APP_SURFACE=storefront`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

Operational portal project environment variables:

- `VITE_API_BASE_URL=https://api.stroanesolutions.com`
- `VITE_APP_SURFACE=portal`
- `VITE_STOREFRONT_BASE_URL=https://stroanesolutions.com`
- `VITE_PORTAL_BASE_URL=https://portal.stroanesolutions.com`

Cloudflare Pages bakes `VITE_*` values into the browser bundle at build time. After adding or changing `VITE_API_BASE_URL`, trigger a fresh Cloudflare Pages deploy before testing the live site.

The storefront surface lazy-loads portal code only in localhost compatibility
mode. Production storefront browsers do not fetch ERP shell or admin workflow
chunks. The portal surface loads the private operational shell without mounting
storefront cart/customer providers.

Do not set `DATABASE_URL`, Paystack secrets, Resend keys, auth secrets, or webhook secrets in Cloudflare Pages.

`public/_headers` is copied into the built static assets and applies the Cloudflare Pages browser-security baseline. It allows the Railway API origin and the existing Paystack browser asset while keeping database, auth, and provider secrets out of the bundle.

## Railway API Service

Run commands from the monorepo root.

- Railway workspace env: `RAILWAY_WORKSPACE=@faako/stroane-web`
- Build command: `node ./scripts/railway-service.mjs build`
- Pre-deploy migration command: `pnpm --filter @faako/stroane-web run db:deploy:prod`
- Start command: `node ./scripts/railway-service.mjs start`
- The root Railway launcher resolves the workspace and runs the app's Prisma generation/start scripts.

API environment variables:

- `DATABASE_URL=<Railway Postgres connection string>`
- `NODE_ENV=production`
- `APP_ENV=production`
- `PORT=<provided by Railway>`
- `CORS_ORIGINS=https://stroanesolutions.com,https://www.stroanesolutions.com,https://portal.stroanesolutions.com`
- `TRUST_PROXY_HOPS=1` after confirming Railway proxy behavior
- `APP_AUTH_SECRET=<server-only secret>`
- `STROANE_ADMIN_AUTH_COOKIE_SECURE=true`
- `STROANE_CUSTOMER_AUTH_COOKIE_SECURE=true`
- `STROANE_STOREFRONT_BASE_URL=https://stroanesolutions.com`

Payment/email provider variables, when enabled, belong on the Railway API service only.

Inventory-owner alert configuration also belongs on the Railway API service
only:

- `STROANE_ALERT_EMAILS=<comma-separated private recipients>`
- `STROANE_ALERT_WHATSAPP_NUMBERS=<comma-separated private recipients>` for provider-neutral preparation only
- `STROANE_ALERT_COOLDOWN_MINUTES=720`
- `STROANE_ALERT_CRON_SECRET=<rotated backend-only scheduler bearer secret>`
- Optional: `STROANE_ALERT_FROM`, `STROANE_ALERT_REPLY_TO`

Operational email sending requires `RESEND_API_KEY`. Do not add alert recipient
details or cron secrets to Cloudflare Pages.

Do not set `VITE_API_BASE_URL` on the Railway API service unless a future backend feature explicitly needs it. `VITE_API_BASE_URL` belongs on the Cloudflare Pages frontend.

The API also includes built-in CORS allow-list defaults for `https://stroanesolutions.com`, `https://www.stroanesolutions.com`, `https://portal.stroanesolutions.com`, and Cloudflare Pages preview origins ending in `.pages.dev`. Keep `CORS_ORIGINS` set explicitly in Railway for production clarity; do not use `*` while credentials are enabled.

Current staff auth stores only staff profile metadata in portal-origin
`sessionStorage`; the credential is an HttpOnly staff cookie. Current customer
auth stores only a non-secret profile shell in storefront `sessionStorage`; the
credential is an HttpOnly customer cookie. Leave cookie domain overrides blank
for host-only cookies unless a reviewed cross-subdomain workflow requires a
parent-domain cookie and CSRF protection has been added.

Run the production migration command as a separate Railway pre-deploy/release step. Do not combine schema migration with the long-running start command. The existing migration set is forward-only and additive; verify the target Railway Postgres database before running it.

The API intentionally fails fast with a safe configuration message when no database URL is present. Public storefront resilience is provided by the Cloudflare frontend's local catalogue fallback, not by starting a partially configured API.

If protected portal reads return `503` with `Database schema is not ready`, run
`pnpm --filter @faako/stroane-web run db:status:prod`, apply
`pnpm --filter @faako/stroane-web run db:deploy:prod` if migrations are pending,
then redeploy or restart the Railway API. Prisma `P2021`/`P2022` errors are
reported as schema-readiness failures without exposing database details. If the
migration status is already current, restart the API so it reloads the intended
environment and regenerated Prisma client before investigating schema drift.

## Cloudflare DNS

Current recommended DNS setup:

- `stroanesolutions.com` -> Cloudflare Pages frontend
- `www.stroanesolutions.com` -> Cloudflare Pages frontend
- `portal.stroanesolutions.com` -> Cloudflare Pages operational portal project

The public browser-facing API origin is:

- `https://api.stroanesolutions.com`

Railway remains the backend/API host behind that custom domain.

## API Smoke Tests

After the API service deploys, test:

- `https://api.stroanesolutions.com/health`
- `https://api.stroanesolutions.com/api/catalogue/products`
- `https://api.stroanesolutions.com/api/catalogue/categories`
- `https://api.stroanesolutions.com/api/catalogue/products/<slug>`

Protected dashboard data routes should be tested after authenticating with a backend `SiteUser` account, never from the public storefront bundle. Active portal modules read protected APIs for product, supplier, inventory, movement, alert, order, receipt, accounting, and customer signals:

- `GET https://api.stroanesolutions.com/api/admin/suppliers`
- `GET https://api.stroanesolutions.com/api/admin/inventory`
- `GET https://api.stroanesolutions.com/api/admin/inventory/movements`
- `GET https://api.stroanesolutions.com/api/admin/products`
- `GET https://api.stroanesolutions.com/api/admin/inventory/alerts`
- `GET https://api.stroanesolutions.com/api/admin/orders`
- `GET https://api.stroanesolutions.com/api/admin/receipts`
- `GET https://api.stroanesolutions.com/api/admin/accounting/overview`
- `GET https://api.stroanesolutions.com/api/admin/customers`

After configuring a Railway cron/scheduler with the private bearer secret, test:

- `POST https://api.stroanesolutions.com/api/internal/inventory/alerts/check`

The scheduler route is intentionally server-to-server only. Store the bearer
secret in Railway scheduler configuration and rotate it if it is ever pasted
into chat, screenshots, tickets, or logs.

After the API routes pass, authenticate with a private backend `SiteUser` account and smoke test the protected frontend routes:

- `https://portal.stroanesolutions.com/login`
- `https://portal.stroanesolutions.com/admin`
- `https://portal.stroanesolutions.com/admin/inventory`
- `https://portal.stroanesolutions.com/admin/orders`
- `https://portal.stroanesolutions.com/admin/receipts`
- `https://portal.stroanesolutions.com/admin/accounting`
- `https://portal.stroanesolutions.com/admin/crm`
- `https://portal.stroanesolutions.com/admin/products`
- `https://portal.stroanesolutions.com/admin/operations`

Confirm `/admin` loads dashboard product/order/stock signals. Confirm `/admin/inventory`, `/admin/orders`, `/admin/receipts`, `/admin/accounting`, and `/admin/crm` render active modules. Confirm placeholder routes such as `/admin/products` and `/admin/operations` remain reset placeholders rather than old module workflows.

Legacy read-only aliases should also remain available during rollout:

- `https://api.stroanesolutions.com/api/products`
- `https://api.stroanesolutions.com/api/categories`

If the storefront shows "Catalogue fallback active", open the browser console and confirm the logged public API base URL. A configured production build should call `https://api.stroanesolutions.com/api/catalogue/products` and `https://api.stroanesolutions.com/api/catalogue/categories`.

The catalogue endpoint now keeps category and product sources coherent during rollout: persisted categories are returned only when persisted published products also exist. If Railway Postgres is only partially seeded, both public reads fall back to the normalized JSON seed until the production catalogue seed is intentionally run.

## Production Rollout Sequence

1. Confirm the intended Railway Postgres database and take a backup.
2. Set Railway API environment variables, including `RAILWAY_WORKSPACE=@faako/stroane-web`, and run `node ./scripts/railway-service.mjs build`.
3. Run `pnpm --filter @faako/stroane-web run db:deploy:prod`.
4. Start or redeploy the Railway API with `node ./scripts/railway-service.mjs start`.
5. Confirm `/health`, catalogue endpoints, and unauthenticated rejection on `/api/admin/inventory` and `/api/admin/products`.
6. Deploy the storefront Cloudflare Pages project with `VITE_APP_SURFACE=storefront`, bind `stroanesolutions.com` and `www.stroanesolutions.com`, and confirm customer sign-in/profile routes stay on the storefront account surface.
7. Deploy the portal Cloudflare Pages project with `VITE_APP_SURFACE=portal`, bind `portal.stroanesolutions.com`, then confirm `/login`, authenticated `/admin`, active inventory/orders/CRM modules, placeholder routes, and logout back to `/login`.
8. Run one authenticated manual alert check, verify cooldown deduplication on an immediate repeat, and confirm the scheduler route rejects missing or incorrect bearer secrets.

If persisted catalogue rows should replace seed fallback, run the catalogue seed only after reviewing the target database:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:plan
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:reconcile
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory:apply
```

The first and third commands are read-only plans. The catalogue reconciliation
upserts the normalized source and archives stale public rows instead of deleting
them. Inventory bootstrap creates missing portal records without overwriting
existing rows or inventing counts. Review the plan output, verify the intended
Railway Postgres target, and take a backup before applying either write command.

## Verification

Before promoting a deploy:

- Run `pnpm --filter @faako/stroane-web run build`.
- Run `pnpm --filter @faako/stroane-web exec prisma validate`.
- Confirm product images resolve under `/imgs/products/`.
- Confirm the `/admin` dashboard can fetch product rows from `/api/admin/products`, order rows from `/api/admin/orders`, and customer rows from `/api/admin/customers`.
- Confirm draft/archived rows do not appear in public catalogue responses.
- Confirm `/shop` and `/products/:id` still render from local fallback if the API URL is unavailable.
- Treat the checked-in browser fallback as a public outage snapshot: when an existing fallback product is archived or should no longer be public, update that snapshot and redeploy Cloudflare Pages as part of the publishing change.
- Confirm Cloudflare Pages has only browser-safe `VITE_*` values.
- Confirm Cloudflare Pages serves the response headers from `public/_headers`.
- Confirm Railway API owns all server-only database/payment/email/auth secrets.
- Confirm any Cloudflare Pages environment change has been followed by a redeploy.
