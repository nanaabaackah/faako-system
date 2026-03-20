# Faako ERP

Workspace package: `@faako/faako-erp`

Tenant-facing ERP frontend for Faako.

## Current Shape

- app-local ERP config in `src/config/erpShell.js`
- shared shell primitives from `@faako/ui`
- shared config helpers from `@faako/config`
- shared title and navigation helpers from `@faako/utils`

## Scope

- configurable modules
- dashboards and workflows
- customer, inventory, finance, and reporting views

## Local Dev

Primary command:

```bash
pnpm --filter @faako/faako-erp run dev:frontend
```

Local frontend URL:

- `http://localhost:5176`

Useful commands:

```bash
pnpm --filter @faako/faako-erp run dev:frontend
pnpm --filter @faako/faako-erp run build
pnpm --filter @faako/faako-erp run preview
```

Optional local public env values can live in `apps/faako-erp/.env.dev`.

You can also start the Faako stack from the repo root:

```bash
pnpm run dev:faako
```

## Deployment

This app has its own Netlify config in `apps/faako-erp/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/faako-erp build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/faako-erp`
- the publish folder is `apps/faako-erp/dist`
