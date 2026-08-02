# Faako Website Astro migration

Status: implementation and local validation complete; production promotion is intentionally pending a Cloudflare preview review.

## Outcome

`apps/faako-website` is now an Astro 7 static public site. Astro owns routes, HTTP error documents, metadata, canonicals, structured data, sitemap generation, robots directives, navigation documents, and the deployment artifact. React is retained only at explicit compatibility or interaction boundaries.

Faako ERP, Dev ERP, Faako API, and authenticated operational modules were not modified.

## Architecture

- `astro.config.mjs` defines the production origin, static output, React integration, sitemap filter, and local API proxy.
- `src/layouts/BaseLayout.astro` owns the accessible shell, metadata, social previews, JSON-LD, analytics/consent boundaries, and full-document navigation.
- `src/pages/` contains route documents only.
- `src/views/` contains the retained route-scoped React views.
- `src/components/islands/` makes every hydration decision visible.
- `src/content/seo.js` is the single source for route metadata and factual structured data.
- `src/lib/publicApi.js` uses `@faako/api-client` without exposing server configuration.
- `scripts/finalize-static-headers.mjs` adds SHA-256 hashes for every generated inline Astro script to the deployment CSP.

The obsolete Vite entry point, SPA router shell, unused context providers, unused database runtime configuration, public PostgreSQL dependencies, unreachable visual components, and unreachable case-study detail component were removed after import and route verification.

## Route and content parity

All paths from the previous `App.jsx` router are accounted for in [the route map](./faako-astro-route-map.md). Six valid module IDs are generated at build time. The old `/case-studies/:slug` behaviour was already a redirect to the list and is preserved as a versioned wildcard 301 rule.

No public copy was invented for the migration. Metadata descriptions and structured data are based on visible route content. Login, recovery, and dashboard prototypes are preserved, marked no-index, and not represented as production authentication.

## Hydration classification

| Area | Treatment | Reason |
| --- | --- | --- |
| Layout, metadata, status codes, error page | Plain Astro | Static and search-critical |
| About, privacy, terms, module details, 404 content | React SSR with no client directive | Existing content retained with zero page-view hydration |
| Home | `client:idle` | Search content is in HTML; lower-page controls can wait |
| Solutions, case studies, pricing | `client:visible` | Static HTML is immediate; interaction/animation waits for visibility |
| Configure, contact, signup, client setup | `client:load` | The primary task is interactive |
| Dashboard, login, recovery prototypes | `client:load`, no-index | Existing prototype behaviour retained |
| Header and consent controls | `client:load` | Keyboard/mobile controls and consent are immediate |
| Footer language picker | `client:visible` | Third-party translation can wait |
| Update notice and scroll-to-top | `client:idle` | Non-critical enhancement |

This is more granular than the prior single React root and follows the transitional byNana pattern. A later content-only cleanup can convert the remaining server-rendered compatibility views to native `.astro` components; it is not required for route parity or zero-hydration delivery.

## Forms

- Signup and client setup preserve their fields, client validation, local drafts, honeypots, loading/success/error states, and per-submission idempotency keys.
- Draft initialization is now hydration-safe: server and first client render match before a saved browser draft is applied.
- The shared API client standardizes headers, JSON, credentials, request IDs, and safe error presentation. Unsafe mutations are not retried.
- Contact preserves the mail-client hand-off and now uses the shared contact schema, a honeypot, an error state, and duplicate-submit protection.
- Server-side PDF generation, email delivery, persistence, spam/rate-limit enforcement, and secret credentials remain in Faako API.

## SEO and AEO

Implemented:

- unique title and description per route;
- fixed-origin canonicals;
- Open Graph and Twitter metadata;
- index/no-index rules aligned with the sitemap;
- Organization, WebSite, WebPage, Service, and evidence-backed FAQ structured data;
- `robots.txt` and generated sitemap;
- real 404 and 500 documents;
- preserved URLs plus explicit redirect coverage;
- internal link and local asset validation.

FAQ schema uses only answers already visible on the home and pricing pages. Module Service schema uses the existing module content.

## Accessibility

Validated or improved:

- one visible `h1` on every generated destination;
- skip link and stable focus target;
- native landmarks and real anchor destinations;
- keyboard-operable mobile navigation with Escape dismissal;
- form labels and shared validation feedback;
- reduced-motion fallback;
- usable content for no-JavaScript visitors on static routes;
- no hidden content when JavaScript is unavailable.

The production Playwright smoke test uses a mobile viewport, exercises navigation, validation, and contact honeypot suppression, confirms no-JavaScript About content, checks direct routes and 404 status, and fails on page or console errors.

## Performance comparison

These figures compare complete build artifacts, not the bytes a single visitor downloads. Astro now splits JavaScript by route, so all-route totals are deliberately conservative.

| Signal | React/Vite baseline | Astro result | Change |
| --- | ---: | ---: | ---: |
| Generated public destinations | SPA shell | 22 static pages | Direct HTML for every route |
| JavaScript across build | 962,218 bytes | 861,298 bytes | -100,920 bytes (-10.5%) |
| CSS across build | 380,160 bytes | 364,022 bytes | -16,138 bytes (-4.2%) |
| Image assets | 14,152,289 bytes | 14,152,289 bytes | Unchanged |
| Total artifact | about 20 MiB | 18,270,869 bytes (17.4 MiB) | Smaller while adding pre-rendered route HTML |
| Page hydration | One application root on every route | Route-scoped; five content routes have no page-view hydration | Improved |

The largest remaining performance opportunity is the 14.2 MB legacy image set and the shared icon compatibility chunk. Those assets were not recompressed or visually changed in this migration.

## Security and deployment integrity

- No database or email-provider dependency remains in the public package.
- Browser variables remain explicitly public.
- API credentials are omitted from cross-origin intake requests.
- The security header keeps scripts restricted to self and approved providers.
- The build computes CSP hashes for all Astro inline bootstraps; it does not add `unsafe-inline` to `script-src`.
- Broken placeholder WhatsApp output was removed pending a verified business number.

## Validation record

Passing:

- `pnpm --filter @faako/faako-website run lint`
- `pnpm --filter @faako/faako-website run typecheck`
- `pnpm --filter @faako/faako-website run test`
- `pnpm --filter @faako/faako-website run build`
- `pnpm --filter @faako/faako-website run test:e2e` against the production preview

The browser test verified 20 public routes, mobile navigation and forms, no-JavaScript content, a real 404, and a clean console after hydration.

## Remaining production steps

1. Create a Cloudflare preview from the migration branch while leaving the current production deployment active.
2. Verify Cloudflare applies `_headers` and the `/case-studies/*` redirect.
3. Confirm the production API CORS allow-list accepts the preview origin and intake submissions in a controlled test.
4. Confirm the analytics measurement ID and consent event in the preview property.
5. Obtain a verified WhatsApp Business number before restoring a WhatsApp CTA.
6. Promote only after stakeholder content and mobile visual approval.

Rollback is documented in [the deployment runbook](../deployment/faako-website.md).
