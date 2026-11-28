# TTNGH security best-practices review — 28 November 2026

Scope: `apps/ttngh`, `apps/ttngh/studio`, `services/ttngh-api`, their direct shared security/contract packages, production response headers and production dependency audit. No destructive test, real enquiry submission, secret readout, migration or deployment was performed.

## Executive result

No credential exposure, public draft leak, SQL injection path, open redirect, browser token storage, unsafe retry of enquiry mutations or production authorization bypass was found. The API has strong boundary validation, exact-origin enforcement, bounded parsing, rate limits, Turnstile verification, parameterized SQL, request IDs, signed/fresh webhooks, restricted outbound hooks, timeouts and generic errors.

One critical build-time Astro advisory and later rendering advisories were found and remediated locally by pinning 7.3.8, the newest version compatible with the repository's Node 22.18 runtime. Sanity Studio has since been upgraded from 6.18.0 to the supported 6.25.0 and frontend CI has been added and independently verified. The remaining material gaps are absence of a secure preview implementation, inline CSP allowances and deployment evidence.

## Findings

### SEC-01 — Critical Astro advisory (P0, fixed locally; deployment pending)

- Evidence: production dependency audit identified the Astro AVIF optimization remote-code-execution advisory in the previously installed 7.1.3.
- Fix: `apps/ttngh/package.json` pins Astro 7.3.8, which closes the critical AVIF issue and the applicable script/style-rendering issue while remaining compatible with Node 22.18. The live-content build and 22-page built-site validation pass.
- Residual risk: this changes build tooling, not already-generated static HTML. CI or any environment building untrusted AVIF content remains exposed until the fix is merged and used for deployment.
- Residual audit findings: Astro 7.3.8 remains listed for a low-severity dynamic-tag advisory; no untrusted dynamic tag names were found in TTNGH. The audit also lists an `@astrojs/node` image-endpoint issue, but TTNGH produces static output and does not install that adapter. Astro 7.4.7+ requires Node 22.23.4+, so complete removal should accompany an explicit build-runtime upgrade.

### SEC-02 — Secure draft preview does not exist (P1)

- Evidence: `docs/apps/ttngh/content-operations.md:74` explicitly says the static site has no draft-preview sessions; repository search found no Presentation, Visual Editing, draft-mode or stega integration. `apps/ttngh/src/layouts/BaseLayout.astro:133` supplies noindex based on preview host/config, but that is indexing control, not preview authentication.
- Impact: the requested secure editor preview/click-to-edit capability cannot be certified. Adding draft queries without server-side access control would create a content disclosure risk.
- Recommendation: define an approved server-side preview session design, authenticate editors, scope read tokens to the server, enforce noindex and host access, prevent cache mixing, and add draft-leak tests before provider configuration.

### SEC-03 — CSP permits inline scripts and styles (P2)

- Evidence: `apps/ttngh/public/_headers:2` includes `'unsafe-inline'` for script and style.
- Positive controls: the same policy restricts default/base/object/frame ancestors, allows Turnstile only in `frame-src`, and limits image/connect sources. Production also returned CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy and a restrictive permissions policy.
- Recommendation: inventory Astro inline output, analytics and Turnstile; introduce hashes/nonces on preview; remove allowances only after browser and deployment compatibility tests.

### SEC-04 — Sanity Studio/editor dependency maintenance (P2, direct update completed)

- Evidence: Sanity Studio was upgraded from 6.18.0 to the current supported 6.25.0, together with current direct React and styled-components releases. All 10 schema tests and the production Studio build pass. The editor/build tree is separate from the public static visitor runtime.
- Recommendation: continue supported Studio upgrades and normal origin/access controls. Validate any future TTNGH-scoped override before use; do not add a monorepo-wide override without testing every affected application.

### SEC-05 — Frontend security/build CI added (P1, resolved)

- Evidence: `.github/workflows/ttngh-site.yml` now runs frozen install, website/Studio tests, deterministic production build, built-site validation, Studio build and responsive Playwright QA for TTNGH paths. GitHub Actions run `46158120012` passed at commit `de0210f12`.
- Recommendation: keep the workflow required for TTNGH changes and keep the supported Node, pnpm and Playwright versions explicit.

## Positive controls verified

- `services/ttngh-api/src/app.js:15-24` disables framework disclosure, applies explicit proxy trust, shared security headers and request IDs.
- `services/ttngh-api/src/app.js:31-47` rate-limits enquiries, requires an exact configured origin and JSON, bounds the body to 16 KB without compression, uses strict Zod parsing and requires Turnstile.
- `services/ttngh-api/src/enquiry.js:4-20` rejects control characters, bounds every field, requires UUID/consent/token, and checks Turnstile hostname, action and freshness.
- `services/ttngh-api/src/app.js:72-94` rate-limits and bounds Sanity webhooks, verifies the signature and timestamp, rejects drafts/versions and unexpected project/dataset/types, deduplicates events, and uses a ten-second outbound timeout.
- `services/ttngh-api/src/config.js:8-33` validates exact origins, rejects production Turnstile test keys, prevents unsafe multi-replica in-memory controls, restricts build hooks to Cloudflare's HTTPS deploy-hook path and defaults to no trusted proxy.
- `services/ttngh-api/src/contact/store.js:15-36` uses a transaction, parameterized values and an idempotent submission identifier/fingerprint check.
- `services/ttngh-api/src/contact/store.js:39-105` uses bounded attempts, leases, review state and `SKIP LOCKED`; notification retries do not silently lose accepted enquiries.
- `services/ttngh-api/src/enquiry.js:34-50` HTML-escapes visitor content before inserting it in staff email markup.
- Static search found no `eval`, unsafe browser token storage, untrusted redirect, source map publication or uncontrolled `dangerouslySetInnerHTML` in the TTNGH application. JSON-LD uses the shared controlled serializer rather than visitor HTML.
- Tracked files contain no `.env` file; environment documentation names variables without embedding secret values.

## Verification

- Website tests: 62/62 passed.
- Studio tests: 10/10 passed; Studio build passed.
- API tests: 65/65 passed with local isolated providers and sockets, including media isolation and migration gates.
- Production-content build: 22 pages; built HTML passed metadata, H1, JSON-LD, asset and destination checks.
- Production API health: HTTP 200, enquiries reported ready.
- `git diff --check`: passed.

## Deployment checklist

Before production: review the lockfile change, run the frozen install and audit in CI, deploy to an isolated preview, verify CSP/Turnstile/analytics behaviour, prove preview hosts are noindex and access-controlled, rerun browser suites, then deploy and verify the exact production headers and API health. Keep secrets in provider configuration and preserve the current rollback target.
