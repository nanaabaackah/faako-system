# Platform Security Status

## Purpose

Summarize shared Faako security foundations, app adoption, current gaps, and recommended hardening order.

## Current Shared Foundations

Date reviewed: 2026-05-21

- `packages/security` provides shared security profile metadata, security header builders, CORS helper primitives, public-env key detection, and app-system validation.
- `scripts/security-scan.mjs` checks tracked files for secret-like values, unsafe env files, private keys, and high-risk credentials.
- `scripts/security-gate.mjs` validates app security config, header baselines, suspicious browser-visible env keys, credentialed wildcard CORS, and cookie-app token storage drift.
- Dev ERP uses shared security headers through its backend security header adapter.
- Stroane Web now uses shared `@faako/security` API headers through `apps/stroane-web/backend/security.js`.

## App Adoption Notes

- Stroane Web: shared API headers, CORS allowlist, explicit trusted proxy handling, in-memory API rate limiting, route-specific write/payment/admin limits, default write deny, server-side stock/price validation, signed Paystack webhook confirmation with transaction verification, protected admin order routes, minimized provider metadata, sanitized route-level error logging for auth/commerce/payment paths, and Safari/iOS-safe shared form-control presentation.
- Dev ERP: shared backend header helper adoption and app registry/monitoring checks exist; payment and invoice workflow security remains app-owned.
- REEBS Portal: production-sensitive auth, payment, booking, inventory, offline queue, and API handler surfaces remain app-owned and should be reviewed separately before deeper shared security extraction.
- Faako Website/Faako API/byNana Portfolio: public-site/API security posture should continue through app-system metadata, env scanning, and deployment-level header checks.

## Current Platform Gaps

- Persistent/distributed rate limiting is not standardized yet; Stroane has selected Railway/provider controls for production checkout protection.
- Database least-privilege policy is app/provider-specific and not enforced by shared packages.
- Payment event logging and notification idempotency are not standardized yet.
- Centralized redacted request/error logging remains future work, though Stroane now sanitizes route-level auth/catalogue/order/payment error logs.
- Runtime checks for deployed headers, CORS, webhook endpoints, and app-mode enforcement are not automated yet.
- Some apps still need deeper auth/session storage review before shared auth helpers are introduced.

## Database Access Direction

For Postgres-backed commerce or operational apps:

- Keep database URLs and elevated credentials server-side only.
- Prefer separate runtime and migration credentials.
- Allow public reads only for intentionally published catalogue/content rows.
- Prevent public browser selects on orders, inquiries, payments, users, audit data, and admin data.
- Keep payment and webhook mutations backend/service-only.

## Payment Integrity Direction

- Server must own order totals, currency, explicit stock blocker/quantity validation, payment reference creation, and payment verification.
- Browser return/callback pages are customer messaging only.
- Signed provider webhooks plus server-side transaction/reference verification should be the trusted paid-status path where supported.
- Store safe provider metadata only; do not store card/MoMo wallet details, secrets, authorization payloads, or raw provider payload dumps.
- Add event logs before replay tooling, fulfillment automation, staff alerts, or multi-channel notification retries.

## Verification Commands

Current pass:

- Stroane commerce stabilization and Safari UI QA passed backend syntax, Paystack/security Node tests, TypeScript check, lint, Prisma validate, production build, `security:gate`, and `security:scan`.
- `pnpm run security:scan` passed.
- `pnpm run security:gate` passed after removing obsolete Stroane browser-visible preview-auth env examples.
- Stroane backend security tests, syntax checks, Prisma validation, typecheck, lint, and build passed.
- `pnpm run monitoring:check` passed.
- `pnpm run project-registry:check` passed with warning-only project metadata coverage notes.

## Recommended Hardening Order

1. Add provider-level/persistent rate limiting for checkout, inquiry, auth, and payment endpoints. Stroane's chosen production layer is Railway.
2. Add payment event and notification log tables before automated fulfillment/retry workflows.
3. Implement or document Railway Postgres least-privilege runtime and migration roles for Stroane production database.
4. Keep Stroane public sign-in/sign-up as a non-sensitive customer convenience only; use private backend `SiteUser` accounts with one admin and one viewer until a real admin UI is approved.
5. Add deployed-runtime security checks for headers, CORS, HTTPS, webhook URL, and callback URL.
6. Review REEBS and Dev ERP auth/payment/inventory/booking surfaces separately before any shared security refactor.
