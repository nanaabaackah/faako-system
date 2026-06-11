# App Platform

This repo is already past the "fresh monorepo boilerplate" stage. The safe next step is to treat the existing apps as the templates, keep app-specific business logic local, and only extract structure that is demonstrably shared.

Current shared structure already in the workspace:

- `packages/ui`
  ERP shell frame, sidebar, bottom navigation, breadcrumb primitives.
- `packages/config`
  Shared config builders for app-local ERP branding and navigation.
- `packages/core`
  Shared organization/auth helpers and template-config state.
- `packages/utils`
  Shared ERP title, path, and role helpers.
- `packages/theme`
  Shared ERP shell tokens and layout styles.
- `packages/types`
  Shared contracts used by config and UI packages.

## Impact Checks

Each app should remain its own deploy target. The repo includes an affected-app graph so a change can be reviewed against the app workspaces it touches.

How it works:

- `scripts/workspace-graph.mjs` builds a workspace dependency graph from `apps/*`, `packages/*`, and `workspace-links.json`.
- `scripts/affected-apps.mjs` lists which apps are affected by a diff.
- `workspace-links.json` is where you declare cross-app build relationships that do not appear in `package.json`.

Current custom build relationship:

- `@faako/faako-website` depends on `@faako/faako-api`
  Reason: the website signup path depends on the Faako API contract.

Local examples:

```bash
pnpm affected:apps -- --files apps/faako-website/src/App.jsx
pnpm affected:apps -- --files packages/ui/src/index.ts
pnpm affected:apps -- --files apps/faako-api/src/server.js
```

Deployment setup per app:

1. Keep each deployable app's frontend/backend target explicit in the app README.
2. Keep build commands and publish directories documented beside the app.
3. If you clone a new app that depends on another app during build or runtime, add that extra dependency in `workspace-links.json`.

Effect:

- A change inside `apps/faako-website/**/*` only rebuilds `@faako/faako-website`.
- A change inside `packages/ui/**/*` rebuilds the apps that consume `@faako/ui`, not the entire repo.
- A change inside `apps/faako-api/**/*` rebuilds `@faako/faako-api` and `@faako/faako-website`, because that relationship is explicit.

## Cloudflare And Railway Defaults

The monorepo default is Cloudflare Pages for static frontends and Railway for API/backend services.

- Cloudflare Pages apps should keep `public/_headers` and `public/_redirects` checked in.
- Railway services use the root `nixpacks.toml`, which runs `scripts/railway-service.mjs`.
- Set `RAILWAY_WORKSPACE` on each Railway service to the target workspace package, app key, or `apps/<app>` path.
- Run `pnpm run hosting:check` before deploying new apps or after moving hosting files.

Current examples:

```bash
RAILWAY_WORKSPACE=@faako/dev-erp
RAILWAY_WORKSPACE=@faako/reebs-portal
RAILWAY_WORKSPACE=@faako/stroane-web
RAILWAY_WORKSPACE=@faako/faako-api
```

The launcher chooses a build script from `railway:build`, `db:generate`, `prisma:generate`, or `build:api`, then chooses a start script from `railway:start`, `server:with-migrate`, `server:prod:with-migrate`, `server:prod`, `start:api`, `server`, or `start`.

## Template Strategy

Do not create a generic "one template fits every app" layer yet. The existing apps are not uniform enough for that without flattening real business logic.

The safer rule is:

- use the closest existing app as the template
- extract only the structure that is already duplicated in at least two apps
- keep company workflows, API handlers, Prisma schema, and marketing copy local until they are proven shared

Recommended reference apps today:

- `apps/faako-erp`
  Best base for a new ERP-style frontend because it already consumes the shared shell/config packages.
- `apps/faako-website`
  Best base for a new marketing site that may later mirror an API app.
- `apps/faako-api`
  Best base for a new Express API app.
- `apps/reebs-portal` and `apps/reebs-website`
  Keep these as product-specific references for now. They still contain more company-specific logic than the Faako apps.

To create a new app from an existing one:

```bash
pnpm create:app -- --source faako-erp --package @faako/acme-erp
pnpm create:app -- --source faako-website --package @faako/acme-website
pnpm create:app -- --source faako-api --package @faako/acme-api
```

That command:

- copies the chosen source app into `apps/<new-app>`
- keeps the real working structure instead of generating boilerplate
- rewrites the workspace package name
- rewrites app-path references like `apps/faako-erp`
- adds the app to shared monorepo monitoring metadata with blank hosted URL env overrides
- adds private draft project metadata for future byNana portfolio/case-study workflows
- creates `docs/apps/<new-app>/README.md` as the first project documentation stub
- creates Cloudflare Pages `_headers` and `_redirects` defaults for Vite/static apps when missing
- leaves company branding/content changes for a manual pass

Manual follow-up after cloning:

- update branding, copy, domains, logos, and company-specific env values
- search the new app for source-company wording and replace it deliberately
- review the generated monitoring category, route list, and env override names
- review the generated private portfolio metadata before making it public
- review sibling-app references and local URLs
- for Cloudflare Pages, configure the app build command and publish directory
- for Railway APIs, set `RAILWAY_WORKSPACE` to the new app package or app key
- if the new app depends on another app during build, register that in `workspace-links.json`

Security defaults in the cloning flow:

- real `.env` files are not copied
- `.npmrc`, `.netrc`, and common key/certificate files are not copied
- source and target app names are validated so the clone stays inside `apps/`
- `VITE_*` values must stay non-secret because they ship to the browser

## Extraction Rule

If two or more apps share the same structure and behavior, move that seam into `packages/*`.

Good candidates:

- shell layout primitives
- config contracts
- runtime organization/auth helpers
- shared module registries
- design tokens and common CSS

Bad candidates right now:

- one-off marketing copy
- company-specific case studies
- product-specific signup flows
- Prisma schemas and migrations that represent different businesses
- API handlers that have not stabilized across apps
