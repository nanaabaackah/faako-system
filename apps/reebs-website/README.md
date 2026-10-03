# REEBS Website

Workspace package: `@faako/reebs-website`

The REEBS Website is the public Astro storefront for rentals, shop products,
booking, checkout, policies, and customer access. React is retained only for
interactive islands and the existing storefront views; this app is not a React
SPA.

## Structure

- `src/pages/`: Astro route files and static catalogue routes
- `src/layouts/BaseLayout.astro`: canonical metadata, social metadata, robots,
  and safely serialized JSON-LD
- `src/views/`: existing React storefront designs mounted as Astro islands
- `src/components/catalogue/`: crawlable category/product/status components
- `src/components/islands/`: narrowly scoped React hydration boundaries
- `src/content/public-catalogue.json`: generated, public-field-only snapshot
- `scripts/refreshPublicCatalogue.mjs`: refreshes the snapshot from the public API
- `scripts/auditStaticRoutes.mjs`: checks built links and catalogue route coverage
- `scripts/validateSitemap.mjs`: validates sitemap inclusion and exclusion

## Run locally

Frontend only:

```bash
pnpm --filter @faako/reebs-website run dev:frontend
```

Full local REEBS stack:

```bash
pnpm --filter @faako/reebs-website run dev:with-backend
```

The combined command runs the Portal Prisma predeploy because the Portal backend
owns the REEBS database and API. Typical ports are website `5173`, Portal `5174`,
and API `8888`.

## Catalogue and SEO

Refresh the allowlisted public catalogue snapshot before a production build when
catalogue data has changed:

```bash
pnpm --filter @faako/reebs-website run catalogue:refresh
```

The Astro build generates the sitemap from actual static routes. It excludes
cart, checkout, customer login, reset-password, and status pages.

Rental detail hydration retains the published catalogue item when a partial or
cached inventory response contains only other rentals. A matching live rental
takes precedence; the fallback never substitutes an item for a different URL.
This is a browsing fallback, not permission to book or purchase. Public commerce
remains governed by the shared policy and authoritative API guards.

```bash
pnpm --filter @faako/reebs-website run build
pnpm --filter @faako/reebs-website run sitemap:check
pnpm --filter @faako/reebs-website run test:routes
```

## Browser regression checks

`test:e2e` runs the responsive storefront suite. When `REEBS_PREVIEW_URL` is
provided, it targets that already-running static preview without starting a
development server. Without it, Playwright uses the local development server.
CI supplies the preview URL so the checks exercise the artifact it just built.
The paused-commerce regression covers both fresh and cached inventory responses
and asserts the published rental heading, disabled booking action and offer-free
structured data.
Accessibility checks wait for page and cookie-control hydration and use reduced
motion so scroll-reveal transitions do not distort contrast readings or hide
footer content from the scan. Viewport and keyboard checks retain normal motion.
The consent banner uses the existing dark text token on its green Accept button
and an underlined dark privacy link, retaining the approved palette and layout.

## Configuration

Browser-visible values include:

- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL` (legacy fallback)
- `VITE_REEBS_PORTAL_URL`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_ENABLE_GA_IN_DEV`

Never place secrets in `VITE_*` values. Optional analytics only initializes after
the customer has granted analytics consent.

## Deployment

Build command:

```bash
pnpm --filter @faako/reebs-website run build
```

Output directory: `apps/reebs-website/dist`.

The production site should use the deployed REEBS API. The generated public
catalogue contains no cost, margin, supplier, internal-note, customer, or Water
finance fields.

See `docs/apps/reebs/storefront-seo-aeo-phase-8.md` for the indexability map,
rendering model, data boundary, analytics map, and manual Search Console steps.
