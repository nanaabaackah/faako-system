# Stroane Web Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/stroane-web` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, client preview, or production.
- Confirm the target database, backend host, Cloudflare Pages project, and domain.

## Auth and roles

- Verify any customer, admin, or staff access paths affected by the change.
- Confirm access control is enforced by the backend if protected flows exist.

## API permissions

- Verify Express routes, middleware, CORS, rate limiting, and trusted proxy settings.
- Confirm deployed frontend points to the intended backend through `VITE_BACKEND_BASE_URL` when needed.

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

## Cloudflare Pages/Railway deployment

- Confirm Cloudflare Pages build command and publish directory for `apps/stroane-web`.
- Confirm backend deployment target and start command if deployed separately.
- Railway may be used only if this app's backend is configured for it in the current deployment plan.

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
