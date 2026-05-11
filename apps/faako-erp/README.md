# Faako ERP

Workspace package: `@faako/faako-erp`

Faako ERP is the shared-shell ERP frontend reference for Faako. It is one of the clearest examples of the current app-shell system: config-driven navigation, shared sidebar sizing, the edge collapse toggle, mobile-safe topbar spacing, and shared card and field styling.

## What Lives Here

- `src/config/erpShell.js`: app-local ERP shell configuration
- `src/`: React routes, dashboards, and module wiring
- shared shell and components from `@faako/ui`
- shared shell CSS from `@faako/theme`
- shared config helpers from `@faako/config`
- shared title and navigation helpers from `@faako/utils`
- `.env.example`: local public runtime variable reference

## Run It Locally

```bash
pnpm --filter @faako/faako-erp run dev:frontend
```

Typical local URL:

- `http://localhost:5176`

Run the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```

## Current System Notes

- follows the shared shell contract used across the ERP apps, including uniform expanded and collapsed sidebar widths
- uses shared ERP topbar and page-content wrappers from `@faako/ui`, plus shared navigation/status-badge patterns, while keeping demo routes, scenario labels, and page workflows in the app
- topbar and content offsets track the active sidebar width token rather than hard-coded layout values
- compact dashboard cards use the current shared bubble-card styling
- `src/config/adminModules.js` contains the Faako ERP module registry for the existing demo/reference routes.
- `src/config/erpShell.js` adapts that registry into the existing shared sidebar and bottom navigation config while preserving scenario-specific labels, current paths, and current demo access behavior.
- Module registry entries now carry `visibility` and `state` metadata. Hidden modules are ignored by navigation; disabled, internal, coming-soon, and experimental modules can render subtle visual badges/classes while preserving routes and existing page behavior.
- The registry uses shared helpers from `@faako/config`; it has no required environment variables, setup steps, migrations, database impact, billing behavior, SaaS plan gating, or access-control enforcement changes.
- Known limitation: grouped module metadata, status labels, and state badges are available, but the shared shell still renders the existing flat navigation until grouped UI is reviewed separately. Database-backed module toggles, org-level module config, permissions integration, and SaaS plan gating remain future work.
- Known limitation: shell placeholder support for offline/sync/notifications/org switching is structural only; demo access and scenario switching remain app-owned.
- Testing notes: verify the generated sidebar and bottom-nav items still match the existing `/`, `/orders`, `/inventory`, `/bookings`, `/vendors`, `/expenses`, `/finance`, `/reports`, `/people`, `/customers`, `/notifications`, `/modules`, and `/settings` routes, including topbar layout, hidden-module filtering, and disabled-module visual state.

## Common Commands

```bash
pnpm --filter @faako/faako-erp run build
pnpm --filter @faako/faako-erp run preview
pnpm --filter @faako/faako-erp run lint
```

## Configuration

Optional browser-safe env values can live in `apps/faako-erp/.env.dev`. Only public values should use the `VITE_*` prefix.

## Deployment

This app has its own Netlify config in `apps/faako-erp/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/faako-erp run build
```

The publish folder is `apps/faako-erp/dist`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/faako-erp
```

## Demo Access Popup

The deployed demo includes a Netlify function at `/api/demo-access` that requests and verifies one-time access codes for the popup gate.

Set these server-side environment variables in Netlify:

- `FAAKO_ERP_DEMO_ACCESS_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME` (optional)

In preview-style environments without Resend configured, the function falls back to a preview mode and returns the generated code directly so the UI can still be tested.
