# Reebs Website

Workspace package: `@faako/reebs-website`

Reebs Website is the public REEBS storefront, rentals, and booking site. It is the customer-facing half of the REEBS stack and works against the portal/backend for real product, rental, booking, and portal-entry flows.

## What Lives Here

- `src/`: React + Vite public website
- `scripts/generateSitemap.mjs`: sitemap generation used before builds
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
- companion API backend: `8888`

## Current System Notes

- rental listings and rental detail pages now resolve through the same shared rental catalog rules so storefront links and detail slugs stay in sync
- this app should stay frontend-focused in production and point at `https://api.reebspartythemes.com` for data and auth-adjacent flows
- the shared `AppUpdateNotice` is mounted in the app shell, enabled in production, and testable locally with `VITE_ENABLE_APP_UPDATE_NOTICE=true`; it prompts for a user-controlled refresh when a newer deployed bundle exists

## Configuration

Important browser-visible values:

- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL`
- `VITE_REEBS_PORTAL_URL`

Prefer `VITE_API_BASE_URL`; `VITE_BACKEND_BASE_URL` is a legacy fallback. Keep secrets in the portal/API backend environment, not in `VITE_*` values.

## Common Commands

```bash
pnpm --filter @faako/reebs-website run sitemap
pnpm --filter @faako/reebs-website run build
pnpm --filter @faako/reebs-website run test:e2e
```

## Deployment

Cloudflare Pages builds with:

```bash
pnpm --filter @faako/reebs-website run build
```

Use these Cloudflare Pages settings:

- Build command: `pnpm --filter @faako/reebs-website build`
- Output directory: `apps/reebs-website/dist`
- Environment variable: `VITE_API_BASE_URL=https://api.reebspartythemes.com`
- Environment variable: `VITE_REEBS_PORTAL_URL=https://portal.reebspartythemes.com`

The site should point at the deployed REEBS API backend in production.
