# Reebs Website

Workspace package: `@faako/reebs-website`

Reebs Website is the public REEBS storefront, rentals, booking, and contact-intake site. It is the customer-facing half of the REEBS stack and works against the portal/backend for real product, rental, booking, contact request, and portal-entry flows.

## What Lives Here

- `src/pages/` and `src/layouts/`: Astro route, metadata and static-output layer
- `src/views/` and `src/components/`: preserved React storefront experiences mounted by Astro islands
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

This combined command runs the REEBS Portal local Prisma predeploy first because
the portal backend owns the REEBS database/API used by the public website.

Equivalent root shortcut:

```bash
pnpm run dev:reebs
```

Typical local ports:

- website: `5173`
- companion portal frontend: `5174`
- companion API backend: `8888`

## Current System Notes

- Astro owns every public route, metadata, structured data and static output.
  The established React storefront views and shared chrome are rendered by
  Astro, then hydrated for cart, filters, authentication and live inventory.
- Shop and Rentals include useful catalogue content in the initial generated
  HTML rather than a client-only loading shell. The Shop index renders a
  representative set from every public category; the generated category and
  product pages retain full catalogue coverage for search discovery.
- The shared navbar and footer are also server-rendered on generated category,
  product and error pages. The party-planning CTA therefore remains present
  across the storefront.
- About is intentionally omitted from the desktop and mobile navbar. The About
  page remains public, crawlable and linked from the footer.
- Shop, Rentals and rental-detail routes intentionally preserve the established
  React site chrome and page designs inside Astro routes. Do not replace them
  with a separate catalogue header/prelude/footer or disable their chrome.
- rental listings and rental detail pages now resolve through the same shared rental catalog rules so storefront links and detail slugs stay in sync
- this app should stay frontend-focused in production and point at `https://api.reebspartythemes.com` for data and auth-adjacent flows
- the contact form posts to `/api/contact`; the portal backend validates/rate-limits the request, stores it in CRM as a planning request, links or creates a customer, creates follow-up activity, and then sends the notification email
- the shared `AppUpdateNotice` is mounted in the app shell, enabled in production, and testable locally with `VITE_ENABLE_APP_UPDATE_NOTICE=true`; it prompts for a user-controlled refresh when a newer deployed bundle exists

## Design Preservation

REEBS website work is enhancement-first. Preserve existing page composition,
navigation, branding, imagery, typography and conversion sections unless the
owner explicitly approves a visual change. Any proposed redesign or visible
layout change must be shown for approval before implementation. Bug fixes,
accessibility corrections and responsive repairs should remain visually scoped
and must not silently replace an established page design.

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
pnpm run bundle:reebs
```

The bundle report requires current Portal and Website builds. Performance and dependency
boundaries are documented in `docs/apps/reebs-portal/performance-and-dependencies.md`.

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
