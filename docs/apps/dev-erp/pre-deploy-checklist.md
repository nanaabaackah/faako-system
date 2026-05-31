# Dev ERP Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/dev-erp` only, or list every shared package/app also affected.

## Environment affected

- Identify local, development, staging, or production.
- Confirm frontend host, backend host, database, and `APP_ENV`.
- Treat live Dev ERP environments as production-sensitive because they contain real operational data.

## Auth and roles

- Verify login, session boot, logout, CSRF, roles/capabilities, and organization scoping.
- Confirm frontend route visibility matches backend enforcement.
- For split-hosted production frontend/API deployments, set `AUTH_COOKIE_SAME_SITE=none`, `AUTH_COOKIE_SECURE=true`, and an exact HTTPS frontend origin in `CORS_ORIGINS`.
- Confirm the frontend `VITE_API_BASE` points to the deployed API origin, then smoke-test login followed by an authenticated module request.

## API permissions

- Verify Express route middleware, capability checks, organization filters, and error handling.
- Confirm API client credentials and CSRF headers are working.

## Database/data loss risk

- Review Prisma migrations and data scripts.
- Deploy the additive `20260531000000_add_invoice_paid_amount` migration before relying on invoice partial-payment fields.
- Confirm `ENFORCE_DATABASE_ISOLATION=true` where appropriate.
- Confirm local work cannot accidentally write to production data.

## Customer/user data

- Protect users, organizations, customers/clients, invoices, accounting, reports, OAuth tokens, and integration data.
- Avoid logging secrets or sensitive operational records.

## Payments/receipts if relevant

- Verify rent, invoice, accounting, payment-adjacent, and reporting calculations before deploy.
- For invoices, verify total, payment received, balance due, and manual status behavior for unpaid, partially paid, and fully paid records.

## Inventory/bookings/orders if relevant

- Verify appointments, bookings, rent records, operational records, and any inventory/order-like flows.

## Environment variables

- Compare required values against `apps/dev-erp/.env.example`.
- Confirm `OAUTH_TOKEN_ENCRYPTION_KEY` when Google Calendar integration is enabled.
- Keep only browser-safe values in `VITE_*`.
- Confirm email workflow and AI/productivity endpoint variables point to the intended environment.

## Netlify/Railway deployment

- Confirm Netlify frontend build and publish directory for `apps/dev-erp`.
- Confirm Railway backend start command and repo-root `nixpacks.toml` behavior when deploying backend.
- Run the app-specific selective deploy check when needed: `node ./scripts/netlify-ignore.mjs @faako/dev-erp`.

## Rollback plan

- Identify previous known-good frontend and backend deploys.
- Document migration rollback or forward-fix requirements.
- Preserve real operational data and note any records created, modified, or corrected during rollback.

## Manual testing

- Test login, session refresh, capability-gated routes, and affected modules.
- Test at least one full workflow across frontend and backend.
- Test affected rent/payment records, customer/client data, reports, email workflows, and AI/productivity endpoints when relevant.
- Test responsive shell behavior for layout changes.

## Post-deploy verification

- Confirm frontend loads and backend health/API routes respond.
- Check auth/session behavior and affected route logs.
- Verify no database isolation, integration, or capability errors appear.
