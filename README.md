# Faako System Monorepo

Faako System is the shared product and engineering monorepo for Faako, REEBS,
Stroane, byNana, The Thriving Network GH (TTNGH), and Travel With Ease. It uses
pnpm 10.33 and Turborepo for JavaScript and TypeScript workspaces, with an
independently managed Python analytics service.

## Current Repository Snapshot

As of 23 October 2026, the pnpm graph contains 38 child workspaces:

- 16 application workspaces in `apps/`, including the nested TTNGH Sanity Studio
- 21 framework-neutral shared packages in `packages/`
- 1 Node service workspace in `services/ttngh-api`

`services/reebs-analytics` is the shared Faako Analytics Python service. It is
deliberately outside the pnpm/Turbo graph and retains its current path for
deployment compatibility.

The repository currently spans several maturity levels:

- Dev ERP and REEBS Portal are live operational systems with real data.
- Faako, REEBS, Stroane, byNana, and TTNGH have public-facing surfaces.
- REEBS Water is a standalone operational frontend backed by the existing
  REEBS Portal API and identity boundary.
- Travel With Ease is an active local foundation; staging and production are
  not yet verified.
- Faako ERP is a demo/reference operational surface.
- System Starter and UI Workbench are internal engineering tools, not default
  production deployments.

## Repository Layout

| Path | Responsibility |
| --- | --- |
| `apps/` | Deployable websites, portals, operational applications, APIs, and internal tools |
| `packages/` | Reusable framework-neutral contracts, validation, security, UI, domain, and runtime helpers |
| `services/` | Independently deployed services, including TTNGH API and Faako Analytics |
| `scripts/` | Workspace checks, stack runners, release helpers, database refresh tooling, and security checks |
| `docs/` | Architecture decisions, app status, deployment runbooks, migrations, testing, security, and operations guidance |

## Applications

| Workspace | Path | Current role | Local command |
| --- | --- | --- | --- |
| `@faako/bynana-portfolio` | `apps/bynana-portfolio` | Astro public portfolio and contact surface | `pnpm run dev:portfolio` |
| `@faako/dev-erp` | `apps/dev-erp` | Live React/Vite operational ERP with Express/Prisma backend | `pnpm run dev:dev-erp` |
| `@faako/faako-api` | `apps/faako-api` | Express/Prisma signup, onboarding, demo-access, and health API | `pnpm --filter @faako/faako-api run dev` |
| `@faako/faako-erp` | `apps/faako-erp` | React/Vite ERP demo and shared-shell reference | `pnpm --filter @faako/faako-erp run dev` |
| `@faako/faako-website` | `apps/faako-website` | Astro public marketing and signup site | `pnpm run dev:faako` |
| `@faako/reebs-portal` | `apps/reebs-portal` | Live/private-beta React/Vite operations portal with authoritative API | `pnpm --filter @faako/reebs-portal run dev:with-backend` |
| `@faako/reebs-water` | `apps/reebs-water` | Standalone React/Vite Water Business frontend using REEBS auth and API | `pnpm run dev:reebs-water` |
| `@faako/reebs-website` | `apps/reebs-website` | Astro public catalogue, rental, booking, cart, and checkout site | `pnpm run dev:reebs` |
| `@faako/stroane-web` | `apps/stroane-web` | React/Vite storefront and admin surfaces with Express/Prisma API | `pnpm run dev:stroane` |
| `@faako/travel-with-ease-api` | `apps/travel-with-ease-api` | Travel With Ease API foundation | `pnpm --filter @faako/travel-with-ease-api run dev` |
| `@faako/travel-with-ease-portal` | `apps/travel-with-ease-portal` | Travel With Ease React/Vite operations portal foundation | `pnpm --filter @faako/travel-with-ease-portal run dev` |
| `@faako/travel-with-ease-web` | `apps/travel-with-ease-web` | Travel With Ease Astro public-site foundation | `pnpm --filter @faako/travel-with-ease-web run dev` |
| `@faako/ttngh` | `apps/ttngh` | TTNGH Astro public website | `pnpm run dev:ttngh` |
| `@faako/ttngh-studio` | `apps/ttngh/studio` | Sanity Studio for TTNGH content operations | `pnpm --filter @faako/ttngh-studio run dev` |
| `@faako/system-starter` | `apps/system-starter` | Internal React/Vite shared-system starter | `pnpm run dev:starter` |
| `@faako/ui-workbench` | `apps/ui-workbench` | Internal shared UI, theme, and layout playground | `pnpm run dev:workbench` |

Run all three Travel With Ease workspaces together with:

```bash
pnpm run dev:twe
```

## Services

| Service | Path | Boundary |
| --- | --- | --- |
| TTNGH API | `services/ttngh-api` | Node API for server-owned TTNGH operations and integrations; included in the pnpm workspace |
| Faako Analytics | `services/reebs-analytics` | Private FastAPI/Python, read-only, tenant-scoped analytics service; outside the pnpm workspace |

The analytics service must not receive a transactional `DATABASE_URL`. Approved
application backends send minimised, tenant-scoped snapshots after enforcing
authentication, permissions, and organisation scope. Its existing directory name
is a compatibility location; the logical shared service is Faako Analytics.

## Shared Packages

| Package | Responsibility |
| --- | --- |
| `@faako/api-client` | Browser/server-safe request transport and compatibility adapters |
| `@faako/api-contracts` | Shared response envelopes, errors, pagination, and request metadata |
| `@faako/audit` | Audit-event constants and safe audit metadata helpers |
| `@faako/auth` | Shared authentication-facing primitives without owning app session models |
| `@faako/config` | App, shell, module-registry, mode, and monorepo configuration helpers |
| `@faako/core` | Shared framework-neutral product and organisation helpers |
| `@faako/discovery` | Search, metadata, structured-data, and public discovery foundations |
| `@faako/email-kit` | Shared email rendering and theme helpers |
| `@faako/finance` | Presentation-safe finance constants and pure helpers; no payment persistence |
| `@faako/layout` | Shared ERP shell layout contracts and responsive helpers |
| `@faako/logger` | Structured, redacted application logging helpers |
| `@faako/notifications` | Notification constants, templates, and user-triggered sharing helpers |
| `@faako/offline-sync` | Local drafts, offline queues, retry metadata, and passive sync UI |
| `@faako/org-settings` | Organisation settings shapes and display helpers |
| `@faako/security` | Shared security headers, CSRF, throttling, secret, and permission helpers |
| `@faako/theme` | Shared design tokens and shell CSS foundations |
| `@faako/types` | Framework-independent domain and API types |
| `@faako/ui` | Shared presentation primitives and operational shell components |
| `@faako/utils` | Shared browser and application utilities |
| `@faako/validation` | Framework-independent Zod boundary schemas and inferred inputs |
| `@faako/water-domain` | REEBS Water contracts and domain-specific helpers |

Shared packages provide compatible foundations; they do not replace app-owned
workflows or backend authorization. Reuse existing packages before creating a new
overlapping package.

## Architecture Boundaries

- Astro is the approved default for content-first public sites. byNana Portfolio,
  Faako Website, REEBS Website, TTNGH, and Travel With Ease Web use Astro.
- Dev ERP, Faako ERP, REEBS Portal, REEBS Water, Travel With Ease Portal, and
  Stroane retain their documented React/Vite boundaries.
- Do not introduce Next.js without an approved ADR.
- Application backends and databases remain authoritative for authentication,
  permissions, tenant scope, writes, payments, inventory, and workflow state.
- Prisma schemas and database lifecycles are app-owned. Cross-system integration
  uses explicit HTTP/webhook contracts rather than shared database access.
- REEBS Water is a separate business segment. It must not be silently folded into
  core REEBS revenue, customer, sales, or profitability totals.
- Advanced analytics is a shared platform capability. Review the analytics
  architecture, contracts, metric catalogue, data-quality standards, and tenant
  boundary before adding calculations or Python services.

## Getting Started

Install the repository-pinned pnpm version through Corepack, then install from the
repository root:

```bash
corepack enable
pnpm install
```

Use the relevant app or service `.env.example` as the local configuration contract.
Never copy production secrets into committed files, browser code, logs, or docs.

Frequently used development commands:

```bash
pnpm dev
pnpm run dev:faako
pnpm run dev:reebs
pnpm run dev:reebs-water
pnpm run dev:dev-erp
pnpm run dev:stroane
pnpm run dev:twe
pnpm run dev:ttngh
pnpm run dev:portfolio
pnpm run dev:workbench
```

Prisma-backed local stack commands run their documented migration preparation
where configured. Never reset a shared database as a routine development fix.

## Quality and Repository Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm test:e2e
pnpm test:python
```

Useful focused repository checks:

```bash
pnpm run release:prerequisites
pnpm run workspace:manifests
pnpm run monitoring:check
pnpm run project-registry:check
pnpm run hosting:check
pnpm run analytics:check-builds
pnpm run security:all
pnpm affected:apps -- --files <path>
```

Run targeted app tests for production-sensitive changes. Browser E2E suites must
use local, preview, or isolated test environments and must never target production.

## Environment and Data Safety

- Treat Dev ERP and REEBS Portal changes as production-sensitive because both
  systems use real operational data.
- Treat auth, permissions, customer/user data, payments, receipts, inventory,
  bookings, orders, rent, reports, email, AI/productivity endpoints, migrations,
  and deployment configuration as high-risk areas.
- `PUBLIC_*` and `VITE_*` values are browser-visible and must never contain secrets.
- Validate external input at the boundary and preserve request IDs across services.
- Backend permission and tenant enforcement is mandatory; frontend guards are UX only.
- Use structured, redacted diagnostic logs and keep them distinct from audit events.
- Deploy reviewed, environment-scoped migrations before code that depends on them.

Local database refresh guidance lives in
[`docs/local-db-refresh.md`](docs/local-db-refresh.md).

## Deployment Shape

- Static Astro and Vite frontends are prepared for Cloudflare Pages where their
  app-specific deployment documentation says so.
- Node APIs deploy independently, primarily through Railway. Root Railway routing
  is handled by `nixpacks.toml` and `scripts/railway-service.mjs` for supported
  workspaces.
- Faako Analytics deploys as its own private Docker/Railway-compatible service.
- TTNGH separates the public Astro site, Sanity Studio, and Railway API boundaries.
- Travel With Ease remains a local foundation until its staging/production gates
  and ownership checks are completed.

Do not infer deployment readiness from the presence of a build script. Use the
app-specific deployment runbook and record preview and production verification
separately, with a rollback path.

## Documentation Map

Related architecture and operating guidance:

- [Final system map](docs/architecture/final-system-map.md)
- [Framework decisions](docs/decisions/framework-decisions.md)
- [Repository quality gates](docs/architecture/quality-gates.md)
- [Platform operations manual](docs/platform/operations-manual.md)
- [Pre-deploy checklist](docs/platform/pre-deploy-checklist.md)
- [Security status](docs/platform/security-status.md)
- [Shared analytics architecture](docs/architecture/shared-analytics-architecture.md)
- [REEBS Water domain boundary](docs/architecture/reebs-water-domain.md)
- [TTNGH documentation](docs/apps/ttngh/README.md)
- [Travel With Ease documentation](docs/apps/travel-with-ease/README.md)

Each established application and shared package also owns local documentation at
its path. Some dated architecture and audit documents are historical snapshots;
check their date and status before treating them as current operational truth.

## Documentation Rule

When implementation changes a feature, workflow, integration, API, environment
contract, setup step, deployment process, package boundary, security behavior, or
database requirement, update the relevant documentation in the same change:

- app changes: the app README and applicable `docs/apps/<app>/` records
- shared package changes: the package README and affected architecture guidance
- monorepo-wide changes: this README and the relevant platform/architecture docs
- architecture, authentication, permission, payment, migration, or deployment
  boundary changes: the applicable ADR, runbook, tests, and rollback guidance

Document what is implemented, how it is verified, known limitations, and any data,
security, migration, or deployment impact. Do not present planned work as shipped.
