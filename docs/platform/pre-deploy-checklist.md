# Platform Pre-Deploy Checklist

## Purpose

Use this checklist for shared monorepo changes, cross-app changes, shared packages, deployment convention changes, or changes whose blast radius is larger than one app.

REEBS Portal and Dev ERP are both live systems with real data. Any change affecting auth, API permissions, customer/user data, payments, receipts, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, or database schema must be treated as production-sensitive.

## Apps affected

- List every app and shared package affected.
- Confirm whether each app has its own app-specific checklist update.

## Environment affected

- Identify local, development, demo, preview, staging, private beta, production, or client production.
- Confirm every target frontend, backend, database, hosted service, Railway service, and domain.

## Auth and roles

- Check cross-app shell, auth, session, role, capability, and route guard behavior.
- Confirm backend enforcement still matches frontend visibility.

## API permissions

- Verify shared API clients, function routes, Express middleware, CORS, CSRF, rate limiting, and proxy settings.
- Confirm public APIs expose only intended behavior.

## Database/data loss risk

- List all migrations, seeds, imports, backfills, and data scripts.
- Confirm database isolation and production safeguards for each app.
- Confirm backups, rollback, restore, or forward-fix plans.

## Customer/user data

- Identify personal, customer, employee, HR, signup, lead, organization, or client data affected.
- Confirm logs, bundles, exports, and errors do not expose sensitive data.

## Payments/receipts if relevant

- Verify payment-adjacent, receipt, invoice, accounting, revenue, and reporting flows in every affected app.

## Inventory/bookings/orders if relevant

- Verify inventory, variants, bookings, scheduling, orders, delivery, rentals, appointments, and fulfillment records in every affected app.

## Environment variables

- Compare env changes against each affected app's `.env.example`.
- Keep secrets server-only.
- Treat `VITE_*` values as public browser-visible configuration.

## Cloudflare/Railway deployment

- Confirm build commands, publish directories, function directories, redirects, headers, and service start commands.
- Confirm frontend/backend URL pairing, DNS, and CORS.
- Run selective deploy checks where applicable.

## Rollback plan

- Identify previous known-good deploys for every affected app/service.
- Document migrations that cannot be rolled back automatically.
- Decide whether rollback requires app-only rollback, backend rollback, database restore, or forward-fix.

## Manual testing

- Test one representative workflow in each affected app.
- Test shared shell, navigation, forms, auth, API, and responsive behavior if shared code changed.
- Test production-like env pairing before production deploys.

## Post-deploy verification

- Confirm every affected site/service loads.
- Check health endpoints, critical APIs, function logs, backend logs, and error tracking.
- Confirm no unexpected auth, data, signup, commerce, operational, or deployment regressions appear.
