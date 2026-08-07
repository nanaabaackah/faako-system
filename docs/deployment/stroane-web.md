# Stroane storefront deployment

## Ownership

- Host: Cloudflare Pages
- Artifact: `apps/stroane-web/dist/storefront`
- Framework: React/Vite
- API: separate Railway service
- Admin: separate Cloudflare Pages project/artifact

## Build

From repository root:

```bash
pnpm --filter @faako/stroane-web run build:storefront
```

Cloudflare output directory:

```text
apps/stroane-web/dist/storefront
```

The post-build finalizer generates route-specific HTML metadata shells and `sitemap.xml`. A build is incomplete if this finalizer does not run.

### Temporary root-artifact compatibility

The workspace-level `build` command also emits a hostname-aware compatibility
artifact at `apps/stroane-web/dist`. This keeps the existing Cloudflare project
operational while its output is changed from the old root directory to the
dedicated storefront artifact. It is a rollback bridge, not the target deployment.
Remove it only after `stroanesolutions.com` is verified on a Cloudflare project
whose build command is `build:storefront` and whose output is `dist/storefront`.

## Environment variables

Names only:

- `STROANE_BUILD_SURFACE`
- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL`
- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_ENABLE_GA_IN_DEV`
- `VITE_GA_ID`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_PORTAL_BASE_URL`
- `VITE_STOREFRONT_BASE_URL`

No Paystack secret, database URL, email key, auth secret, or webhook secret belongs in this deployment.

## Routing and API

- Static route shells exist for public/product/transactional routes.
- `_redirects` preserves React Router fallback behavior.
- `/api/*` must reach the Railway API or `VITE_API_BASE_URL` must identify it.
- The public origin must be present in the API `CORS_ORIGINS` allowlist.

## Preview and rollback

Deploy `dist/storefront` to a preview URL and verify catalogue reads, product pages, enquiry, customer auth, checkout, return status, analytics consent, and portal hand-off. Keep the current production deployment until that verification passes.

Rollback by redeploying the preceding Cloudflare storefront artifact. No database rollback is needed for this browser-only boundary change.
