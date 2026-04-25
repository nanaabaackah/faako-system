# Faako ERP

Workspace package: `@faako/faako-erp`

Faako ERP is the tenant-facing ERP frontend for Faako. It uses the shared Faako shell and UI packages to present configurable modules for customers, inventory, finance, reporting, and dashboards.

## What Lives Here

- `src/config/erpShell.js`: app-local ERP shell configuration
- `src/`: React frontend routes, views, and module wiring
- shared shell and components from `@faako/ui`
- shared configuration helpers from `@faako/config`
- shared title and navigation utilities from `@faako/utils`
- `.env.example`: local public runtime variable reference

## Run It Locally

```bash
pnpm --filter @faako/faako-erp run dev:frontend
```

Local frontend URL:

- `http://localhost:5176`

Useful commands:

```bash
pnpm --filter @faako/faako-erp run build
pnpm --filter @faako/faako-erp run preview
pnpm --filter @faako/faako-erp run lint
```

Run the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```

## Configuration

Optional local public env values can live in `apps/faako-erp/.env.dev`. Only browser-safe values should use the `VITE_*` prefix.

## Deployment

This app has its own Netlify config in `apps/faako-erp/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/faako-erp build
```

The publish folder is `apps/faako-erp/dist`, and selective deploys use:

```bash
node ./scripts/netlify-ignore.mjs @faako/faako-erp
```

### Demo Access Popup

The deployed demo includes a Netlify function at `/api/demo-access` that
requests and verifies one-time access codes for the popup gate.

Set these server-side environment variables in Netlify:

- `FAAKO_ERP_DEMO_ACCESS_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME` (optional)

In preview-style environments without Resend configured, the function falls
back to a preview mode and returns the generated code directly so the UI can
still be tested.
