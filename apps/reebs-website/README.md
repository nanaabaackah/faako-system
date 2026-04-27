# Reebs Website

Workspace package: `@faako/reebs-website`

Reebs Website is the public REEBS storefront, rentals, and booking site. It is the customer-facing half of the REEBS stack and works against the portal/backend for real product, rental, booking, and portal-entry flows.

## What Lives Here

- `src/`: React + Vite public website
- `scripts/generateSitemap.mjs`: sitemap generation used before builds
- `netlify.toml`: deploy configuration
- `.env.example`: public runtime variable reference

## Run It Locally

Frontend only:

```bash
pnpm --filter @faako/reebs-website run dev:frontend
```

Full local REEBS stack:

```bash
pnpm --filter @faako/reebs-website run dev:with-backend
```

Equivalent root shortcut:

```bash
pnpm run dev:reebs
```

Typical local ports:

- website: `5173`
- companion portal frontend: `5174`
- companion backend/functions: `8888`

## Current System Notes

- rental listings and rental detail pages now resolve through the same shared rental catalog rules so storefront links and detail slugs stay in sync
- this app should stay frontend-focused in production and point at the deployed REEBS portal/backend for data and auth-adjacent flows

## Configuration

Important browser-visible values:

- `VITE_BACKEND_BASE_URL`
- `VITE_REEBS_PORTAL_URL`

Keep secrets in the portal/backend environment, not in `VITE_*` values.

## Common Commands

```bash
pnpm --filter @faako/reebs-website run sitemap
pnpm --filter @faako/reebs-website run build
pnpm --filter @faako/reebs-website run netlify
pnpm --filter @faako/reebs-website run test:e2e
```

## Deployment

This app has its own Netlify config in `apps/reebs-website/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/reebs-website run build
```

The site should point at the deployed REEBS portal/backend in production.
