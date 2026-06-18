# REEBS Portal Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/reebs-portal` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, private beta, or production.
- Confirm the target database, Cloudflare Pages project, and REEBS API service before deploy.

## Auth and roles

- Verify login, session behavior, password reset, lockout behavior, and role-gated navigation.
- Check Owner, Admin, Manager, Staff, Warehouse, Driver, and Water access where relevant.

## API permissions

- Confirm backend functions enforce permissions server-side.
- Verify privileged admin routes cannot be reached by navigation bypass.

## Database/data loss risk

- Review Prisma migrations, seed scripts, imports, relinks, and destructive update paths.
- `pnpm --filter @faako/reebs-portal run dev:with-backend`, `pnpm --filter @faako/reebs-portal run dev`, and `pnpm run dev:reebs` run local Prisma predeploy automatically before starting.
- Run `pnpm --filter @faako/reebs-portal run predeploy:local` manually before deployment when Prisma migrations changed and you are not starting dev.
- Root shortcut: `pnpm run predeploy:reebs-portal`.
- Confirm backup or rollback strategy for any production data change.

## Customer/user data

- Confirm customer, employee, HR, audit log, personal email, and user directory data remains protected.
- Confirm customer API responses use configured origin allowlists, not wildcard CORS.
- Confirm water MoMo webhook providers send `X-Water-Webhook-Secret`; do not use query-string or body secrets.
- Avoid exposing secrets or personal data through frontend bundles, logs, or exported files.

## Payments/receipts if relevant

- Verify payment ledger, receipt viewer, invoicing, accounting, revenue recognition, and refund/adjustment flows.

## Inventory/bookings/orders if relevant

- Verify inventory stock movement, product variants, bookings, scheduling, order builder, fulfillment, delivery, and rental flows.

## Environment variables

- Confirm secrets are server-only.
- Confirm `VITE_*` values are safe to expose in the browser.
- Keep local/non-production `EMAIL_FORCE_TO=dev@nanaabaackah.com` so test emails do not go to customer or input addresses.
- Compare required env vars against `apps/reebs-portal/.env.example`.

## Cloudflare/API deployment

- Confirm Cloudflare Pages build command is `pnpm --filter @faako/reebs-portal build`.
- Confirm Cloudflare Pages output directory is `apps/reebs-portal/dist`.
- Confirm frontend `VITE_API_BASE_URL` points to `https://api.reebspartythemes.com`.
- Confirm the API service starts with `pnpm --filter @faako/reebs-portal run server:with-migrate`.
- Confirm API service env includes server-only secrets such as `DATABASE_URL`, `USER_APP_SECRET`, email provider keys, and messaging provider keys.
- Confirm hosted Postgres SSL config is valid. For Railway/self-signed chains, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` or provide `DATABASE_SSL_CA`.

## Rollback plan

- Identify the previous known-good Cloudflare Pages deploy and API service deploy.
- Note any database migrations that cannot be safely rolled back.
- Prepare a user-facing incident note if operational workflows are affected.

## Manual testing

- Test login and role-specific navigation.
- Test at least one affected workflow end to end.
- Test mobile-safe shell behavior when UI layout changes are included.

## Post-deploy verification

- Confirm the deployed portal loads and authenticated routes work.
- Check affected API routes and API service logs.
- Verify no unexpected permission, data, booking, order, receipt, or inventory regressions are visible.
