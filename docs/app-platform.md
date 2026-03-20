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

## Selective Deploys

Each app should remain its own deploy target. The repo now includes an affected-app graph plus a Netlify ignore command so a commit only rebuilds the apps touched by that change set.

How it works:

- `scripts/workspace-graph.mjs` builds a workspace dependency graph from `apps/*`, `packages/*`, and `workspace-links.json`.
- `scripts/affected-apps.mjs` lists which apps are affected by a diff.
- `scripts/netlify-ignore.mjs` exits `0` when a site can skip a build and exits `1` when it must build.
- `workspace-links.json` is where you declare cross-app build relationships that do not appear in `package.json`.

Current custom build relationship:

- `@faako/faako-website` depends on `@faako/faako-api`
  Reason: the website prebuild step mirrors API Netlify functions into the website app.

Local examples:

```bash
pnpm affected:apps -- --files apps/faako-website/src/App.jsx
pnpm affected:apps -- --files packages/ui/src/index.ts
pnpm deploy:check -- @faako/faako-website --files apps/faako-api/netlify/functions/signup.js
```

Netlify setup per app:

1. Keep one Netlify site per app.
2. Keep the app's existing build command from its `netlify.toml`.
3. Use the app's `ignore` command from `netlify.toml`.
4. If you clone a new app that mirrors another app during build, add that extra dependency in `workspace-links.json`.

Effect:

- A change inside `apps/faako-website/**/*` only rebuilds `@faako/faako-website`.
- A change inside `packages/ui/**/*` rebuilds the apps that consume `@faako/ui`, not the entire repo.
- A change inside `apps/faako-api/**/*` rebuilds `@faako/faako-api` and `@faako/faako-website`, because that relationship is explicit.

## Template Strategy

Do not create a generic "one template fits every app" layer yet. The existing apps are not uniform enough for that without flattening real business logic.

The safer rule is:

- use the closest existing app as the template
- extract only the structure that is already duplicated in at least two apps
- keep company workflows, Netlify functions, Prisma schema, and marketing copy local until they are proven shared

Recommended reference apps today:

- `apps/faako-erp`
  Best base for a new ERP-style frontend because it already consumes the shared shell/config packages.
- `apps/faako-website`
  Best base for a new marketing site that may later mirror an API app.
- `apps/faako-api`
  Best base for a new Netlify-functions API app.
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
- leaves company branding/content changes for a manual pass

Manual follow-up after cloning:

- update branding, copy, domains, logos, and company-specific env values
- search the new app for source-company wording and replace it deliberately
- review sibling-app references and local URLs
- if the new app mirrors another app during build, register that in `workspace-links.json`

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
- Netlify functions that have not stabilized across apps
