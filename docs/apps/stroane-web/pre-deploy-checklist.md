# Stroane Web Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/stroane-web` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, client preview, or production.
- Confirm the target Railway database, Railway API service, Cloudflare Pages project, Cloudflare DNS records, and domain.

## Auth and roles

- Verify any customer, admin, or staff access paths affected by the change.
- Confirm access control is enforced by the backend if protected flows exist.

## API permissions

- Verify Express routes, middleware, CORS, rate limiting, and trusted proxy settings.
- Confirm deployed frontend points to the intended backend through `VITE_API_BASE_URL` when needed.

## Database/data loss risk

- Review Prisma migrations and data scripts before production.
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
- Confirm CORS origins and proxy settings match the deployed domain.

## Cloudflare Pages, Railway API, and Cloudflare DNS

- Confirm Cloudflare Pages build command: `pnpm --filter @faako/stroane-web build`.
- Confirm Cloudflare Pages output directory: `apps/stroane-web/dist`.
- Confirm Railway API start command: `pnpm --filter @faako/stroane-web start:api`.
- Confirm Cloudflare routes `stroanesolutions.com` and `www.stroanesolutions.com` to the Cloudflare Pages frontend.
- Confirm the API uses `https://stroane-api-production.up.railway.app` unless a future `api.stroanesolutions.com` cleanup is explicitly approved.

## Rollback plan

- Identify previous known-good frontend and backend deploys.
- Note any migrations that require manual rollback or forward-fix.
- Prepare a client communication note if customer-facing flows are affected.

## Manual testing

- Test homepage, product browsing, purchasing flow, API calls, and error states.
- Test from the deployed domain with the deployed backend.
- Check responsive behavior for core commerce pages.

## Post-deploy verification

- Confirm storefront loads from the client domain.
- Confirm API health and key commerce routes respond.
- Check logs for CORS, proxy, rate-limit, database, or purchase-flow errors.
