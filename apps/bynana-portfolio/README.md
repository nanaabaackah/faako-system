# ByNana Portfolio

Workspace package: `@faako/bynana-portfolio`

ByNana Portfolio is Nana Aba Ackah's public portfolio site. It presents projects, writing, resume material, and contact entry points.

## What Lives Here

- `src/pages/`: Astro file-based routes, including generated project and article pages
- `src/layouts/BaseLayout.astro`: canonical metadata, social cards, and JSON-LD foundation
- `src/views/`: server-rendered React views retained during the visual-parity migration
- `src/content/`: project, article, and centralized SEO/AEO metadata
- `public/fonts/`: current custom font assets used by the site
- `public/_redirects`: SPA fallback routing
- `.env.example`: local public configuration reference

## Run It Locally

```bash
pnpm --filter @faako/bynana-portfolio run dev
```

Astro uses its normal development port unless another process already owns it.

## Common Commands

```bash
pnpm --filter @faako/bynana-portfolio run build
pnpm --filter @faako/bynana-portfolio run preview
pnpm --filter @faako/bynana-portfolio run lint
```

## Configuration

The static frontend should only receive browser-safe `VITE_*` values. The contact form opens a mail draft by default; configure `VITE_CONTACT_SUBMIT_ENDPOINT` only when a dedicated browser-callable contact API exists.

Astro statically renders every public URL. React remains as a compatibility island for the existing interactive visual layer, so page content, headings, canonical metadata, and structured data are present before JavaScript runs. `AppUpdateNotice` from `@faako/ui` remains mounted in that island.

SEO output is generated from `src/content/seo.js`. Project and article routes are derived from the same content records used by the UI, and `@astrojs/sitemap` generates `sitemap-index.xml` plus `sitemap-0.xml` during each build. Do not restore the old hand-maintained sitemap or the SPA catch-all redirect.

## Project Metadata Registry

Shared project metadata for future portfolio/case-study consumption lives in `@faako/config` under `packages/config/src/projectRegistry/projectRegistry.js`. Stroane Web is registered there as a public client website/product-catalogue project, but `caseStudyEnabled` remains `false`; this app should not auto-publish Stroane or any future client case study without an explicit UI/content pass and client-safe review. New apps created with `pnpm create:app` are automatically added as private draft project metadata so the portfolio pipeline has a placeholder without publishing the project.

Run this from the repo root when meaningful app changes should be reflected in shared project metadata:

```bash
pnpm run project-registry:check
```

The check reports missing or incomplete metadata as warnings only. Current portfolio pages still use their local content files until a separate migration is planned.

Trust stats load directly from `VITE_TRUST_STATS_ENDPOINT` when supplied, otherwise the homepage falls back to the public Dev ERP trust-stats endpoint.

## Deployment

Static hosts build with:

```bash
pnpm --filter @faako/bynana-portfolio run build
```

The publish folder is `apps/bynana-portfolio/dist`.

Before deploying, run:

```bash
pnpm --filter @faako/bynana-portfolio run lint
pnpm --filter @faako/bynana-portfolio run build
pnpm --filter @faako/bynana-portfolio run test:seo
pnpm --filter @faako/bynana-portfolio run test:standards
```

The production build optimizes copied JPEG and PNG files in `dist` without changing the original
portfolio photography or mockups in `public`.

The SEO regression test verifies that every public route has generated HTML, a title, description, canonical URL, JSON-LD, and server-rendered H1; it also checks sitemap coverage and the non-indexable 404 page.
