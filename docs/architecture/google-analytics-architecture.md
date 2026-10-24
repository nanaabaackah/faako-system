# Public Google Analytics architecture

Date: 2026-10-20
Status: implemented; hosted receipt requires per-site verification

## Scope and decision

GA4 is a public-site capability only in this standard. It does not authorize analytics on Dev ERP, Faako ERP, REEBS Portal, REEBS Water, Travel With Ease Portal, or the Stroane admin artifact. No framework migration is required: the content sites retain Astro and the Stroane storefront retains React/Vite.

`@faako/utils` owns provider-neutral browser mechanics for GA4: measurement-ID resolution, consent commands, Do Not Track, script insertion, per-stream initialization, sanitized page views, duplicate suppression, cookie cleanup after withdrawal, and diagnostics. `@faako/ui` supplies the React Router adapter. Astro sites use a small app-owned consent component that calls the same shared utility.

The Vite HTML plugin is limited to the Stroane storefront/combined build. It emits a same-origin bootstrap that sets Google consent defaults to denied and does not load Google. The private portal build receives neither that bootstrap nor Google CSP allowances.

## Required lifecycle

1. Resolve the current application's own GA4 measurement ID. A missing ID disables the integration.
2. Before a choice, do not insert `gtag.js` and do not send a page view.
3. On analytics consent, respect Do Not Track, queue the consent command, insert the standard asynchronous Google tag once, configure the app's stream with automatic page views disabled, and send one explicit sanitized page view.
4. On navigation, send one page view for a new pathname. Query strings and fragments are removed and cannot create duplicate views.
5. On withdrawal, deny analytics/advertising storage, set Google's disable flag, remove `_ga` cookies accessible to the site, and block later page views. A later grant may send the current page once.
6. Never retry or invent a measurement ID. Never copy TTNGH's stream ID into another application.

## Application map

| Application | Framework | Public variable | Adapter and navigation | Deployment state |
| --- | --- | --- | --- | --- |
| byNana Portfolio | Astro documents + React island | `VITE_GA_MEASUREMENT_ID` | Shared React tracker; document navigation | Local ID present; hosted receipt not checked in this change |
| Faako Website | Astro documents + React islands | `VITE_GA_MEASUREMENT_ID` | Shared React tracker; document navigation | Local ID present; hosted receipt not checked in this change |
| REEBS Website | Astro documents + React islands | `VITE_GA_MEASUREMENT_ID` | Shared utility adapter; document navigation | Local ID present; hosted receipt not checked in this change |
| Stroane storefront | React/Vite | `VITE_GA_MEASUREMENT_ID` | Shared React Router tracker; SPA navigation | Local ID present; portal excluded; hosted receipt not checked in this change |
| TTNGH | Astro | `PUBLIC_GA_MEASUREMENT_ID` | Shared utility adapter; document navigation | Local ID present; user previously confirmed GA receipt; current change used mocked Google requests only |
| Travel With Ease Website | Astro foundation | `PUBLIC_GA_MEASUREMENT_ID` | Shared utility adapter; document navigation | User-supplied local ID verified in build on 2026-10-23; hosted receipt not verified |

`VITE_GA_ID` remains a compatibility fallback for existing Vite/Astro-with-Vite settings. New deployments should use the primary variable above. `VITE_ENABLE_GA_IN_DEV=true` is an explicit local-only override for applications that otherwise restrict analytics to production builds.

## Diagnostics and verification

After application JavaScript runs, `window.__faakoGoogleAnalyticsDiagnostics` contains only public/safe state keyed by measurement ID: configured, consent-defaulted, initialized, collection-enabled, Do Not Track, tag presence, last action, and last pathname. It contains no query string, fragment, form value, user identifier, or secret.

For each hosted site, use a clean browser profile with extensions disabled:

1. Before consent, confirm no `gtag/js` or GA collection request.
2. Grant analytics and confirm exactly one standard `gtag/js?id=<this site's ID>` request.
3. Confirm one `page_view` in Tag Assistant and GA4 DebugView/Realtime for the correct property and production hostname.
4. Navigate to another pathname and confirm one additional page view.
5. Reopen Cookie settings, withdraw analytics, navigate again, and confirm no new collection request.
6. Repeat with browser Do Not Track enabled and confirm initialization remains blocked.
7. Check the deployed CSP response header, not only the repository `_headers` file.

Local builds and mocked browser QA verify implementation behavior but do not prove that Google received production events. Record the date, deployment identifier, property owner, stream hostname, Tag Assistant result, and GA4 receipt result when that external verification is performed.

Run `pnpm run analytics:check-builds` after building the public sites. It checks, without printing measurement IDs, that every locally configured site compiled its own stream and the standard Google loader. It also verifies that the Stroane admin output contains neither. An `UNCONFIGURED` result requires deployment configuration before release.

## CSP contract

Public-site `script-src`/`script-src-elem` must allow `https://www.googletagmanager.com`. `connect-src` must allow the applicable `https://www.google-analytics.com`, `https://region1.google-analytics.com`, or reviewed Google Analytics wildcard endpoints. The Stroane admin artifact must not contain Google tag allowances.
