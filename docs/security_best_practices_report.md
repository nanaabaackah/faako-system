# Security Best Practices Report

## Executive Summary

This audit focused on hardcoded and exposed secrets in the `faako-new` monorepo. Two critical exposures were found: committed `.env` files in the Faako apps contained a live database connection string, and one also contained a live Resend API key. Those files have been replaced with sanitized `.env.example` templates and real `.env` files are now ignored by the repo.

A remaining architectural risk is that several Reebs frontend features read `VITE_*` API keys in browser code. No actual secret values were committed for those keys, but any value placed there will be exposed to end users at runtime because Vite embeds them into the client bundle.

## Critical Findings

### SEC-001

- Rule ID: REACT-CONFIG-001 / General Secrets Handling
- Severity: Critical
- Location: [apps/faako-api/.env](/Users/Nana/Desktop/Developer/faako-new/apps/faako-api/.env):1, [apps/faako-api/.env](/Users/Nana/Desktop/Developer/faako-new/apps/faako-api/.env):3, [apps/faako-website/.env](/Users/Nana/Desktop/Developer/faako-new/apps/faako-website/.env):3
- Evidence: tracked `.env` files contained a live `DATABASE_URL`, and `apps/faako-api/.env` also contained a live `RESEND_API_KEY`
- Impact: anyone with repo access could reuse the database credential and mail API key; if these files were pushed remotely, the secrets should be treated as compromised
- Fix: real `.env` files are now ignored, sanitized examples were added, and the tracked `.env` files should be removed from version control
- Mitigation: rotate the exposed database password and Resend API key immediately; review hosted API and database audit logs
- False positive notes: none; these were concrete credential values, not placeholders

## Medium Findings

### SEC-002

- Rule ID: REACT-CONFIG-001
- Severity: Medium
- Location: [apps/reebs-portal/src/components/CartContext/CartContext.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-portal/src/components/CartContext/CartContext.jsx):40, [apps/reebs-portal/src/components/CurrencyContext/CurrencyContext.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-portal/src/components/CurrencyContext/CurrencyContext.jsx):31, [apps/reebs-portal/src/components/Map/Map.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-portal/src/components/Map/Map.jsx):60, [apps/reebs-portal/src/pages/AdminScheduler/AdminScheduler.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-portal/src/pages/AdminScheduler/AdminScheduler.jsx):237, [apps/reebs-website/src/components/CartContext/CartContext.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-website/src/components/CartContext/CartContext.jsx):40, [apps/reebs-website/src/components/CurrencyContext/CurrencyContext.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-website/src/components/CurrencyContext/CurrencyContext.jsx):31, [apps/reebs-website/src/components/Map/Map.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/reebs-website/src/components/Map/Map.jsx):60
- Evidence: browser code reads `import.meta.env.VITE_CURRENCY_API_KEY`, `VITE_EXCHANGE_API_KEY`, and `VITE_GOOGLE_MAPS_KEY`
- Impact: any real value assigned to those variables is exposed to end users in the built frontend; unrestricted third-party API keys can be abused
- Fix: move sensitive third-party calls behind server-side API handlers, or use provider-issued publishable keys with strict domain and API restrictions
- Mitigation: verify Google Maps keys are HTTP-referrer restricted; verify exchange-rate keys are intended for public-browser use or replace them with server-side proxies
- False positive notes: no live key values were committed in this repo for these variables

## Low Findings

### SEC-003

- Rule ID: Configuration Hygiene
- Severity: Low
- Location: [apps/faako-website/src/pages/Signup.jsx](/Users/Nana/Desktop/Developer/faako-new/apps/faako-website/src/pages/Signup.jsx):168, [apps/bynana-portfolio/src/utils/analytics.js](/Users/Nana/Desktop/Developer/faako-new/apps/bynana-portfolio/src/utils/analytics.js):1
- Evidence: frontend code consumes `VITE_API_BASE_URL` and `VITE_GA_ID`
- Impact: these values are public by design in a Vite app; this is only a problem if someone treats them as secrets
- Fix: keep only non-secret, publishable values in `VITE_*` variables and document that requirement
- Mitigation: use server-only env vars for anything confidential
- False positive notes: these are normal public runtime config patterns, not confirmed leaks

## Remediation Completed

- Added repo-wide ignore rules for real `.env` files in [/.gitignore](/Users/Nana/Desktop/Developer/faako-new/.gitignore).
- Added sanitized templates at [apps/faako-api/.env.example](/Users/Nana/Desktop/Developer/faako-new/apps/faako-api/.env.example) and [apps/faako-website/.env.example](/Users/Nana/Desktop/Developer/faako-new/apps/faako-website/.env.example).
- Prepared the repo to untrack `apps/faako-api/.env` and `apps/faako-website/.env` while keeping local copies available.

## Recommended Next Steps

1. Rotate the exposed `DATABASE_URL` credential and `RESEND_API_KEY`.
2. Remove the real `.env` files from git history if this repo has ever been pushed to a shared remote.
3. Decide whether Reebs browser-side API calls should be proxied through server functions instead of using `VITE_*` keys.

## 2026-06-16 Addendum

- Faako ERP demo access no longer generates or displays access codes in the browser. Faako API now owns the email-code route, stores only challenge hashes, rate-limits attempts, and fails closed without a production signing secret.
- Stroane Web admin auth now uses an HttpOnly cookie with legacy bearer fallback. The portal stores profile metadata only, and the storefront no longer stores customer password hashes or local account records.
- REEBS customer responses now use allowlisted security headers instead of wildcard CORS, and the water MoMo webhook requires `X-Water-Webhook-Secret` rather than query/body secrets.
- `pnpm run security:gate` now checks sensitive `VITE_*` usage in source and browser-visible demo access-code patterns in addition to the prior config/header/CORS/storage checks.
- Postgres RLS remains a staged per-app rollout item. Do not enable blanket RLS until each app has trusted per-request tenant context, table policies, tests, and rollback plans.
