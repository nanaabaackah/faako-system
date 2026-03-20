# Reebs Website

Workspace package: `@faako/reebs-website`

Public website for the Reebs product.

This app is the customer-facing frontend. It depends on the Reebs portal backend during local full-stack development and in production should point at the correct portal/API origin through public Vite config.

## Local Dev

Frontend only:

```bash
pnpm --filter @faako/reebs-website run dev:frontend
```

Full local Reebs stack:

```bash
pnpm --filter @faako/reebs-website run dev:with-backend
```

Or from the repo root:

```bash
pnpm run dev:reebs
```

Default local ports:

- website: `5173`
- companion portal frontend: `5174`
- companion backend/functions: `8888`

## Environment

Important public runtime values:

- `VITE_BACKEND_BASE_URL`
- `VITE_REEBS_PORTAL_URL`

These are browser-visible values and should stay non-secret.

## Deployment

This app has its own Netlify config in `apps/reebs-website/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/reebs-website build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/reebs-website`
- the site is frontend-only in production and should point at the deployed portal/backend

## Relationship To Reebs Portal

- `apps/reebs-portal` owns the backend and admin experience
- this app is the public marketing and customer-facing site
- local full-stack development is normally run with the website plus the portal backend together
