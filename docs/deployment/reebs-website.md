# REEBS Website deployment

Date: 2026-07-31

## Artifact

- Workspace: `@faako/reebs-website`
- Framework: Astro static output with React islands
- Build command: `pnpm --filter @faako/reebs-website run build`
- Output directory: `apps/reebs-website/dist`
- Preview command: `pnpm --filter @faako/reebs-website run preview`
- Recommended runtime: Node.js 22 and the repository-pinned pnpm version

The build produces static HTML, route chunks, `sitemap-index.xml`, `sitemap-0.xml`, `robots.txt`, `_headers`, and `_redirects`. A post-build finalizer hashes executable inline scripts for the CSP and appends deterministic legacy rental redirects.

## Hosting boundary

Cloudflare serves the public static artifact. Railway continues to host the REEBS API/backend. REEBS Portal is deployed separately and remains React/Vite.

The production host must preserve the existing same-origin `/api/*` boundary or an equivalent reviewed Cloudflare Worker/reverse proxy to Railway. Static hosting must not expose a database URL, payment secret, session secret, email credential, or service token.

## Environment-variable names

Browser/build configuration:

- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL`
- `VITE_REEBS_PORTAL_URL`
- `VITE_GOOGLE_MAPS_KEY`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_GA_ID`
- `VITE_ENABLE_GA_IN_DEV`
- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_CURRENCY_API_KEY`
- `VITE_EXCHANGE_API_KEY`

Development proxy configuration:

- `REEBS_API_PROXY_TARGET`
- `VITE_API_PROXY_TARGET`

Explicit catalogue-refresh configuration:

- `REEBS_API_BASE_URL`
- `BACKEND_BASE_URL`
- `VITE_API_BASE_URL`
- `VITE_BACKEND_BASE_URL`

`APP_ENV` remains in the existing example file for compatibility but is not an Astro public build input. Payment-provider credentials are not public-site variables.

## Catalogue refresh

Ordinary local and CI builds are offline and deterministic. Refresh public catalogue content only when inventory publication changes are ready for review:

```sh
pnpm --filter @faako/reebs-website run catalogue:refresh
pnpm --filter @faako/reebs-website run sitemap:check
pnpm --filter @faako/reebs-website run build
pnpm --filter @faako/reebs-website run test
```

Review the snapshot diff for visibility, category, price, image, status, and slug changes before committing it.

## Preview and launch

1. Build from a clean commit with a frozen lockfile.
2. Deploy `apps/reebs-website/dist` to a non-production Cloudflare preview.
3. Configure the preview API route without exposing server secrets.
4. Run route, form, cart, booking, checkout, session, analytics, accessibility, and mobile parity checks.
5. Validate sitemap, structured data, canonical host, redirects, and security headers.
6. Keep the current production deployment active until explicit parity approval.
7. Promote the exact validated artifact or commit.

## Rollback

Cloudflare deployment history is the primary rollback. If a production issue occurs:

1. restore the last known-good public deployment;
2. leave Railway and REEBS Portal unchanged unless evidence identifies an independent backend issue;
3. invalidate only affected static caches;
4. preserve request IDs and browser evidence for diagnosis.

The migration contains no database change, so rollback does not require data migration.
