# Faako System Monorepo

Faako System is a PNPM + Turborepo workspace for the active Faako, Reebs, Dev ERP, ByNana, and support apps. The monorepo is organized around real running products plus shared shell, UI, theme, security, logging, and backend packages.

## Current Workspace

This repo currently contains 22 workspace packages:

- 10 deployable apps in `apps/`
- 12 shared packages in `packages/`

Main directories:

- `apps/`: deployable frontends, APIs, and full-stack app shells
- `packages/`: shared UI, theme, config, utils, types, core, security, logger, and email helpers
- `scripts/`: stack runners, selective deploy helpers, database refresh tools, and security checks
- `docs/`: platform notes, local database refresh guidance, monorepo notes, and security reports

## Apps

| Workspace package | Path | Purpose | Primary local command |
| --- | --- | --- | --- |
| `@faako/faako-api` | `apps/faako-api` | Faako Netlify Functions API for signup and health flows | `pnpm --filter @faako/faako-api run dev:backend` |
| `@faako/faako-website` | `apps/faako-website` | Faako marketing site and signup funnel | `pnpm --filter @faako/faako-website run dev:frontend` |
| `@faako/faako-erp` | `apps/faako-erp` | Shared-shell Faako ERP frontend | `pnpm --filter @faako/faako-erp run dev:frontend` |
| `@faako/reebs-portal` | `apps/reebs-portal` | REEBS admin portal plus Netlify backend | `pnpm --filter @faako/reebs-portal run dev:frontend` |
| `@faako/reebs-website` | `apps/reebs-website` | REEBS public storefront, rentals, and booking site | `pnpm --filter @faako/reebs-website run dev:with-backend` |
| `@faako/dev-erp` | `apps/dev-erp` | Fully live operational ERP with real operational data | `pnpm --filter @faako/dev-erp run dev:with-backend` |
| `@faako/bynana-portfolio` | `apps/bynana-portfolio` | ByNana public portfolio and serverless contact flows | `pnpm --filter @faako/bynana-portfolio run dev` |
| `@faako/stroane-web` | `apps/stroane-web` | Full-stack Stroane commerce app | `pnpm --filter @faako/stroane-web run dev:with-backend` |
| `@faako/system-starter` | `apps/system-starter` | Minimal starter app for the current shared shell system | `pnpm --filter @faako/system-starter run dev` |
| `@faako/ui-workbench` | `apps/ui-workbench` | Local playground for the shared UI system | `pnpm --filter @faako/ui-workbench run dev` |

## Shared Packages

| Package | Purpose |
| --- | --- |
| `@faako/config` | App-local ERP and shell configuration builders, plus shared ERP module registry helpers |
| `@faako/core` | Shared auth, organization, and template-config helpers |
| `@faako/email-kit` | Shared email rendering and theme helpers |
| `@faako/finance` | Shared payment and receipt constants, pure helpers, and presentation utilities |
| `@faako/logger` | Structured application logging for Node.js and serverless runtimes |
| `@faako/layout` | Shared ERP shell layout contracts, region names, and responsive layout helpers |
| `@faako/offline-sync` | Shared offline queue constants, local draft storage helpers, status hooks, and passive sync UI |
| `@faako/security` | Shared CSRF, throttling, secret, and security utilities |
| `@faako/theme` | Shared shell tokens and CSS foundations |
| `@faako/types` | Shared contracts and type definitions |
| `@faako/ui` | Shared shell primitives, navigation, fields, modal foundations, and compat styles |
| `@faako/utils` | Shared title, path, role, and layout observer helpers |

## Current Shared System

- `@faako/layout`, `@faako/ui`, and `@faako/theme` now define the common shell system used across the ERP and portal apps, including shell region contracts, uniform sidebar widths, the edge collapse toggle, shared topbar/content/mobile-nav wrappers, shared field sizing, and mobile-safe topbar behavior.
- The shared compat layer normalizes `select`, `date`, `time`, `month`, and related controls so Safari and other WebKit browsers do not fall back to mismatched native chrome unexpectedly.
- `@faako/utils`, `@faako/security`, `@faako/logger`, and `@faako/email-kit` hold the shared runtime helpers used by the current full-stack apps.
- `@faako/config` includes ERP module registry helpers in `packages/config/src/erpModules`. REEBS Portal, Dev ERP, and Faako ERP now use app-specific registries to feed navigation adapters while preserving current routes, labels, permission behavior, and flat navigation.
- ERP module conventions now include `visibility` and `state` metadata for hidden, disabled, internal, coming-soon, and experimental modules. Navigation ignores hidden modules, carries subtle state badges/classes for visible modules, and keeps disabled module routes available for now. These conventions prepare future org-level toggles, permissions integration, and SaaS plan gating, but they do not enforce access control, add billing, persist module settings, or change database behavior.
- Shared ERP shell conventions now include sidebar, topbar, mobile bottom navigation, page content, page header, module group, and status badge patterns. Placeholder slots exist for offline indicators, sync status, notifications, and a future organization switcher; these are structural only and do not implement backend behavior.
- REEBS Portal and Dev ERP now have documentation-only workflow reviews for order, payment, receipt, invoice, rent-payment, and balance behavior. Use those reviews before creating shared payment/receipt/order runtime packages or expanding `@faako/finance` beyond constants, helpers, and presentation utilities; no shared finance runtime behavior has been implemented yet.
- The shared Payment and Receipt architecture plan lives in [docs/platform/shared-payment-receipt-architecture.md](/Users/Nana/Desktop/Developer/faako-system/docs/platform/shared-payment-receipt-architecture.md). It is planning-only and sets the safety path for future payment/receipt constants, types, wrappers, gateways, offline support, and app-by-app migration.
- `@faako/finance` now contains shared payment/receipt constants, documented type-shape descriptors, pure formatting/normalization helpers, balance display helpers, metadata normalization helpers, and receipt presentation helpers. It does not implement payment recording, receipt generation, invoice persistence, gateway integrations, schema changes, API changes, or app workflow changes.
- `@faako/offline-sync` now contains shared offline queue constants, local draft storage helpers, IndexedDB queue storage helpers, retry metadata helpers, online/offline status hooks, and passive sync UI components. REEBS Portal uses local draft storage for Store Mode POS and manual order payment drafts only; Dev ERP uses visible online/offline indicators only. No queued business action sync or production write behavior has changed.

## Common Commands

Install dependencies from the repo root:

```bash
pnpm install
```

Helpful stack shortcuts:

```bash
pnpm dev
pnpm dev:faako
pnpm dev:reebs
pnpm dev:dev-erp
pnpm dev:workbench
pnpm dev:starter
```

Common workspace operations:

```bash
pnpm build
pnpm lint
pnpm test
pnpm affected:apps -- --files <path>
pnpm deploy:check -- <workspace-package> --files <path>
pnpm db:refresh:local
pnpm db:refresh:local:dry
pnpm db:refresh:local:biweekly
pnpm security:all
```

## Environment And Data Safety

- Use each app's `.env.example` file as the source of truth for local setup.
- `VITE_*` values are browser-visible and must stay non-secret.
- REEBS Portal and Dev ERP are both live systems with real data. Any change affecting auth, API permissions, customer/user data, payments, receipts, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, or database schema must be treated as production-sensitive.
- Local database refresh flows live in [docs/local-db-refresh.md](/Users/Nana/Desktop/Developer/faako-system/docs/local-db-refresh.md).
- Pre-commit and manual security scripts help catch secrets before they enter git history.

## Deployment

- `dev-erp` backend/server deploys through Railway using the root [nixpacks.toml](/Users/Nana/Desktop/Developer/faako-system/nixpacks.toml).
- The other deployable apps use Netlify, and each app owns its own `netlify.toml`.
- `faako-website` mirrors `faako-api` functions during build when it serves signup endpoints itself.
- Selective deploy checks are driven by [scripts/workspace-graph.mjs](/Users/Nana/Desktop/Developer/faako-system/scripts/workspace-graph.mjs) and [scripts/netlify-ignore.mjs](/Users/Nana/Desktop/Developer/faako-system/scripts/netlify-ignore.mjs).

## Docs

README update rule:

- Any time a new feature, module, workflow, integration, package, API endpoint, environment variable, setup step, deployment process, or security-related change is implemented, update the relevant README files in the same change.
- README updates should cover what changed, where the feature/module lives, how to use it, required environment variables, setup or migration steps, security or data impact, known limitations, and testing notes.
- Update the app-specific README for app changes, package README for shared package changes, the root README for monorepo-wide changes, and the relevant `docs/apps/<app>/implementation-notes.md` file when detailed implementation notes are needed.
- Do not leave implemented functionality undocumented.

Platform docs:

- [docs/app-platform.md](/Users/Nana/Desktop/Developer/faako-system/docs/app-platform.md)
- [docs/local-db-refresh.md](/Users/Nana/Desktop/Developer/faako-system/docs/local-db-refresh.md)
- [docs/monorepo-restructure.md](/Users/Nana/Desktop/Developer/faako-system/docs/monorepo-restructure.md)
- [docs/platform/shared-payment-receipt-architecture.md](/Users/Nana/Desktop/Developer/faako-system/docs/platform/shared-payment-receipt-architecture.md)
- [docs/security_best_practices_report.md](/Users/Nana/Desktop/Developer/faako-system/docs/security_best_practices_report.md)

App docs:

- [apps/faako-api/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/faako-api/README.md)
- [apps/faako-website/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/faako-website/README.md)
- [apps/faako-erp/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/faako-erp/README.md)
- [apps/reebs-portal/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/README.md)
- [apps/reebs-website/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-website/README.md)
- [apps/dev-erp/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/dev-erp/README.md)
- [apps/bynana-portfolio/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/bynana-portfolio/README.md)
- [apps/stroane-web/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/stroane-web/README.md)
- [apps/system-starter/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/system-starter/README.md)
- [apps/ui-workbench/README.md](/Users/Nana/Desktop/Developer/faako-system/apps/ui-workbench/README.md)
