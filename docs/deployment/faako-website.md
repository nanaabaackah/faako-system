# Faako Website deployment

## Deployment boundary

Faako Website is a static Astro deployment. Cloudflare Pages serves the public files. Railway/Faako API remains responsible for intake persistence, email/PDF work, rate limits, and any server secret. Faako ERP is a separate deployment.

## Build contract

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @faako/faako-website run lint
pnpm --filter @faako/faako-website run typecheck
pnpm --filter @faako/faako-website run build
pnpm --filter @faako/faako-website run test
```

Cloudflare configuration:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `pnpm --filter @faako/faako-website run build` |
| Output directory | `apps/faako-website/dist` |
| Runtime | Static files; no Node/SSR adapter |
| Package manager | pnpm, pinned by the root `packageManager` field |

The build is not complete until `finalize-static-headers.mjs` has replaced the CSP marker in `dist/_headers`. The output tests enforce this and validate every inline script hash.

## Environment-variable names

Production public inputs:

- `VITE_API_BASE_URL`
- `VITE_ERP_DEMO_URL`
- `VITE_GA_MEASUREMENT_ID`

Optional compatibility inputs:

- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_GA_ID`

Development or preview only:

- `FAAKO_API_PROXY_TARGET`
- `VITE_ENABLE_GA_IN_DEV`

Test runner only:

- `FAAKO_PREVIEW_URL`
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`

`VITE_KPI_BASE_URL` is a legacy, unused name and should not be added to a new deployment.

Do not configure these API-owned names on Cloudflare Pages:

- `ADMIN_EMAIL`
- `ALLOW_PRODUCTION_DATABASE_IN_DEV`
- `ALLOWED_ORIGIN`
- `APP_ENV`
- `DATABASE_URL`
- `DATABASE_URL_DEVELOPMENT`
- `DATABASE_URL_LOCAL`
- `DATABASE_URL_PRODUCTION`
- `EMAIL_FORCE_TO`
- `EXPOSE_DEBUG_ERRORS`
- `FAAKO_ONBOARDING_ADMIN_EMAIL`
- `FAAKO_ONBOARDING_FROM_EMAIL`
- `FAAKO_ONBOARDING_FROM_NAME`
- `INTAKE_ADMIN_EMAIL`
- `RATE_LIMIT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

All `VITE_*` inputs are browser-readable. They must never contain secrets.

## Hosting behaviour

- `robots.txt` points to the generated sitemap index.
- `sitemap-index.xml` and `sitemap-0.xml` are generated from the fixed production origin.
- `_redirects` contains the verified legacy case-study wildcard redirect. There is no SPA catch-all.
- `_headers` defines security policy and is finalized with build-specific CSP hashes.
- Direct URLs map to pre-rendered `index.html` documents.
- `404.html` and `500.html` are static error documents; 404 must be returned with HTTP 404 by Cloudflare.

## Preview validation

Keep the current production deployment active. On a branch preview:

1. Open every destination recorded in `docs/migrations/faako-astro-route-map.md` directly, not only through navigation.
2. Confirm `/case-studies/any-legacy-slug` returns a 301 to `/case-studies`.
3. Confirm an unknown URL returns the Faako 404 document with HTTP 404.
4. Check response headers for CSP, frame protection, content-type protection, referrer policy, and permissions policy.
5. Test mobile navigation, theme, reduced motion, keyboard focus, contact hand-off, signup validation, and client-setup validation.
6. Submit one approved non-production intake and verify the API response, email/PDF output, and idempotency behaviour.
7. Grant and reject analytics consent in separate clean sessions; verify no analytics request occurs before consent.
8. Run the production browser suite against the preview:

```bash
FAAKO_PREVIEW_URL=<preview-origin> \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chromium-executable> \
pnpm --filter @faako/faako-website run test:e2e
```

## Promotion

Promote the saved preview artifact or the exact reviewed commit. Do not rebuild from a different dependency or environment state between approval and production. After promotion, repeat direct URL, form, response-header, sitemap, robots, and analytics checks.

## Rollback

Before promotion, record:

- the current production deployment identifier;
- the reviewed Astro commit;
- the API origin and CORS configuration used by the preview.

If routing, forms, CSP, analytics, or content parity fails after promotion:

1. Roll Cloudflare Pages back to the recorded previous production deployment.
2. Do not roll back or redeploy Faako ERP or Faako API unless a separate incident requires it.
3. Confirm the previous homepage, contact route, and signup path are restored.
4. Preserve the failed Astro deployment and logs for diagnosis.
5. Fix forward on a new preview and rerun all checks before another promotion.

The Git history remains the source rollback for the former Vite implementation; production should not be deleted until the Astro preview is accepted.
