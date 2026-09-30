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

```bash
pnpm --filter @faako/reebs-website run build
pnpm --filter @faako/reebs-website run sitemap:check
pnpm --filter @faako/reebs-website run test:routes
```

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
