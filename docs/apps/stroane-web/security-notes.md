# Stroane Web Security Notes

## Purpose

Track Stroane-specific security posture, hardening work, and production-readiness gaps for the lightweight commerce platform.

## Current Security Posture

Date reviewed: 2026-05-30

Stroane Web is now a customer-facing commerce app with product, inquiry, order, payment, and notification data. Treat checkout, product availability, customer contact details, database access, payment references, and deployment configuration as production-sensitive.

## Shared Protections Reused

- `@faako/security` now provides the shared API security header baseline used by the Stroane Express backend through `backend/security.js`.
- `scripts/security-scan.mjs` checks tracked files for secret-like values and unsafe env files.
- `scripts/security-gate.mjs` checks app security config/header/env/CORS drift. This pass fixed the Stroane `.env.example` browser-visible `VITE_AUTH_PASSWORD` finding.

## Current Backend Protections

- Express disables `x-powered-by`.
- CORS is allowlist-based. Production defaults include the Stroane apex and `www` domains, and Railway should still set `CORS_ORIGINS` explicitly.
- `TRUST_PROXY_HOPS` must be explicit before Express trusts proxy-derived client IPs.
- JSON request bodies are limited to `1mb`.
- Paystack webhook raw-body capture is limited to `/api/paystack/webhook`.
- Global API rate limiting remains in place, with tighter route-specific limits for auth, inquiry, checkout, Paystack initialization, Paystack verification, and Paystack webhook routes.
- Unknown API write routes still hit the default deny middleware.
- Product price, currency, stock status, purchasability, and quantity are validated server-side before order creation and again before Paystack payment initialization.
- Paystack paid status is trusted only from signed webhook confirmation followed by server-side Paystack transaction verification with reference, amount, and currency checks.
- Paystack metadata sent to the provider is minimized to order number/source; raw internal order IDs and customer phone are not sent as custom metadata.
- Admin order routes require backend `SiteUser` bearer auth. `VIEWER` can read order list/detail, while `ADMIN` can update lightweight fulfillment/status/note fields.
- Payment references returned to admin UI are masked, and payment status is not manually editable.
- Auth, catalogue, inquiry, order creation, Paystack initialization, Paystack callback verification, and unhandled backend error logs now use sanitized message/status output instead of dumping raw error/provider objects.

## Payment Integrity

- `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` are backend-only.
- Live Paystack secret keys are blocked unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set server-side.
- Browser return verification is customer messaging only. It does not finalize successful payment status unless the order was already finalized by a trusted backend path.
- Webhook payloads are not enough on their own for final paid status. The backend verifies the Paystack transaction reference server-side before finalization.
- Browser return verification now normalizes currency casing before comparing Paystack status-check data with the server-calculated order currency. The webhook path remains the trusted paid-state source.
- Card, MoMo wallet, authorization payloads, and secrets are not stored.
- A dedicated payment event log is still needed before replay tooling, fulfillment automation, staff alerts, or advanced idempotency.

## Stock And Purchasability

- Product records support `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`.
- Current PDF-imported products default to unknown stock and non-purchasable until real stock counts are entered.
- Frontend availability messaging is advisory. Backend order and payment preparation validation remains the enforcement point.
- This is storefront stock gating plus a protected manual operations foundation. Inventory movement audit entries exist for staff adjustments, but automatic order deduction and warehouse reservation are intentionally not wired.

## Database Access Notes

- Stroane currently uses Prisma/Postgres from the backend. The browser does not connect directly to the database.
- Railway Postgres is the chosen production database direction.
- Tables that require strict protection: `CommerceOrder`, `CommerceOrderItem`, `CatalogueInquiry`, `SiteUser`, future payment/event logs, future notification logs, and any future admin data.
- Recommended Railway Postgres direction: keep all direct database access server-side, use separate migration and runtime credentials/roles where available, prevent browser database access, and keep payment/order/inquiry/user writes backend-only.

## Current Gaps

- Current customer sign-in/sign-up pages are frontend-only `localStorage` account/session flows. They are intentionally retained for now but are not server-enforced auth and must not protect admin, order, payment, customer, or stock management workflows.
- Staff usernames now use the dedicated backend-backed `/admin/signin` route. Public `/signin` is customer-only, and staff accounts remain database-backed rather than CSV-backed at runtime.
- Backend `SiteUser` access should remain private and seeded as one `ADMIN` and one `VIEWER` account until a proper admin surface is approved.
- `APP_AUTH_SECRET` is required for backend `SiteUser` token signing and must remain server-side.
- Frontend `/admin/*` guards are a navigation boundary only. Protected admin APIs remain responsible for bearer authorization. The current `sessionStorage` bearer-token approach is transitional and should be reviewed before expanding staff account management.
- Rate limiting is in-memory and per Node process. Railway/provider-level rate controls are the chosen production layer before high-volume production checkout.
- There is no dedicated payment event table or notification log yet.
- Webhook replay/idempotency is order-level only: already-finalized paid orders short-circuit duplicate paid transitions, and email sends are reduced with `customerNotificationSentAt`. This should be strengthened with a payment event log and notification log before automated fulfillment.
- Admin order updates do not have a full audit trail yet. `statusUpdatedAt` and `statusUpdatedById` are lightweight placeholders only.
- Railway Postgres least-privilege runtime/migration roles are documented but not implemented in app code.
- Centralized redacted logging is still future work. Route-level auth/payment/catalogue/order errors are now sanitized, but future logging should still avoid request bodies, provider payloads, secrets, card/MoMo details, or full customer records.
- Backend maintenance/read-only enforcement remains future work.

## Deployment Security Notes

- Keep Cloudflare Pages for frontend hosting, Railway for backend/rate-limit layer, and Railway Postgres for the production database. Cloudflare manages DNS/domain routing; keep registrar/email services separate from application database duties.
- Cloudflare Pages static responses use `apps/stroane-web/public/_headers`; Netlify configuration is not required.
- Keep `VITE_*` values browser-safe only. `VITE_API_BASE_URL` is acceptable; secrets, database URLs, provider keys, session keys, and webhook secrets are not. `VITE_BACKEND_BASE_URL` should be treated as a legacy fallback only.
- Set `CORS_ORIGINS` to the exact deployed frontend origin.
- Set `PAYSTACK_CALLBACK_URL` to the public `/checkout/return` URL for the deployed frontend.
- Set the Paystack webhook URL in Paystack to the deployed backend `/api/paystack/webhook` route.
- Use HTTPS in production.

## Verification Notes

- 2026-05-21 stabilization QA passed: Stroane backend syntax check, Paystack/security Node tests, TypeScript check, lint, Prisma validate, production build, `security:gate`, and `security:scan`.
- `pnpm run security:scan` passed.
- `pnpm run security:gate` initially flagged `VITE_AUTH_PASSWORD` in `apps/stroane-web/.env.example`; the obsolete preview-auth env entries were removed and the final security gate passed.
- `pnpm --filter @faako/stroane-web exec node --test backend/security.test.js` passed after adding the explicit `@faako/security` workspace dependency and refreshing the lockfile/linking.
- `pnpm --filter @faako/stroane-web exec prisma validate` passed after rerunning with access to Prisma's local engine cache.
- Stroane lint, typecheck, and build passed.

## Next Recommended Step

Add a payment event/notification log plus Railway/provider-level rate limiting, then design a lightweight authenticated stock/admin update flow before enabling public purchasing broadly.
