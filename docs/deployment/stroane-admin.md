# Stroane admin deployment

## Ownership

- Host: Cloudflare Pages
- Artifact: `apps/stroane-web/dist/admin`
- Framework: React/Vite
- API: separate Railway service
- Public website: separate Cloudflare Pages project/artifact

## Build

From repository root:

```bash
pnpm --filter @faako/stroane-web run build:admin
```

Cloudflare output directory:

```text
apps/stroane-web/dist/admin
```

The finalizer applies admin-only metadata, CSP, `X-Robots-Tag`, and robots policy, and removes the public sitemap copied from shared static assets.

### Temporary root-artifact compatibility

The workspace-level `build` command also emits a hostname-aware compatibility
artifact at `apps/stroane-web/dist` so the existing shared Cloudflare deployment
continues serving `portal.stroanesolutions.com` during cutover. The target remains
the dedicated `build:admin` command and `dist/admin` output in a separate
Cloudflare project. Remove the compatibility artifact only after login, private
route fallback, CSP, and no-index headers pass on that dedicated deployment.

## Environment variables

Names only:

- `STROANE_BUILD_SURFACE`
- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL`
- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_PORTAL_BASE_URL`
- `VITE_STOREFRONT_BASE_URL`

The API deployment—not Cloudflare admin—owns database, auth, Paystack, email, and webhook secrets.

## Security/deployment requirements

- Portal origin must be explicitly allowed by API CORS.
- Admin cookies remain HttpOnly and should be secure in hosted environments.
- Backend permissions remain authoritative for every mutation.
- Unknown portal routes may use the SPA fallback but must never fall through to a public admin response from the API.

## Preview and rollback

Verify login/logout, expiry, each role, inventory history, stock adjustment, offline queue, destructive confirmation, orders, receipts, accounting, CRM, and audit logs against a non-production API/database before cutover.

Rollback by redeploying the preceding Cloudflare admin artifact. Do not roll back database migrations solely to roll back this frontend boundary change.
