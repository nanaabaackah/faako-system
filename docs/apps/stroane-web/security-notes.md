# Stroane Web Security Notes

## Purpose

Track Stroane-specific security posture, hardening work, and production-readiness gaps for the lightweight commerce platform.

## Current Security Posture

Date reviewed: 2026-06-17

Stroane Web is now a customer-facing commerce app with product, inquiry, order, payment, and notification data. Treat checkout, product availability, customer contact details, database access, payment references, and deployment configuration as production-sensitive.

## Shared Protections Reused

- `@faako/security` now provides the shared API security header baseline used by the Stroane Express backend through `backend/security.js`.
- `scripts/security-scan.mjs` checks tracked files for secret-like values and unsafe env files.
- `scripts/security-gate.mjs` checks app security config/header/env/CORS drift. This pass fixed the Stroane `.env.example` browser-visible `VITE_AUTH_PASSWORD` finding.

## Current Backend Protections

- Express disables `x-powered-by`.
- CORS is allowlist-based. Production defaults include the Stroane apex, `www`, and `portal` domains, and Railway should still set `CORS_ORIGINS` explicitly.
- `TRUST_PROXY_HOPS` must be explicit before Express trusts proxy-derived client IPs.
- JSON request bodies are limited to `1mb`.
- Paystack webhook raw-body capture is limited to `/api/paystack/webhook`.
- Global API rate limiting remains in place, with tighter route-specific limits for auth, inquiry, checkout, Paystack initialization, Paystack verification, and Paystack webhook routes.
- Unknown API write routes still hit the default deny middleware.
- Product price, currency, stock status, purchasability, and quantity are validated server-side before order creation and again before Paystack payment initialization.
- Paystack paid status is trusted only from signed webhook confirmation followed by server-side Paystack transaction verification with reference, amount, and currency checks.
- Paystack metadata sent to the provider is minimized to order number/source; raw internal order IDs and customer phone are not sent as custom metadata.
- Protected admin routes require backend `SiteUser` auth. The portal now uses an HttpOnly admin session cookie with a legacy bearer fallback for transition scripts/tests; `VIEWER` can read protected admin data where allowed, while `ADMIN` can update protected operations fields.
- Customer account routes use a separate HttpOnly customer auth cookie and token audience from staff auth. Customer profile and order-history reads are always filtered by the authenticated customer context.
- Customer email is the main customer identifier. Storefront and CRM creation paths normalize submitted email addresses to lowercase and lookup existing records case-insensitively before create/update.
- Customer signup is open to storefront customers. Signup and password-reset completion enforce the strong password policy on both frontend and backend. Invite and checkout references are optional server-side linking context; invite and password-reset tokens are stored as SHA-256 hashes, reset request responses are generic, and raw reset links are sent only by email.
- Customer auth routes are rate-limited and state-changing customer requests require the storefront client header in addition to SameSite cookies. Do not broaden customer cookie scope or change to `SameSite=None` without adding a dedicated CSRF token flow.
- Delivery address search is proxied through `GET /api/location/search` and rate-limited server-side. The browser does not receive provider endpoint configuration, provider keys, or server-side request headers; it receives only normalized location suggestions for the customer's typed query.
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
- Current storefront purchasing is price-led: priced products may be added to cart with unknown quantities, while explicit zero/out-of-stock/preorder-without-backorder blockers still stop checkout. Real counts should be entered before broad public promotion.
- Frontend availability messaging is advisory. Backend order and payment preparation validation remains the enforcement point.
- This is storefront stock gating plus a protected manual operations foundation. Inventory movement audit entries exist for staff adjustments, but automatic order deduction and warehouse reservation are intentionally not wired.

## Database Access Notes

- Stroane currently uses Prisma/Postgres from the backend. The browser does not connect directly to the database.
- Railway Postgres is the chosen production database direction.
- Tables that require strict protection: `CommerceOrder`, `CommerceOrderItem`, `CatalogueInquiry`, `SiteUser`, future payment/event logs, future notification logs, and any future admin data.
- `CustomerAccount` stores customer profile details, invite hashes, password-reset token hashes, and account status. Customer records must remain server-side only; the browser may cache a non-secret profile shell for UX, but not session tokens, password hashes, invite/reset token hashes, payment secrets, or cross-customer data.
- Recommended Railway Postgres direction: keep all direct database access server-side, use separate migration and runtime credentials/roles where available, prevent browser database access, and keep payment/order/inquiry/user writes backend-only.

## Current Gaps

- Customer accounts are now server-backed for signup, login, profile editing, and order history. The portal CRM can create customer directory records and invite links, but deeper customer detail editing/audit history is still a future workflow.
- Staff usernames now use the dedicated backend-backed `https://portal.stroanesolutions.com/login` route. Legacy apex `/signin` and `/admin/*` entries hand off to the portal host, and staff accounts remain database-backed rather than CSV-backed at runtime.
- Backend `SiteUser` access should remain private and seeded as one `ADMIN` and one `VIEWER` account until a proper admin surface is approved.
- `APP_AUTH_SECRET` is required for backend `SiteUser` token signing and must remain server-side.
- Frontend `/admin/*` guards are a navigation boundary only. Protected admin APIs remain responsible for authorization. The portal stores profile metadata in `sessionStorage`, while the auth credential lives in an HttpOnly cookie. Do not widen the cookie domain or switch to `SameSite=None` without a dedicated CSRF/subdomain-risk review.
- Rate limiting is in-memory and per Node process. Railway/provider-level rate controls are the chosen production layer before high-volume production checkout.
- There is no dedicated payment event table or notification log yet.
- Webhook replay/idempotency is order-level only: already-finalized paid orders short-circuit duplicate paid transitions, and email sends are reduced with `customerNotificationSentAt`. This should be strengthened with a payment event log and notification log before automated fulfillment.
- The private order module is active for order review, manual order creation, fulfillment metadata, Paystack initialization, and Paystack status refresh. `statusUpdatedAt` and `statusUpdatedById` remain lightweight schema placeholders only.
- Railway Postgres least-privilege runtime/migration roles are documented but not implemented in app code.
- Centralized redacted logging is still future work. Route-level auth/payment/catalogue/order errors are now sanitized, but future logging should still avoid request bodies, provider payloads, secrets, card/MoMo details, or full customer records.
- Backend maintenance/read-only enforcement remains future work.

## Deployment Security Notes

- Keep Cloudflare Pages for frontend hosting, Railway for backend/rate-limit layer, and Railway Postgres for the production database. Cloudflare manages DNS/domain routing; keep registrar/email services separate from application database duties.
- Cloudflare Pages static responses use `apps/stroane-web/public/_headers`.
- The frontend CSP allows the intended browser API origin `https://api.stroanesolutions.com`, Paystack, Google Analytics and its regional collection hosts, Cloudflare Insights, and Google Maps frames for the staff order-location map. `script-src-attr 'none'` remains set so inline event-handler attributes stay blocked; `script-src-elem` allows trusted script elements required by deployed analytics/payment hosting.
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

Add a payment event/notification log plus Railway/provider-level rate limiting, then design a database least-privilege/RLS rollout with explicit per-request staff/customer context before enabling broader customer CRM automation or staff-management features.
