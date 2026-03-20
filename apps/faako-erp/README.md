# Faako ERP

Tenant-facing ERP web app for Faako.

Current shape:
- config-driven shell in `src/config/erpShell.js`
- shared layout primitives from `@faako/ui`
- shared title and navigation helpers from `@faako/utils`

Scope:
- configurable modules
- dashboards and workflows
- customer, inventory, finance, and reporting views

## Local Dev

- Preferred local ERP command: `pnpm --filter @faako/faako-erp run dev:frontend`
- The local ERP runs on `http://localhost:5176`
- Optional local ERP settings can live in `apps/faako-erp/.env.dev`

To start the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```
