# Stroane Web Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/stroane-web` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, client preview, or production.
- Confirm the target Railway database, Railway API service, Cloudflare Pages project, Cloudflare DNS records, and domain.

## Auth and roles

- Verify any customer, admin, or staff access paths affected by the change.
- Confirm access control is enforced by the backend if protected flows exist.
- Confirm `https://portal.stroanesolutions.com/login` signs in with a private staff account, protected routes remain portal-only, and logout returns to `/login`.
- Confirm staff auth still uses the HttpOnly admin cookie and the portal stores profile metadata only.
- Do not widen the admin cookie domain or set `SameSite=None` without a dedicated CSRF/subdomain-risk review.

## API permissions

- Verify Express routes, middleware, CORS, rate limiting, and trusted proxy settings.
- Confirm deployed frontend points to the intended backend through `VITE_API_BASE_URL` when needed.

## Database/data loss risk

- Review Prisma migrations and data scripts before production.
- Run `pnpm --filter @faako/stroane-web run predeploy:local` before deployment when Prisma migrations changed.
- Root shortcut: `pnpm run predeploy:stroane`.
- Confirm backups or rollback options before modifying product, customer, order, or transaction-related data.

## Customer/user data

- Confirm customer information is protected in storage, logs, responses, and browser bundles.
- Avoid exposing backend secrets or private data through frontend environment variables.

## Payments/receipts if relevant

- Verify any payment, checkout, receipt, confirmation, or transaction-adjacent behavior end to end before deploy.

## Inventory/bookings/orders if relevant

- Verify product availability, catalog data, cart/purchase state, order capture, and fulfillment-adjacent records.

## Environment variables

- Compare required values with `apps/stroane-web/.env.example`.
- Keep only browser-safe values under `VITE_*`.
- Keep local/non-production `EMAIL_FORCE_TO=dev@nanaabaackah.com` so test emails do not go to customer or input addresses.
- Confirm CORS origins and proxy settings match the deployed domain.

## Cloudflare Pages, Railway API, and Cloudflare DNS

- Confirm both Cloudflare Pages projects use build command: `pnpm --filter @faako/stroane-web build`.
- Confirm both Cloudflare Pages projects use output directory: `apps/stroane-web/dist`.
- Confirm storefront Pages config uses `VITE_APP_SURFACE=storefront`.
- Confirm portal Pages config uses `VITE_APP_SURFACE=portal`.
- Confirm Cloudflare Pages output contains `_headers` from `apps/stroane-web/public/_headers`.
- Confirm Railway API build command: `pnpm --filter @faako/stroane-web exec prisma generate`.
- Confirm Railway API pre-deploy command: `pnpm --filter @faako/stroane-web run db:deploy:prod`.
- Confirm Railway API start command: `pnpm --filter @faako/stroane-web start:api`.
- Confirm Cloudflare routes `stroanesolutions.com` and `www.stroanesolutions.com` to the storefront Pages project.
- Confirm Cloudflare routes `portal.stroanesolutions.com` to the operational portal Pages project.
- Confirm Railway `CORS_ORIGINS` includes the apex, `www`, and portal origins.
- Confirm the browser-facing API uses `https://api.stroanesolutions.com` and that Railway remains the backend host behind that custom domain.

## Rollback plan

- Identify previous known-good frontend and backend deploys.
- Note any migrations that require manual rollback or forward-fix.
- Prepare a client communication note if customer-facing flows are affected.

## Manual testing

- Test homepage, product browsing, purchasing flow, API calls, and error states.
- Test public sign-in links hand off to `https://portal.stroanesolutions.com/login`.
- Test portal login, protected inventory/products routes, and logout.
- Test from the deployed domain with the deployed backend.
- Check responsive behavior for core commerce pages.

## Post-deploy verification

- Confirm storefront loads from the client domain.
- Confirm API health and key commerce routes respond.
- Check logs for CORS, proxy, rate-limit, database, or purchase-flow errors.
