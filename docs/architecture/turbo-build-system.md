# Turbo build system

Date: 2026-07-26

## Scope

This document describes the build graph after inspecting the root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, every active workspace manifest, and every Astro, Vite, PostCSS, Tailwind, and Prisma build configuration.

The repository uses pnpm 10.33.0 with `apps/*` and `packages/*` workspaces. Ten applications and eighteen source-consumed packages are active. `apps/ttngh` has no package manifest and is not part of the graph.

## Root build contract

`pnpm build` runs `turbo run build` in strict environment mode. The root build task:

- depends on `^build`, so internal package dependencies are represented before their consuming applications;
- hashes package-local `.env` and `.env.*` files in addition to Turbo's default tracked inputs;
- hashes `NODE_ENV`, `PUBLIC_*`, and `VITE_*`;
- declares `dist/**` as the standard deployable output;
- hashes the root package manifest, lockfile, workspace definition, and shared Vite build helpers;
- caches deterministic builds and restores their `dist` directories.

Turbo creates dependency nodes even for source-consumed internal packages without a physical `build` script. Their source files and internal package edges therefore participate in application build hashes. A change in a declared `workspace:*` dependency invalidates the affected application build without adding meaningless package compilation scripts.

## Application build inventory

| Application | Framework/configuration | Build command | Output | Cache policy |
| --- | --- | --- | --- | --- |
| `@faako/bynana-portfolio` | Astro, `astro.config.mjs` | Astro static build, then image optimization | `dist/**` | Cached |
| `@faako/dev-erp` | Vite, `vite.config.js`; Prisma | Prisma generate, then Vite build | `dist/**` | Not cached; Prisma generation writes outside the declared artifact |
| `@faako/faako-api` | Node/Express; Prisma runtime | Intentional no-compilation verification | None | Cached result, explicit empty outputs |
| `@faako/faako-erp` | Vite, `vite.config.mjs` | Vite build | `dist/**` | Cached |
| `@faako/faako-website` | Astro, `astro.config.mjs` | Astro static build plus CSP finalizer | `dist/**` | Cached |
| `@faako/reebs-portal` | Vite, PostCSS, Tailwind | Vite build | `dist/**` | Cached |
| `@faako/reebs-website` | Astro static output with React islands | Astro build plus CSP/redirect finalizer | `dist/**` | Cached |
| `@faako/stroane-web` | Vite, PostCSS, Tailwind; separate storefront/admin entries; Prisma API | Deterministic storefront and admin browser builds; API generation is a separate command | `dist/storefront/**`, `dist/admin/**` | Cached browser artifacts; API generation remains outside the browser build |
| `@faako/system-starter` | Vite, `vite.config.js` | Vite build | `dist/**` | Cached |
| `@faako/ui-workbench` | Vite, `vite.config.js` | Vite build | `dist/**` | Cached |

All active frontend configurations currently use their framework's default `dist` directory. Faako API is the only active build workspace without a filesystem artifact.

## Internal dependency graph

Application dependencies are defined through `workspace:*` manifest entries:

| Application | Direct internal dependencies |
| --- | --- |
| Portfolio | `@faako/ui` |
| Dev ERP | `@faako/config`, `@faako/email-kit`, `@faako/finance`, `@faako/logger`, `@faako/notifications`, `@faako/offline-sync`, `@faako/security`, `@faako/ui`, `@faako/utils`, `@faako/validation` |
| Faako API | `@faako/api-contracts`, `@faako/security` |
| Faako ERP | `@faako/api-client`, `@faako/api-contracts`, `@faako/config`, `@faako/ui`, `@faako/utils` |
| Faako Website | `@faako/ui` |
| REEBS Portal | `@faako/config`, `@faako/core`, `@faako/finance`, `@faako/notifications`, `@faako/offline-sync`, `@faako/security`, `@faako/ui`, `@faako/utils` |
| REEBS Website | `@faako/api-client`, `@faako/core`, `@faako/finance`, `@faako/theme`, `@faako/types`, `@faako/ui`, `@faako/utils`, `@faako/validation` |
| Stroane | `@faako/core`, `@faako/notifications`, `@faako/offline-sync`, `@faako/security`, `@faako/theme`, `@faako/types`, `@faako/ui`, `@faako/utils` |
| System Starter | `@faako/ui`, `@faako/utils` |
| UI Workbench | `@faako/theme`, `@faako/ui`, `@faako/utils` |

The internal package graph continues through:

- `@faako/api-client` to `@faako/api-contracts`;
- `@faako/config` to `@faako/types`;
- `@faako/theme` to `@faako/types`;
- `@faako/utils` to `@faako/types`;
- `@faako/ui` to `@faako/security`, `@faako/theme`, `@faako/types`, and `@faako/utils`.

These manifest edges are the source of truth for Turbo ordering and cache invalidation. Vite aliases point to the same package source but do not replace the need for manifest dependencies.

## Package-specific policies

Package-level `turbo.json` files extend the root configuration:

- Dev ERP and Stroane disable build caching while retaining the root inputs, outputs, environment hashing, and dependency graph.
- Their Prisma environment names are added to strict-mode availability.
- Faako API replaces the inherited `dist/**` output with an empty output list.

Tests, E2E, development servers, and database side-effect tasks remain uncached. Lint and type-check remain output-free. No deployment task is cached.

## Configuration ownership

When adding an application:

1. declare every internal package in its manifest;
2. use a standard `build` script;
3. declare a package-level output override when the artifact is not `dist/**`;
4. declare build environment names and `.env` inputs;
5. disable caching if the build performs network calls, database operations, deployment, or undeclared filesystem side effects;
6. inspect the resolved task with `pnpm exec turbo run build --dry-run=json`.

No framework migration is implied by this build model.
