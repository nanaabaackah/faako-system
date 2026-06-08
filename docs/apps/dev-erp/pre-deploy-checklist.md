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
- For the current direct Railway API deployment, set `AUTH_COOKIE_SAME_SITE=none`, `AUTH_COOKIE_SECURE=true`, and an exact HTTPS frontend origin in `CORS_ORIGINS`.
- Confirm frontend `VITE_API_BASE` points to the deployed Railway API origin, then smoke-test login, refresh after the access token expires, browser reopen recovery, and an authenticated module request.
- A same-site Railway custom API hostname such as `api.dev.example.com` is required when reliable Safari login persistence is needed because Safari blocks third-party cookies by default. Register the hostname on Railway, point its DNS CNAME to Railway's provided target rather than Cloudflare Pages, and use `AUTH_COOKIE_SAME_SITE=lax` after adopting that hostname.

## API permissions

- Verify Express route middleware, capability checks, organization filters, and error handling.
- Confirm API client credentials and CSRF headers are working.

## Database/data loss risk

- Review Prisma migrations and data scripts.
- Deploy the additive `20260531000000_add_invoice_paid_amount` migration before relying on invoice partial-payment fields.
- Confirm `ENFORCE_DATABASE_ISOLATION=true` where appropriate.
- Confirm local work cannot accidentally write to production data.
- Keep local `VITE_API_BASE=""`, `AUTH_COOKIE_SAME_SITE=lax`, and `AUTH_COOKIE_SECURE=false` so Vite proxies `/api` to `VITE_API_PROXY_TARGET` and local HTTP can persist auth cookies instead of inheriting hosted settings.

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

## Cloudflare Pages/Railway deployment

- Confirm Cloudflare Pages frontend build and `apps/dev-erp/dist` publish directory.
- Do not rely on `apps/dev-erp/netlify.toml` redirects in Cloudflare Pages. Configure frontend `VITE_API_BASE` explicitly.
- For a same-site custom API hostname, confirm DNS resolves to the Railway custom-domain target and that `/healthz` returns the Railway API response before deploying the frontend value.
- Confirm Dev ERP API monitoring uses the deployed Railway/custom API host (`DEV_ERP_API_BASE_URL` or default `https://api.dev.nanaabaackah.com`) and that `/healthz` plus `/api/public/trust-stats` return non-HTML API responses.
- If Faako API monitoring should be active, set `FAAKO_API_BASE_URL` or `FAAKO_API_URL` to an API deployment that returns JSON from `/health`; do not use the Faako marketing website host for this API surface.
- Confirm `RAILWAY_WEBHOOK_SECRET` is set on the Railway API service and the Railway project webhook posts to `/api/webhooks/railway` using the matching bearer token, accepted secret header, or `?secret=<secret>`.
- Confirm Railway backend start command and repo-root `nixpacks.toml` behavior when deploying backend.
- If the legacy Netlify frontend deploy is used, run the app-specific selective deploy check when needed: `node ./scripts/netlify-ignore.mjs @faako/dev-erp`.

## Rollback plan

- Identify previous known-good frontend and backend deploys.
- Document migration rollback or forward-fix requirements.
- Preserve real operational data and note any records created, modified, or corrected during rollback.

## Manual testing

- Test login, session refresh, capability-gated routes, and affected modules.
- Test at least one full workflow across frontend and backend.
- Test affected rent/payment records, customer/client data, reports, email workflows, and AI/productivity endpoints when relevant.
- Test responsive shell behavior for layout changes.
- Verify Dashboard and System Health show every registered app workspace, including optional internal apps as `Not configured` when their URLs are blank.
- Verify Reports contains scheduled email configuration and manual-send workflows only, then verify Audit Logs filtering, analytics, export, refresh, and mobile timeline layout separately.

## Post-deploy verification

- Confirm frontend loads and backend health/API routes respond.
- Check auth/session behavior and affected route logs.
- Verify no database isolation, integration, or capability errors appear.
