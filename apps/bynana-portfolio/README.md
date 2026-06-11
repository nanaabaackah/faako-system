# ByNana Portfolio

Workspace package: `@faako/bynana-portfolio`

ByNana Portfolio is Nana Aba Ackah's public portfolio site. It presents projects, writing, resume material, and contact entry points.

## What Lives Here

- `src/`: React + Vite frontend
- `public/fonts/`: current custom font assets used by the site
- `public/_redirects`: SPA fallback routing
- `.env.example`: local public configuration reference

## Run It Locally

```bash
pnpm --filter @faako/bynana-portfolio run dev
```

The frontend uses the normal Vite dev port unless another process already owns it.

## Common Commands

```bash
pnpm --filter @faako/bynana-portfolio run build
pnpm --filter @faako/bynana-portfolio run preview
pnpm --filter @faako/bynana-portfolio run lint
```

## Configuration

The static frontend should only receive browser-safe `VITE_*` values. The contact form opens a mail draft by default; configure `VITE_CONTACT_SUBMIT_ENDPOINT` only when a dedicated browser-callable contact API exists.

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
