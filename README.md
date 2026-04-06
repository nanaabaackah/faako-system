# Faako System Monorepo

PNPM and Turborepo workspace for the Faako, Reebs, ByNana, and Dev ERP apps.

This repo is not a fresh boilerplate monorepo. It preserves the existing app logic and extracts only the structure that is already shared across apps.

## Workspace Layout

```text
apps/
  faako-api
  faako-erp
  faako-website
  reebs-portal
  reebs-website
  dev-erp
  bynana-portfolio
packages/
  config
  core
  theme
  types
  ui
  utils
scripts/
  affected-apps.mjs
  create-app-from-reference.mjs
  netlify-ignore.mjs
  workspace-graph.mjs
docs/
  app-platform.md
  monorepo-restructure.md
  security_best_practices_report.md
```

## Apps

| Workspace package | App | Purpose | Local command | Default port |
| --- | --- | --- | --- | --- |
| `@faako/faako-api` | `apps/faako-api` | Faako Netlify Functions API | `pnpm --filter @faako/faako-api run dev:backend` | `8889` |
| `@faako/faako-website` | `apps/faako-website` | Faako marketing site and signup funnel | `pnpm --filter @faako/faako-website run dev:frontend` | `5175` |
| `@faako/faako-erp` | `apps/faako-erp` | Faako ERP frontend | `pnpm --filter @faako/faako-erp run dev:frontend` | `5176` |
| `@faako/reebs-portal` | `apps/reebs-portal` | Reebs admin portal plus Netlify backend | `pnpm run dev:reebs` | `5174` and `8888` |
| `@faako/reebs-website` | `apps/reebs-website` | Reebs public website | `pnpm --filter @faako/reebs-website run dev:with-backend` | `5173` |
| `@faako/dev-erp` | `apps/dev-erp` | Standalone KPI dashboard and backend | `pnpm --filter @faako/dev-erp run dev:with-backend` | `5173` and `8080` |
| `@faako/bynana-portfolio` | `apps/bynana-portfolio` | Nana's portfolio site | `pnpm --filter @faako/bynana-portfolio run dev` | Vite default |

## Shared Packages

| Package | Purpose |
| --- | --- |
| `@faako/config` | App-local config builders for ERP branding and navigation |
| `@faako/core` | Shared organization/auth helpers and template-config state |
| `@faako/theme` | Shared shell theme tokens and CSS |
| `@faako/types` | Shared contracts |
| `@faako/ui` | Shared ERP shell primitives |
| `@faako/utils` | Shared path, title, and role helpers |

## Getting Started

1. Install dependencies from the repo root.

```bash
pnpm install
```

2. Copy the relevant app `.env.example` files into untracked local env files where needed.

3. Start the app you want to work on.

Common root commands:

```bash
pnpm dev
pnpm dev:faako
pnpm dev:dev-erp
pnpm dev:reebs
pnpm build
pnpm lint
pnpm test
```

Quick app cheat sheet:

```bash
# Faako full stack
pnpm dev:faako

# Reebs full stack
pnpm dev:reebs

# Dev ERP full stack
pnpm dev:dev-erp

# ByNana portfolio
pnpm --filter @faako/bynana-portfolio run dev

# UI workbench
pnpm dev:workbench

# System starter
pnpm dev:starter
```

Useful scoped commands:

```bash
pnpm --filter @faako/faako-website run dev:frontend
pnpm --filter @faako/faako-api run dev:backend
pnpm --filter @faako/dev-erp run dev:with-backend
pnpm --filter @faako/faako-erp run build
pnpm --filter @faako/reebs-portal run db:migrate:dev
```

## Selective Deploys

Each deployable app keeps its own `netlify.toml`.

This repo uses the workspace graph in `scripts/workspace-graph.mjs` and the ignore command in `scripts/netlify-ignore.mjs` so a site can skip deploys when a change does not affect it.

Useful commands:

```bash
pnpm affected:apps -- --files apps/faako-website/src/App.jsx
pnpm deploy:check -- @faako/faako-website --files apps/faako-api/netlify/functions/signup.js
```

Current explicit cross-app build relationship:

- `@faako/faako-website` depends on `@faako/faako-api`
  Reason: the website mirrors API Netlify functions during build.

## Template Flow

New apps should be cloned from the closest real working app, not generated from generic scaffolding.

Examples:

```bash
pnpm create:app -- --source faako-erp --package @faako/acme-erp
pnpm create:app -- --source faako-website --package @faako/acme-website
pnpm create:app -- --source faako-api --package @faako/acme-api
```

That flow:

- keeps existing business logic patterns intact
- copies only from a real source app
- skips local env files and common key material
- leaves company branding and content changes for a deliberate manual pass

More detail lives in [docs/app-platform.md](/Users/Nana/Desktop/Developer/faako-system/docs/app-platform.md).

## Security Notes

- Real `.env` files are ignored by the repo.
- README files should reference `.env.example` files or placeholder values only.
- `VITE_*` values are public browser config and must not contain secrets.
- The Faako signup flow now uses persistent server-side throttling backed by Postgres.
- The Faako API deploy runs `prisma migrate deploy` before publish so security tables are created during deploy.

## App Docs

- [faako-api](/Users/Nana/Desktop/Developer/faako-system/apps/faako-api/README.md)
- [faako-website](/Users/Nana/Desktop/Developer/faako-system/apps/faako-website/README.md)
- [faako-erp](/Users/Nana/Desktop/Developer/faako-system/apps/faako-erp/README.md)
- [reebs-portal](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/README.md)
- [reebs-website](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-website/README.md)
- [dev-erp](/Users/Nana/Desktop/Developer/faako-system/apps/dev-erp/README.md)
- [bynana-portfolio](/Users/Nana/Desktop/Developer/faako-system/apps/bynana-portfolio/README.md)
