# Stroane Deployment Notes

## Current Hosting Direction

- Frontend: Cloudflare Pages.
- Backend/API: Railway service when the API is deployed separately.
- Database: Railway Postgres.
- DNS/custom domain: point the Stroane domain to the Cloudflare Pages project.

## Cloudflare Pages

Recommended build settings:

- Base directory: repo root
- Build command: `pnpm --filter @faako/stroane-web build`
- Output directory: `apps/stroane-web/dist`
- Frontend env: set `VITE_BACKEND_BASE_URL` only when the API is hosted on a separate Railway URL.

The legacy `apps/stroane-web/netlify.toml` is not the active deployment path. Do not rely on Netlify proxy behavior for the current Cloudflare Pages deployment.

## Backend And CORS

When the Railway backend is deployed, set `CORS_ORIGINS` to include the Cloudflare Pages preview/production origins and the custom production domain.

If the backend is behind Railway/proxy infrastructure, set `TRUST_PROXY_HOPS=1` only after confirming the trusted proxy topology.

## Verification

Before promoting a deploy:

- Run `pnpm --filter @faako/stroane-web run build`.
- Confirm product images resolve under `/imgs/products/`.
- Confirm `/shop` and `/products/:id` still render from local fallback when `VITE_BACKEND_BASE_URL` is blank or unavailable.
- Confirm Cloudflare Pages has only browser-safe `VITE_*` values.
