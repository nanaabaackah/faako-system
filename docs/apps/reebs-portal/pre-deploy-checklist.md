# REEBS Portal Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/reebs-portal` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, private beta, or production.
- Confirm the target database and Netlify site before deploy.

## Auth and roles

- Verify login, session behavior, password reset, lockout behavior, and role-gated navigation.
- Check Owner, Admin, Manager, Staff, Warehouse, Driver, and Water access where relevant.

## API permissions

- Confirm backend functions enforce permissions server-side.
- Verify privileged admin routes cannot be reached by navigation bypass.

## Database/data loss risk

- Review Prisma migrations, seed scripts, imports, relinks, and destructive update paths.
- Confirm backup or rollback strategy for any production data change.

## Customer/user data

- Confirm customer, employee, HR, audit log, personal email, and user directory data remains protected.
- Avoid exposing secrets or personal data through frontend bundles, logs, or exported files.

## Payments/receipts if relevant

- Verify payment ledger, receipt viewer, invoicing, accounting, revenue recognition, and refund/adjustment flows.

## Inventory/bookings/orders if relevant

- Verify inventory stock movement, product variants, bookings, scheduling, order builder, fulfillment, delivery, and rental flows.

## Environment variables

- Confirm secrets are server-only.
- Confirm `VITE_*` values are safe to expose in the browser.
- Compare required env vars against `apps/reebs-portal/.env.example`.

## Netlify/Railway deployment

- Confirm Netlify build command and function directory are correct for `apps/reebs-portal`.
- Run the app-specific selective deploy check when needed: `node ./scripts/netlify-ignore.mjs @faako/reebs-portal`.
- Railway is not the primary deployment target for this app unless a future backend split is introduced.

## Rollback plan

- Identify the previous known-good Netlify deploy.
- Note any database migrations that cannot be safely rolled back.
- Prepare a user-facing incident note if operational workflows are affected.

## Manual testing

- Test login and role-specific navigation.
- Test at least one affected workflow end to end.
- Test mobile-safe shell behavior when UI layout changes are included.

## Post-deploy verification

- Confirm the deployed portal loads and authenticated routes work.
- Check affected Netlify Functions and logs.
- Verify no unexpected permission, data, booking, order, receipt, or inventory regressions are visible.
