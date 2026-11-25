# Faako System Monorepo

Faako System is a PNPM + Turborepo workspace for Faako, REEBS, Dev ERP, ByNana, Stroane, TTNGH, Travel With Ease, and support apps. The monorepo is organized around real running products plus shared shell, UI, theme, security, logging, and backend packages.

## Current Workspace

Manifest inventory reviewed 2026-11-06: 38 workspace members (excluding the root):

- 15 application workspaces in `apps/` (including starter/workbench)
- 21 shared packages in `packages/`
- TTNGH Studio in `apps/ttngh/studio`
- TTNGH API in `services/ttngh-api`

`pnpm-workspace.yaml` is authoritative. The Python shared analytics service at
`services/reebs-analytics` is not a PNPM workspace; its path is a compatibility
location, not permission to create separate application analytics services.

Main directories:

- `apps/`: deployable frontends, APIs, and full-stack app shells
- `packages/`: shared UI, theme, config, utils, types, core, security, logger, and email helpers
- `services/`: independently deployed TTNGH API and Python shared analytics runtime
- `scripts/`: stack runners, workspace graph helpers, database refresh tools, and security checks
- `docs/`: platform notes, local database refresh guidance, monorepo notes, and security reports

## Apps

| Workspace package | Path | Purpose | Primary local command |
| --- | --- | --- | --- |
| `@faako/faako-api` | `apps/faako-api` | Faako Express API for signup and health flows | `pnpm --filter @faako/faako-api run dev` |
| `@faako/faako-website` | `apps/faako-website` | Faako marketing site and signup funnel | `pnpm --filter @faako/faako-website run dev:frontend` |
| `@faako/faako-erp` | `apps/faako-erp` | Shared-shell Faako ERP frontend | `pnpm --filter @faako/faako-erp run dev:frontend` |
| `@faako/reebs-portal` | `apps/reebs-portal` | REEBS admin portal plus API wrapper backend | `pnpm --filter @faako/reebs-portal run dev:with-backend` |
| `@faako/reebs-website` | `apps/reebs-website` | REEBS public storefront, rentals, and booking site | `pnpm --filter @faako/reebs-website run dev:with-backend` |
| `@faako/dev-erp` | `apps/dev-erp` | Operational ERP for invoices, payments, rentals and reporting | `pnpm --filter @faako/dev-erp run dev:with-backend` |
| `@faako/bynana-portfolio` | `apps/bynana-portfolio` | ByNana public portfolio and contact entry points | `pnpm --filter @faako/bynana-portfolio run dev` |
| `@faako/stroane-web` | `apps/stroane-web` | Full-stack Stroane commerce app | `pnpm --filter @faako/stroane-web run dev:with-backend` |
| `@faako/system-starter` | `apps/system-starter` | Minimal starter app for the current shared shell system | `pnpm --filter @faako/system-starter run dev` |
| `@faako/reebs-water` | `apps/reebs-water` | REEBS water operations application | `pnpm run dev:reebs-water` |
| `@faako/ttngh` | `apps/ttngh` | TTNGH Astro public website | `pnpm run dev:ttngh` |
| `@faako/travel-with-ease-web` | `apps/travel-with-ease-web` | Astro public website, approved content and enquiries | `pnpm --filter @faako/travel-with-ease-web run dev` |
| `@faako/travel-with-ease-portal` | `apps/travel-with-ease-portal` | React/Vite staff CMS; hosted bundle embedded in the TWE API | `pnpm --filter @faako/travel-with-ease-portal run dev` |
| `@faako/travel-with-ease-api` | `apps/travel-with-ease-api` | Express authentication, CMS, enquiries, media and job boundaries | `pnpm --filter @faako/travel-with-ease-api run dev` |
| `@faako/ui-workbench` | `apps/ui-workbench` | Local playground for the shared UI system | `pnpm --filter @faako/ui-workbench run dev` |

Additional workspaces outside the one-level application list:

| Workspace package | Path | Responsibility | Local command |
| --- | --- | --- | --- |
| `@faako/ttngh-studio` | `apps/ttngh/studio` | Sanity editorial studio | `pnpm --filter @faako/ttngh-studio dev` |
| `@faako/ttngh-api` | `services/ttngh-api` | TTNGH enquiry/media backend | `pnpm --filter @faako/ttngh-api dev` |

## Shared Packages

| Package | Purpose |
| --- | --- |
| `@faako/api-client` | Shared browser API transport and normalized errors |
| `@faako/api-contracts` | Framework-neutral response/error contracts |
| `@faako/auth` | Shared authentication foundations; application policy remains app-owned |
| `@faako/discovery` | Public discovery, metadata and consent-aware analytics foundations |
| `@faako/validation` | Shared boundary-validation primitives |
| `@faako/water-domain` | Framework-neutral REEBS water domain contracts and helpers |
| `@faako/audit` | Shared audit event constants, safe metadata helpers, and display formatting foundations |
| `@faako/config` | App-local ERP and shell configuration builders, shared ERP module registry helpers, app-mode helpers, and monorepo app monitoring metadata |
| `@faako/core` | Shared auth, organization, and template-config helpers |
| `@faako/email-kit` | Shared email rendering and theme helpers |
| `@faako/finance` | Shared payment and receipt constants, pure helpers, and presentation utilities |
| `@faako/logger` | Structured application logging for Node.js API services and app runtimes |
| `@faako/layout` | Shared ERP shell layout contracts, region names, and responsive layout helpers |
| `@faako/notifications` | Shared notification constants, customer-safe templates, and user-triggered share helpers |
| `@faako/offline-sync` | Shared offline queue constants, local draft storage helpers, status hooks, review/recovery helpers, and passive sync UI |
| `@faako/org-settings` | Shared organization settings shapes, safe metadata helpers, display helpers, currencies, and timezones |
| `@faako/security` | Shared CSRF, throttling, secret, and security utilities |
| `@faako/theme` | Shared shell tokens and CSS foundations |
| `@faako/types` | Shared contracts and type definitions |
| `@faako/ui` | Shared shell primitives, navigation, fields, low-risk ERP form/table/modal/action presentation wrappers, and compat styles |
| `@faako/utils` | Shared title, path, role, and layout observer helpers |

## Architecture and shared responsibilities

| Boundary | Current implementation |
| --- | --- |
| Content-first public sites | Astro for Faako Website, REEBS Website, ByNana Portfolio, TTNGH and TWE; React islands where needed |
| Operational interfaces | React/Vite for ERP, portals and commerce; app-owned workflow and permissions |
| Node backends | Express APIs and app backends; Railway workspace selection via `RAILWAY_WORKSPACE` |
| Persistence | Existing Prisma migrations where applicable; TWE uses versioned PostgreSQL SQL migrations, not Prisma |
| Public delivery | Cloudflare Pages with checked headers/redirects and environment-specific configuration |
| TWE staff access | Cloudflare Access, application sessions and tenant-scoped authorisation; CMS embedded in API |
| TWE integrations | Private R2, approved Drive imports, queued Resend email, consent-controlled GA4 |
| Analytics | Shared architecture and Python compatibility runtime at `services/reebs-analytics`, not per-client clones |

Presentation components never replace authoritative backend permission checks.


- `@faako/layout`, `@faako/ui`, and `@faako/theme` now define the common shell system used across the ERP and portal apps, including shell region contracts, uniform sidebar widths, the edge collapse toggle, shared topbar/content/mobile-nav wrappers, shared field sizing, and mobile-safe topbar behavior.
- The shared compat layer normalizes `select`, `date`, `time`, `month`, and related controls so Safari and other WebKit browsers do not fall back to mismatched native chrome unexpectedly.
- `@faako/utils`, `@faako/security`, `@faako/logger`, and `@faako/email-kit` hold the shared runtime helpers used by the current full-stack apps.
- `@faako/config` includes ERP module registry helpers in `packages/config/src/erpModules`. REEBS Portal, Dev ERP, and Faako ERP now use app-specific registries to feed navigation adapters while preserving current routes, labels, permission behavior, and flat navigation.
- `@faako/config` also includes monorepo app metadata in `packages/config/src/monorepoApps`. Dev ERP monitoring consumes this config-driven list so monitored apps can include REEBS Portal/API, Dev ERP/API, Stroane Web/portal/API, Faako Website/API, REEBS Website, the portfolio site, and Faako ERP without maintaining a fragile local site list.
- Use `pnpm run monitoring:check` after adding apps to compare `apps/` against the shared monorepo app registry without exposing URLs or secrets.
- `@faako/config` includes app-mode helpers in `packages/config/src/appModes` for `normal`, `degraded`, `read_only`, and `maintenance` states. These helpers normalize environment/config values only; backend/API enforcement remains required for reliable write protection.
- ERP module conventions now include `visibility` and `state` metadata for hidden, disabled, internal, coming-soon, and experimental modules. Navigation ignores hidden modules, carries subtle state badges/classes for visible modules, and keeps disabled module routes available for now. These conventions prepare future org-level toggles, permissions integration, and SaaS plan gating, but they do not enforce access control, add billing, persist module settings, or change database behavior.
- Shared ERP shell conventions now include sidebar, topbar, mobile bottom navigation, page content, page header, module group, and status badge patterns. Placeholder slots exist for offline indicators, sync status, notifications, and a future organization switcher; these are structural only and do not implement backend behavior.
- Shared UI presentation conventions now include low-risk ERP panel, panel-header, section-header, stack, form-group, form-section, form-row, form-action, field, validation, notice, table, toolbar, search/filter/action, pagination, loading/empty, status badge, modal, drawer, confirm-dialog, and action-button wrappers. These are presentation-only and should be adopted gradually after visual checks; mobile POS layout, workflow-heavy forms/tables/modals, and deeper ERP page templates remain future design-system work.
- Shared ERP table conventions now include presentation-only table, toolbar, search/filter/action, pagination, loading/empty, and status badge wrappers in `@faako/ui`. Apps still own row data, filters, pagination state, row actions, permissions, and business workflows.
- Shared ERP form conventions now include presentation-only form, form section, form row, form actions, field group, common field controls, validation message, and form notice wrappers in `@faako/ui`. Apps still own form state, validation, submit handlers, API calls, auth/permission checks, local draft behavior, and workflow side effects.
- Shared ERP modal/action conventions now include presentation-only modal, drawer, confirm-dialog, action bar, button group, primary/secondary/danger actions, and icon action wrappers in `@faako/ui`. Apps still own open/close state, destructive-action policy, save/delete/submit handlers, API calls, auth/permission checks, and workflow side effects.
- Shared alert conventions now include presentation-only notices, alerts, banners, sync/offline notices, toast helpers, and ERP/generic maintenance/read-only/degraded-mode wrappers in `@faako/ui`. Generic app-mode wrappers use neutral `ui-app-mode-*` classes so public/client sites can keep their own branding through theme tokens and `className` overrides. These components do not enforce backend maintenance mode, read-only restrictions, degraded-mode behavior, permissions, or data-write rules.
- REEBS Portal and Dev ERP now have documentation-only workflow reviews for order, payment, receipt, invoice, rent-payment, and balance behavior. Use those reviews before creating shared payment/receipt/order runtime packages or expanding `@faako/finance` beyond constants, helpers, and presentation utilities; no shared finance runtime behavior has been implemented yet.
- The shared Payment and Receipt architecture plan lives in [docs/platform/shared-payment-receipt-architecture.md](docs/platform/shared-payment-receipt-architecture.md). It is planning-only and sets the safety path for future payment/receipt constants, types, wrappers, gateways, offline support, and app-by-app migration.
- `@faako/finance` now contains shared payment/receipt constants, documented type-shape descriptors, pure formatting/normalization helpers, balance display helpers, metadata normalization helpers, and receipt presentation helpers. It does not implement payment recording, receipt generation, invoice persistence, gateway integrations, schema changes, API changes, or app workflow changes.
- `@faako/notifications` now contains shared notification channel/type/status constants, customer-safe message templates, channel availability helpers, and user-triggered `mailto:`/WhatsApp draft link helpers. REEBS uses it for receipt summary copy/email/WhatsApp drafts, and Dev ERP uses it for the appointment link email draft. It does not send automated WhatsApp messages, emails, SMS, or in-app notifications, and it does not change Resend/email behavior, receipt/payment/order behavior, schema, or customer data handling.
- `@faako/offline-sync` now contains shared offline queue constants, local draft storage helpers, IndexedDB queue storage helpers, retry metadata helpers, queue summary/review helpers, online/offline status hooks, and passive sync UI components. REEBS Portal uses local draft storage for Store Mode POS/manual order payment drafts, queues offline Store Mode POS orders, queues offline manual order payments, queues offline inventory stock adjustments, and queues offline booking create/edit/status actions through existing server endpoints when online returns; Dev ERP queues new offline rent payments, keeps rent payment edits and booking/calendar settings online-only, and has no inventory adjustment surface wired for offline sync. REEBS Admin Workspace and Dev ERP Settings now expose local Sync Review panels for pending, failed, conflict, and needs-review queue visibility plus retry/cancel/mark-resolved controls. The server remains the source of truth for auth, permissions, stock validation, booking availability, rental/variant checks, payment persistence, receipt creation, accounting effects, balances, and final order/payment/inventory/booking status.

## Common Commands

Use Node.js 22 and the PNPM version pinned in `package.json` (`pnpm@10.33.0`).
Install dependencies from the repo root:

```bash
pnpm install --frozen-lockfile
```

Helpful stack shortcuts:

For Travel With Ease, run `pnpm run dev:twe` from the repository root.
This starts the website and login-free, isolated portal workspace together.
`pnpm run dev:twe:workspace` remains an alias; use `pnpm run dev:twe:public`
for the credential-isolated public/API development mode without workspace fixtures.
The general `pnpm run dev` starts every application's dev task; its concurrency
limit is 20. Use a stack shortcut
on a laptop to avoid starting unrelated applications.

```bash
pnpm dev
pnpm dev:faako
pnpm dev:reebs
pnpm dev:dev-erp
pnpm dev:workbench
pnpm dev:starter
pnpm dev:ttngh
pnpm dev:twe
```

Prisma-backed dev commands run their local predeploy migration checks first.
That means Faako API, Dev ERP, REEBS Portal/Website combined dev, and Stroane
generate Prisma clients and apply pending development migrations before their
long-running local servers start.

Common workspace operations:

```bash
pnpm build
pnpm lint
pnpm test
pnpm run monitoring:check
pnpm run hosting:check
node scripts/check-repository-hygiene.mjs
pnpm affected:apps -- --files <path>
pnpm db:refresh:local
pnpm db:refresh:local:dry
pnpm db:refresh:local:biweekly
pnpm security:all
```

## Travel With Ease

Current release status: [P3 release preparation — 2026-11-25](docs/apps/travel-with-ease/release-preparation-2026-11-25.md). Staging P0–P2 implementation and live acceptance are complete on `d3114b5`; production migration, worker, recovery and promotion gates remain open. The [TWE documentation index](docs/apps/travel-with-ease/README.md) retains historical decisions.

| Surface | Current operating model |
| --- | --- |
| Public site | Astro with approved packages, services, Journal, Travel Tips, native enquiry forms and responsive brand design. |
| CMS | React/Vite embedded in Railway API; structured content and rich text, autosave, private Astro preview, immutable revisions, media and contextual email templates. |
| Publishing | PostgreSQL job, separate Railway worker, pinned source and snapshot, Cloudflare Pages deployment and marker verification before Live. |
| Authentication | Cloudflare Access and verified server session; Superadmin (`platform_admin`), Owner and Editor, with backend permission enforcement. |
| Email | Independent Railway notification worker and Resend; actual receipt is a separate acceptance check. |
| Analytics | Consent-gated GA4, private route exclusion and published-content SEO/AEO. |

Use existing Faako components and icons, preserve approved typography, and avoid unnecessary UI copy. No separate approval workflow is needed to transfer already approved staging content to production.

### TWE development and verification

```bash
pnpm run dev:twe
pnpm --filter '@faako/travel-with-ease-*' run lint
pnpm --filter '@faako/travel-with-ease-*' run typecheck
pnpm --filter '@faako/travel-with-ease-*' run build
pnpm --filter '@faako/travel-with-ease-*' run test
pnpm --filter @faako/ui test
pnpm --filter @faako/travel-with-ease-api run test:db:isolated
```

Local ports: website 4328, portal 5188, API 3090. Local public pages use the approved
content baseline. Retired public demo routes remain absent.
The default `dev:twe` command (also aliased as `dev:twe:workspace`) provides a loopback-only,
in-memory synthetic portal with role switching/reset and no real external actions.
The `dev:twe:public` API development launcher
deliberately does not load hosted `.env` credentials or enable real staff login.
Never point isolated tests at a shared database. Direct `test:db` requires the
documented disposable test database; it is mandatory in TWE foundation CI.

### TWE environments and releases

| Surface | Staging | Production |
| --- | --- | --- |
| Website | https://staging.travelwitheasegh.com | https://travelwitheasegh.com |
| Protected staff CMS | https://portal-staging.travelwitheasegh.com | https://portal.travelwitheasegh.com |
| API | https://staging-api.travelwitheasegh.com | https://api.travelwitheasegh.com |

Railway hosts the API and independent workers; Cloudflare provides Pages, Access and private R2. Full public content is published by the existing managed worker rather than a competing Git build. The `twe-concierge` Pages project is the public publication target; the separate portal project is not. Preserve the production holding page until an authorised cutover. See [release readiness](docs/apps/travel-with-ease/readiness-check.md), [production hardening](docs/apps/travel-with-ease/release-hardening-2026-11-24.md), [content promotion](docs/apps/travel-with-ease/cms-publishing-and-production-promotion-2026-11-20.md), [environment contract](docs/apps/travel-with-ease/env.md) and [client CMS guide](docs/apps/travel-with-ease/client-cms-guide.md).

CI is test-only. Merge a reviewed green PR into develop, verify staging, then separately approve main promotion and migration-first production deployment. Preserve the prior verified artifact and never reset a shared database. Actual email delivery, GA4 reporting, production backup restore and production acceptance remain separate evidence gates.

Deferred: Travel Readiness PDF, Travel Plans staff module, client My Trips, booking/payment engine, full CRM and AI itinerary generation.

## Environment And Data Safety

- Use each app's `.env.example` file as the source of truth for local setup.
- `VITE_*` values are browser-visible and must stay non-secret.
- REEBS Portal and Dev ERP are both live systems with real data. Any change affecting auth, API permissions, customer/user data, payments, receipts, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, or database schema must be treated as production-sensitive.
- Local database refresh flows live in [docs/local-db-refresh.md](docs/local-db-refresh.md).
- Pre-commit and manual security scripts help catch secrets before they enter git history.

## Deployment

- Public/static frontends deploy through Cloudflare Pages; TWE's protected hosted CMS is served by its Railway API, not as a public Pages application. Static deployment conventions include `public/_headers` and `public/_redirects` checked in for security headers and SPA fallback routing.
- API/backend services deploy through Railway using the root [nixpacks.toml](nixpacks.toml), which delegates to [scripts/railway-service.mjs](scripts/railway-service.mjs).
- Set `RAILWAY_WORKSPACE` on each Railway service to the workspace package, app key, or `apps/<app>` path it should run, for example `@faako/dev-erp`, `@faako/reebs-portal`, `@faako/stroane-web`, or `@faako/faako-api`.
- Use `pnpm run hosting:check` after adding or moving apps to confirm static apps have Cloudflare files, API apps have Railway start paths, and legacy hosting artifacts are absent.
- `faako-website` calls the dedicated Faako API through `VITE_API_BASE_URL` or the local Vite `/api` proxy during development.
- Workspace impact checks are driven by [scripts/workspace-graph.mjs](scripts/workspace-graph.mjs).

## Faako Notebook automation

The source-controlled Notebook foundation includes a read-only Git change-impact
classifier and guarded merged-PR synchronisation tooling. GitHub remains the code
and release authority; Notebook entries are curated references, not proof of
deployment. Writes are gated and default to dry-run; this cleanup does not enable
or verify live Notion updates.

`node --test scripts/notebook/*.test.mjs` verifies classification, event
validation, idempotency and scoped synchronization rules without live writes.
See the [Notebook foundation](docs/faako-notebook/README.md) and
[controlled setup/recovery guide](docs/faako-notebook/SYNC_SETUP.md).

## Repository hygiene

- Install from the pinned lockfile. Dependencies, builds, reports and temporary
  probes are generated/ignored, not source to commit.
- Browser fixtures belong under tests; TWE no longer ships a synthetic workspace.
- Keep migrations, recovery tooling and durable decisions. Historical runbooks
  are not current instructions where a newer document supersedes them.
- Inspect `git worktree list --porcelain` and status before cleanup. Preserve
  unmerged branches, source edits, private configuration and active servers.
- See the [cleanup inventory and recovery notes](docs/apps/travel-with-ease/repository-cleanup-2026-11-06.md).
  Installed dependencies remain on disk; this is not a Git history rewrite.

## Docs

README update rule:

- Any time a new feature, module, workflow, integration, package, API endpoint, environment variable, setup step, deployment process, or security-related change is implemented, update the relevant README files in the same change.
- README updates should cover what changed, where the feature/module lives, how to use it, required environment variables, setup or migration steps, security or data impact, known limitations, and testing notes.
- Update the app-specific README for app changes, package README for shared package changes, the root README for monorepo-wide changes, and the relevant `docs/apps/<app>/implementation-notes.md` file when detailed implementation notes are needed.
- Do not leave implemented functionality undocumented.

Platform docs:

- [docs/app-platform.md](docs/app-platform.md)
- [docs/local-db-refresh.md](docs/local-db-refresh.md)
- [docs/monorepo-restructure.md](docs/monorepo-restructure.md)
- [docs/platform/codex-handoff-verification.md](docs/platform/codex-handoff-verification.md)
- [docs/platform/operations-manual.md](docs/platform/operations-manual.md)
- [docs/platform/shared-payment-receipt-architecture.md](docs/platform/shared-payment-receipt-architecture.md)
- [docs/security_best_practices_report.md](docs/security_best_practices_report.md)

App docs:

- [Travel With Ease documentation index](docs/apps/travel-with-ease/README.md)
- [TWE implementation status and completion gates](docs/apps/travel-with-ease/completion-status-2026-11-01.md)

- [apps/faako-api/README.md](apps/faako-api/README.md)
- [apps/faako-website/README.md](apps/faako-website/README.md)
- [apps/faako-erp/README.md](apps/faako-erp/README.md)
- [apps/reebs-portal/README.md](apps/reebs-portal/README.md)
- [apps/reebs-website/README.md](apps/reebs-website/README.md)
- [apps/dev-erp/README.md](apps/dev-erp/README.md)
- [apps/bynana-portfolio/README.md](apps/bynana-portfolio/README.md)
- [apps/stroane-web/README.md](apps/stroane-web/README.md)
- [apps/system-starter/README.md](apps/system-starter/README.md)
- [apps/ui-workbench/README.md](apps/ui-workbench/README.md)
