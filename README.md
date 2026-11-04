# Faako System Monorepo

Faako System is a **pnpm + Turborepo** workspace for Faako's shared product platform, internal tools, client websites, portals, and APIs. Each application owns its business rules and deployment lifecycle; reusable UI, contracts, security, and infrastructure helpers live in shared packages.

> **Repository guide — reviewed 4 November 2026.** This README describes the checked-in code, not a guarantee that every service is deployed, fully configured, or production-ready. See the linked app documents and release gates for environment-specific status.

## Start here

From the repository root:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
pnpm dev:ttngh
```

- The root `package.json` specifies **pnpm 10.33.0**. Use a Node.js version compatible with the apps you develop; Astro 7 apps may need a newer runtime than the current `nixpacks.toml` `nodejs_20` pin. Verify the runtime before building or deploying a specific service.
- **Do not start every app by default.** `pnpm dev` invokes Turbo's `dev` tasks and can start multiple services. Prefer the filtered commands below.
- Several ERP/backend development commands automatically generate Prisma clients and **apply development database migrations**. Configure a safe local development database before running them. Never point local migration scripts at production.
- Configuration is app-specific. Review each app's `.env.example` when present; do not commit `.env` files or secrets.

### Run an application

| Application | Workspace | Local command |
| --- | --- | --- |
| ByNana portfolio | `@faako/bynana-portfolio` | `pnpm dev:portfolio` |
| Dev ERP | `@faako/dev-erp` | `pnpm dev:dev-erp` |
| Faako API | `@faako/faako-api` | `pnpm --filter @faako/faako-api run dev` |
| Faako ERP | `@faako/faako-erp` | `pnpm --filter @faako/faako-erp run dev` |
| Faako website | `@faako/faako-website` | `pnpm --filter @faako/faako-website run dev` |
| REEBS portal + API | `@faako/reebs-portal` | `pnpm --filter @faako/reebs-portal run dev:with-backend` |
| REEBS Water + REEBS API | `@faako/reebs-water` | `pnpm dev:reebs-water` |
| REEBS website + portal/API | `@faako/reebs-website` | `pnpm dev:reebs` |
| Stroane storefront + API | `@faako/stroane-web` | `pnpm dev:stroane` |
| Travel with Ease (web, portal, API) | Three TWE workspaces | `pnpm dev:twe` |
| TTNGH website | `@faako/ttngh` | `pnpm dev:ttngh` |
| System starter | `@faako/system-starter` | `pnpm dev:starter` |
| UI workbench | `@faako/ui-workbench` | `pnpm dev:workbench` |

Other workspace scripts can be invoked with `pnpm --filter <package-name> run <script>`. Consult the target `package.json` for supported tasks. Some commands need populated environment files and running databases.

## Repository map

```text
faako-system/
├── apps/                       # 15 top-level application workspaces
│   ├── bynana-portfolio/
│   ├── dev-erp/
│   ├── faako-api/
│   ├── faako-erp/
│   ├── faako-website/
│   ├── reebs-portal/
│   ├── reebs-water/
│   ├── reebs-website/
│   ├── stroane-web/
│   ├── system-starter/
│   ├── travel-with-ease-api/
│   ├── travel-with-ease-portal/
│   ├── travel-with-ease-web/
│   ├── ttngh/
│   │   └── studio/             # Separate Sanity Studio workspace
│   └── ui-workbench/
├── services/
│   └── ttngh-api/              # Separate TTNGH Express API workspace
├── packages/                   # Shared workspace packages
├── scripts/                    # Workspace, quality, deployment and DB tooling
├── docs/                       # Architecture, app, operations and release notes
├── .github/                    # CI/workflows
├── pnpm-workspace.yaml
├── turbo.json
├── workspace-links.json
├── nixpacks.toml
└── package.json
```

`pnpm-workspace.yaml` includes `apps/*`, `packages/*`, `apps/ttngh/studio`, and `services/ttngh-api`. The package names in manifests are the authoritative names for `--filter`. Some cross-app tools (such as `scripts/workspace-graph.mjs` and the Railway launcher) enumerate only top-level `apps/*` and `packages/*`; **do not assume they automatically discover the nested TTNGH workspaces**.

## Applications and boundaries

| Path | Role | Primary technology / notes |
| --- | --- | --- |
| [`apps/bynana-portfolio`](apps/bynana-portfolio/) | ByNana public portfolio | Astro with React components |
| [`apps/dev-erp`](apps/dev-erp/) | Internal operations, proposals, invoices, monitoring and productivity workflows | React/Vite, Express, Prisma/PostgreSQL; production-sensitive |
| [`apps/faako-api`](apps/faako-api/) | Faako backend and signup-related services | Express, Prisma |
| [`apps/faako-erp`](apps/faako-erp/) | Faako ERP application shell | React/Vite |
| [`apps/faako-website`](apps/faako-website/) | Public Faako website and signup entry points | Astro with React components |
| [`apps/reebs-portal`](apps/reebs-portal/) | REEBS administration, stock and shared backend workflows | React/Vite, Express, Prisma; production-sensitive |
| [`apps/reebs-water`](apps/reebs-water/) | Standalone REEBS Water frontend | React/Vite; local full-stack command uses the REEBS Portal backend |
| [`apps/reebs-website`](apps/reebs-website/) | REEBS public retail, rentals and booking experience | Astro with React components, backed by REEBS API |
| [`apps/stroane-web`](apps/stroane-web/) | Stroane commerce storefront and admin experience | React/Vite, backend and Prisma; distinct storefront/admin builds |
| [`apps/system-starter`](apps/system-starter/) | App shell starter/reference | React/Vite |
| [`apps/travel-with-ease-api`](apps/travel-with-ease-api/) | TWE API, content/publication and backend services | Express, database and integration workflows |
| [`apps/travel-with-ease-portal`](apps/travel-with-ease-portal/) | TWE staff CMS portal | React/Vite; server entry point provided by TWE API |
| [`apps/travel-with-ease-web`](apps/travel-with-ease-web/) | TWE public travel website | Astro and API-driven enquiries/content |
| [`apps/ttngh`](apps/ttngh/) | The Thriving Network GH public NGO site | Astro; static-first, editorial and SEO/AEO-oriented |
| [`apps/ui-workbench`](apps/ui-workbench/) | Shared UI experimentation and review | React/Vite |
| [`apps/ttngh/studio`](apps/ttngh/studio/) | TTNGH editorial Studio (nested workspace) | Sanity Studio, **still present in repository** |
| [`services/ttngh-api`](services/ttngh-api/) | TTNGH protected backend/integrations | Express; separate workspace from `apps/ttngh` |

**Important product distinctions**

- **TWE:** The public Astro website, staff portal and Express API are separate workspaces. Staging demos, staff authentication, publication, integrations and production acceptance have their own verification gates; code presence does not establish hosted readiness. See [TWE documentation](docs/apps/travel-with-ease/README.md).
- **TTNGH:** The current codebase still contains the Sanity Studio integration and TTNGH API. Replacing Sanity with a TWE-pattern custom Faako CMS is a **planned migration**; it is **not** the current implemented CMS architecture on `main`. Preserve approved public content and sensitive-data isolation during any cutover. See [TTNGH documentation](docs/apps/ttngh/README.md).
- **REEBS Water:** Water has its own frontend, but its checked-in `dev:with-backend` script starts the backend from `reebs-portal`. A standalone frontend is not necessarily an independently deployed backend.
- **REEBS Portal and Dev ERP:** Handle live operational data. Treat inventory, bookings, order/payment records, users, permissions, emails, migrations and financial ledgers as production-sensitive.
- **Faako shared packages:** Enable consistent components and conventions. They do **not** imply a shared client database or cross-client access to data.

## Shared packages

Checked-in package directories include:

| Package | Responsibility |
| --- | --- |
| `@faako/api-client` | Shared API client helpers |
| `@faako/api-contracts` | Shared API request/response contracts |
| `@faako/audit` | Audit event constants and metadata helpers |
| `@faako/auth` | Shared authentication-facing UI/helpers |
| `@faako/config` | App configuration, module and project registries |
| `@faako/core` | Core app and organization helpers |
| `@faako/discovery` | Canonical URLs, structured data, robots and SEO/AEO utilities |
| `@faako/email-kit` | Email presentation/template helpers |
| `@faako/finance` | Shared payment/receipt constants, formatting and presentation helpers |
| `@faako/layout` | Shared shell/layout contracts and helpers |
| `@faako/logger` | Structured logging |
| `@faako/notifications` | Notification templates and channel helpers |
| `@faako/offline-sync` | Client-side offline queue/review utilities |
| `@faako/org-settings` | Organization settings shapes and helpers |
| `@faako/security` | Shared security utilities |
| `@faako/theme` | Theme tokens and CSS foundations |
| `@faako/types` | Common TypeScript/contracts |
| `@faako/ui` | Shared design-system components and presentation wrappers |
| `@faako/utils` | General application utilities |
| `@faako/validation` | Shared validation helpers |
| `@faako/water-domain` | Water-specific reusable domain helpers |

**Do not mistake shared foundations for finished business services.** For example, `@faako/finance` does not become the source of truth for app payments merely because it exports finance helpers; notification templates do not guarantee email/WhatsApp delivery; `@faako/offline-sync` queues are subject to server-side permission, stock, booking and data validation. Audit, security and UI behavior must be enforced by each owning API.

New reusable components should be extracted only after checking existing implementations, ownership and cross-app effects. A proposed `@faako/onboarding` or generic custom CMS package should not be documented as implemented until it exists.

## Everyday commands

Run commands from the repository root unless noted otherwise.

| Purpose | Command |
| --- | --- |
| Install packages | `pnpm install` |
| Build workspaces | `pnpm build` |
| Lint workspaces | `pnpm lint` |
| Typecheck supported workspaces | `pnpm typecheck` |
| Run workspace tests | `pnpm test` |
| Run declared end-to-end tests | `pnpm test:e2e` |
| Run consolidated quality checks | `pnpm check` |
| Check release/tooling prerequisites | `pnpm release:prerequisites` |
| Check workspace manifests | `pnpm workspace:manifests` |
| Check conflict markers | `pnpm workspace:conflicts` |
| Check app monitoring registry | `pnpm monitoring:check` |
| Check project registry | `pnpm project-registry:check` |
| Check Cloudflare/Railway structure | `pnpm hosting:check` |
| Check public analytics builds | `pnpm analytics:check-builds` |
| Run discovery tests | `pnpm test:discovery` |
| Run security scans/gate | `pnpm security:all` |
| Preview local DB refresh | `pnpm db:refresh:local:dry` |
| List affected apps | `pnpm affected:apps -- --files apps/ttngh/src/pages/index.astro` |

For faster iteration, run only the relevant workspace:

```bash
pnpm --filter @faako/ttngh run test
pnpm --filter @faako/travel-with-ease-web run build
pnpm --filter @faako/travel-with-ease-api run test
pnpm --filter @faako/reebs-portal run lint
```

Not every workspace defines every script. `pnpm test:e2e` runs declared Turborepo tasks but does not prove hosted service acceptance. UI/Playwright checks may need a local server and browser installation; API integration tests may need isolated Postgres and test credentials. Use the owning app's scripts and release documentation.

### App creation and dependency impact

- `pnpm create:app -- --source ... --target ... --package ...` calls the repository's app-reference scaffold; inspect `scripts/create-app-from-reference.mjs` and review its output before applying it to a client.
- `scripts/workspace-graph.mjs` and `scripts/affected-apps.mjs` compute dependency impact from top-level app/package manifests and `workspace-links.json`.
- A shared-package change may affect several apps. Validate impacted consumers, not just the package itself.
- Update registries and checks when introducing a new app: `monitoring:check`, `project-registry:check`, `hosting:check` and `workspace:manifests`.

## Data, configuration and security

- Look for each app's `.env.example` and related environment documentation. Do not assume one universal env contract for every app.
- Values prefixed `PUBLIC_*` (Astro) or `VITE_*` (Vite) can be included in client builds. **Never put secrets in browser-exposed variables.**
- Use separate development, staging and production databases, storage buckets and provider credentials as the application requires.
- Store confidential enquiries, payment references, users, sensitive NGO records and client-specific operational data in protected server-side services; do not publish them to a public CMS dataset.
- Enforce authentication, role permissions, tenancy, validation, CSRF and rate limits in APIs. Hidden buttons or routes are not authorization.
- Inspect and back up live data before any Prisma migration, stock/payment change or import. Avoid `migrate reset`, destructive refreshes or direct production writes.
- `db:refresh:local` can **replace the target database**. Read [local DB refresh instructions](docs/local-db-refresh.md), inspect the dry run and verify source/target addresses before opting in.
- Public-site analytics should respect consent, environment isolation, CSP and verified measurement IDs. See [analytics architecture](docs/architecture/google-analytics-architecture.md).

## Hosting and deployment

This is a multi-target monorepo, **not one deployable application**.

**Public/static sites:** Typically built for Cloudflare Pages, with per-app Astro/Vite settings, output paths and checked-in `public/_headers` / `public/_redirects` as applicable. Astro 404 routing is different from an SPA fallback; do not blindly copy a universal redirect.

**Backends:** Railway services can use root [`nixpacks.toml`](nixpacks.toml), which invokes [`scripts/railway-service.mjs`](scripts/railway-service.mjs). Set `RAILWAY_WORKSPACE` to the appropriate **top-level app workspace**, such as:

```text
RAILWAY_WORKSPACE=@faako/dev-erp
RAILWAY_WORKSPACE=@faako/reebs-portal
RAILWAY_WORKSPACE=@faako/travel-with-ease-api
```

The launcher chooses the target's existing build/start scripts, or `RAILWAY_BUILD_SCRIPT` / `RAILWAY_START_SCRIPT` overrides. Verify each service's actual deploy configuration; the nested `services/ttngh-api` workspace is **not automatically resolved** by the current top-level app launcher. TWE portal hosting uses its own app/API scripts and should not be assumed to run as a separate generic Express backend.

**Release sequence:** check env contracts → validate/migrate safely → build and test → deploy to the intended environment → validate public pages, API readiness, authentication, forms and integrations → approve production cutover separately. A passing local build, health endpoint or DNS record is not end-to-end verification.

Helpful references: [App platform](docs/app-platform.md), [platform architecture](docs/platform/architecture.md), [TWE deployment/readiness](docs/apps/travel-with-ease/README.md), [TTNGH release notes](docs/apps/ttngh/README.md), and [operations manual](docs/platform/operations-manual.md).

## Documentation and contribution rules

- [Architecture and app platform](docs/app-platform.md)
- [Platform architecture](docs/platform/architecture.md)
- [TWE technical and release documentation](docs/apps/travel-with-ease/README.md)
- [TTNGH technical and release documentation](docs/apps/ttngh/README.md)
- [REEBS Water architecture](docs/apps/reebs/water-architecture.md)
- [Shared payment/receipt architecture plan](docs/platform/shared-payment-receipt-architecture.md)
- [Google Analytics architecture](docs/architecture/google-analytics-architecture.md)
- [Security best-practices report](docs/security_best_practices_report.md)
- [Local database refresh](docs/local-db-refresh.md)
- [Historical monorepo restructure notes](docs/monorepo-restructure.md)

When changing an app, package, environment contract, integration, module, CI rule, deployment step or security-sensitive workflow:

1. Update the relevant app/package documentation and this README **only if the repository-wide map or operating guidance changes**.
2. Document verified implementation separately from proposals, previews and unverified hosted work.
3. Identify schema changes, access/data implications, migration steps, tests, rollback strategy and any required environment values.
4. Keep links repository-relative; do not introduce personal machine paths, credentials or private customer data into documentation.
5. Run targeted checks and review the affected apps before merging. For production-sensitive changes, require explicit release approval.

The app's manifest and source code are authoritative for **what exists**; current operational readiness must be established with dated verification evidence, not inferred from this README.
