# Astro public-site standard

This is the target architecture for byNana Portfolio and future public-site migrations. It does not apply to authenticated ERP/portal applications merely because they share a brand.

## Boundary

Astro owns public, indexable documents:

- route and status handling;
- metadata, canonicals, social cards, and JSON-LD;
- navigation and static page composition;
- editorial content;
- images and fonts;
- analytics consent bootstrap;
- static forms or the browser boundary to a dedicated API.

React owns narrowly scoped interaction:

- cart/checkout state;
- booking or event selection;
- account-aware widgets;
- validated forms that need immediate client behaviour;
- complex filters or data tools;
- interactive visualizations.

Do not wrap an entire public site in one island after migration is complete. Authenticated portals remain separate React/Next applications according to the framework decisions.

## Recommended structure

```text
src/
  components/
    astro/
    islands/
  content/
  content.config.ts
  layouts/
    BaseLayout.astro
    ArticleLayout.astro
  lib/
    analytics/
    forms/
    seo/
  pages/
    index.astro
    404.astro
  styles/
public/
  _headers
  _redirects
  robots.txt
astro.config.mjs
```

Names may vary to fit an existing app, but framework-neutral records must not import React, Astro, database clients, or server secrets.

## Layout and metadata

The base layout accepts typed page metadata and emits:

- unique title and description;
- absolute canonical;
- explicit robots directive;
- OG and Twitter fields including image alt;
- theme colour, icons, and manifest;
- safe JSON-LD;
- skip link and stable main target.

The production origin is defined once with Astro’s `site` option. A page must not derive its canonical from an untrusted host header.

Serialize JSON-LD defensively and use only facts visible in or accountable to the page. The 404 layout returns a real 404 and is excluded from the sitemap.

## Content Collections

Use Content Collections when there are multiple records with a stable editorial shape:

- articles/news;
- projects/case studies;
- events;
- mental-health resources;
- programmes/services;
- products or rentals that are build-time content.

Collection schemas should validate slug, title, summary, publication/status fields, image metadata, indexability, and schema-specific facts. Export inferred public types. Keep secrets, private contact submissions, payment credentials, and database-only records out of collections.

Do not create a collection merely to wrap one hard-coded page. Do not duplicate an existing runtime catalogue without first deciding which source owns the data.

## React-island policy

| Need | Directive |
| --- | --- |
| Static copy, card, navigation, footer | no island |
| Below-the-fold interaction | `client:visible` |
| Non-critical global enhancement | `client:idle` |
| Immediate first-task interaction | `client:load` |
| Media-query-specific enhancement | `client:media` |

- Keep search-critical content outside islands.
- Pass serializable, browser-safe props.
- Avoid multiple islands that each fetch the same data.
- Provide usable HTML before hydration and an understandable failure state.
- Measure each island’s initial and lazy chunks.

byNana is transitional: static routes defer the compatibility island with `client:idle`; the contact route uses `client:load`. Pages should move to plain Astro incrementally rather than by another big-bang rewrite.

## Forms

- Use shared validation schemas where they match the accepted public input.
- Provide labels, field errors, an error summary/focus strategy, success feedback, and unsaved-change protection.
- Include spam controls appropriate to the risk: honeypot, bounded rate limit, and server verification.
- Browser forms call a public API origin. Secrets and provider credentials remain server-side.
- Preserve values on recoverable failure and do not display raw backend errors.
- Payment/donation initialization and webhook verification are server responsibilities. The browser never receives secret keys.

## Analytics

- Analytics is optional and consent-aware where required.
- The page renders and works without analytics.
- Load one measurement implementation; do not install competing page-view trackers.
- SPA/island navigation events must not duplicate full-document page views.
- Keep environment names documented, and never put secret analytics administration credentials in a public build.

## Images and fonts

- Prefer Astro’s image pipeline for local editorial images.
- Supply dimensions, meaningful alt, responsive sizes, and modern output.
- Prioritize only the LCP image; lazy-load galleries and below-the-fold images.
- Keep original/source media out of the deployment artifact when it is not referenced.
- Self-host licensed WOFF2 fonts where practical and include only used weights.

## Redirects and deployment files

- Keep verified route moves as exact rules in `public/_redirects` or the hosting project’s versioned equivalent.
- Do not add an SPA catch-all to a static Astro site.
- Keep security/cache headers in `public/_headers`.
- Generate sitemap entries from the production origin and filter non-indexable routes.
- Verify Cloudflare Pages direct URLs, 404s, redirects, and headers from the deployed preview before promotion.

## Environment-variable rules

Classify variables before use:

- `PUBLIC_*` or `VITE_*`: browser-readable, non-secret only;
- unprefixed server variables: build/server-only;
- provider secrets: API/Railway only, never the public Astro deployment.

Document names, ownership, required/optional status, and consumers. Build-affecting public variables must be included in Turbo’s environment hashing. Never log values.

## Required tests

- static output metadata and route manifest;
- sitemap/indexability agreement;
- local link, asset, duplicate-ID, and redirect checks;
- 404 response and direct URL checks;
- island/bundle budgets;
- keyboard, mobile navigation, form validation, reduced motion, and no-JavaScript checks;
- framework lint, type check, unit tests, and build.
