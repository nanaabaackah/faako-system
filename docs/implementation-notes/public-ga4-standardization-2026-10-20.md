# Public GA4 standardization implementation note

Date: 2026-10-20

## Confirmed root causes

- Consent and route state were implemented differently across applications, which made behavior and verification inconsistent.
- Shared page-view deduplication lived only in a React component instance. Remounts could resend a page, while query/hash-only changes could create identical sanitized page views.
- TTNGH and Travel With Ease kept a local `pageViewSent` flag after withdrawal, preventing the current page from being recorded after a later valid grant.
- Shared consent withdrawal disabled collection but did not consistently remove accessible GA cookies; TTNGH had a private copy of cleanup logic.
- Stroane's compatibility runtime used an inverted storefront predicate, allowing its tracker on portal routes instead of restricting it to the public storefront.
- Faako Website, REEBS Website, and Stroane did not expose a persistent in-site control for reopening preferences and withdrawing analytics consent.
- Several consent readers treated incomplete stored objects as valid choices. REEBS also defaulted the customization checkbox to analytics enabled before a choice.
- The Vite development middleware previously referenced the wrong bootstrap variable; this was corrected and is now covered by a middleware test.
- Travel With Ease has no configured local measurement ID, so no Google tag can be detected there until its own stream is approved and configured.

## Implemented changes

- Centralized Do Not Track, per-path deduplication, consent withdrawal, GA-cookie cleanup and safe diagnostics in `@faako/utils`.
- Kept `send_page_view: false` and one explicit page-view event after initialization.
- Standardized public React adapters on explicit analytics/marketing consent objects.
- Corrected Stroane storefront/portal isolation.
- Added schema validation to stored consent and persistent Cookie settings controls where missing.
- Kept the Astro and React/Vite framework boundaries unchanged.
- Expanded unit, plugin, CSP, application-contract and TTNGH browser coverage.
- Added `pnpm run analytics:check-builds` to validate compiled app-specific tags without exposing their IDs and to guard the Stroane admin boundary.

No deployment, Google property change, production secret change, or framework migration was performed. Local environment values were inspected only for presence/format and were not copied into tracked files or logs.

## Verification result

- Locally configured builds passed for byNana Portfolio, Faako Website, REEBS Website, Stroane storefront and TTNGH. Travel With Ease correctly reported `UNCONFIGURED`.
- Shared unit tests, Vite bootstrap tests, discovery contracts, application tests, typechecks, lint and production builds passed. REEBS lint retained one pre-existing React Hooks warning in `CartContext.jsx`.
- Isolated browser QA passed for TTNGH and Stroane with Google requests mocked. This covered opt-in, initial and routed page views, deduplication, withdrawal, cookie cleanup and Do Not Track without sending test traffic to GA.
- On 2026-10-20, read-only HTTP probes returned 200 for the documented byNana, Faako, REEBS, Stroane and TTNGH production origins. Faako's response did not include a Content-Security-Policy header, while the other four responses did include GA-compatible CSP allowances. The repository configuration is corrected, but Faako's hosting/header application must be verified after deployment.
- Google Tag Assistant and GA4 DebugView/Realtime were not run against the undeployed changes. Hosted Google receipt remains an explicit post-deployment check and is not claimed here.
