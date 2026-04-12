# Reebs Website

Workspace package: `@faako/reebs-website`

Reebs Website is the public customer-facing website for the Reebs product. It explains the product, routes visitors to the portal, and uses the portal backend for local full-stack development and production API access.

## What Lives Here

- `src/`: React and Vite public website
- `scripts/generateSitemap.mjs`: sitemap generation used before builds
- `netlify.toml`: deploy configuration
- `.env.example`: public runtime variable reference

## Run It Locally

Frontend only:

```bash
pnpm --filter @faako/reebs-website run dev:frontend
```

Full local Reebs stack:

```bash
pnpm --filter @faako/reebs-website run dev:with-backend
```

Equivalent root command:

```bash
pnpm run dev:reebs
```

Default local ports:

- website: `5173`
- companion portal frontend: `5174`
- companion backend/functions: `8888`

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
pnpm --filter @faako/reebs-website build
```

The site is frontend-only in production and should point at the deployed Reebs portal/backend.
