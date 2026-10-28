# Travel With Ease — single Railway service and visual preview

**Status:** feature branch pending tests, CI, review, and real hosted validation. **Not production approved.**

## Change

One existing Railway service now serves the TWE API and the authenticated CMS UI under **two different HTTPS hostnames**. The public Astro website remains on Cloudflare Pages.

- API hostname: public /healthz and /readyz, and the existing API routes.
- CMS hostname: the built Vite frontend plus same-origin /api/auth/*, /api/agent/content, /api/agent/media, /api/agent/inquiries and administration routes, all under the **existing** Cloudflare Access application and identity checks.
- CMS-host requests are verified against the signed Access assertion at the Express origin. The CMS does not proxy HTTP to itself.
- Backend session binding, CSRF checks, tenant scoping, staff role permissions, audit records, and database readiness checks remain authoritative.
- No separate Railway portal process or database is necessary. The old standalone portal entry point is retained as code for compatibility and testing but is **not deployed**.
- No new secrets, authentication bypass, public CMS registration, or DNS changes are included by this PR.

## Railway: existing TWE API service only

1. Keep the service connected to the reviewed TWE GitHub branch and monorepo root. Keep its existing PostgreSQL service and environment-specific variables.
2. Set the Railway config file to `apps/travel-with-ease-api/railway.json`, if using its explicit Nixpacks/Railway config path. This file configures the existing pre-deploy database hook and `/readyz` health check.
3. Build: `pnpm --filter @faako/travel-with-ease-api railway:build`; start: `pnpm --filter @faako/travel-with-ease-api start`. Both `build` and `railway:build` now build Vite **directly inside the API workspace** at `apps/travel-with-ease-api/dist/cms/index.html`, including its `assets/` directory. The sibling portal build output is not needed for API builds or runtime, so concurrent workspace builds cannot overwrite the API's generated CMS assets. Build logs must show `TWE CMS assets packaged inside API workspace`.
4. If using the **root** Nixpacks launcher instead of an explicit build command, set `RAILWAY_WORKSPACE=@faako/travel-with-ease-api`; it will select `railway:build`. Do not select the portal workspace.
5. Keep `APP_ENV=staging`, `NODE_ENV=production`, runtime/migration PostgreSQL credentials and `TWE_ORGANISATION_ID` as already reviewed, plus `TWE_AUTH_MODE=cloudflare_access`, `TWE_ACCESS_TEAM_DOMAIN`, **staging** `TWE_ACCESS_AUDIENCE`, exact HTTPS `TWE_PORTAL_ORIGIN`, and `ALLOWED_ORIGINS` containing the portal origin. Leave `VITE_API_BASE_URL` **unset or empty**.
6. **Do not** set `TWE_PORTAL_API_ORIGIN` on the combined API service; that setting was only for the now-unused standalone portal HTTP proxy. The Google OAuth client secret remains in Cloudflare, not the application.
7. The existing approved pre-deploy migration hook remains intact. Review pending SQL and backup evidence before rolling out; don't reset the database or bypass readiness to solve login errors.

## DNS and Access — manual staging handoff

In Railway **Networking**, add the already-approved staging CMS custom hostname to the **same Railway service** that owns the staging API hostname. Confirm Railway's exact CNAME/verification records and TLS issuance.

In Cloudflare DNS, point the CMS hostname to Railway **only after the service is healthy**. Remove conflicting Cloudflare Pages custom-domain routing and any page/worker redirect that sends `/api/*` to `/`. The protected CMS domain remains proxied through Cloudflare Access. Keep the public Astro site on Pages.

Cloudflare Zero Trust must have a self-hosted staging Access application covering the whole CMS hostname and its `/api/*` paths, exact staff-email allowlist, staging AUD and independent MFA. The API checks signed assertions again at origin. Do not use Everyone, Bypass, disable MFA, or expose unprotected alternate CMS hostnames to make the login work.

Cloudflare's Access redirect and email/Google authentication alone do not provision a TWE user in PostgreSQL. Staff bootstrap remains a separate audited admin action; use the previously reviewed procedure and do not share assertion JWTs in chat.

## UI and approval boundaries

The selectively restored public site has the modern homepage, an empty-state world footprint, editorial sections, FAQ structure and approved media. With `PUBLIC_APP_ENV=staging`, the homepage adds **visibly labelled neutral placeholders** for unapproved packages, enquiry steps, journal and FAQs and explicitly says no offers or enquiries are live. With `PUBLIC_APP_ENV=production`, unapproved sections remain hidden. The full illustrative `/demo` and staff synthetic demo are **localhost-only** and cannot be unlocked in hosted builds.

The restored CMS includes the updated dashboard, inbox, content editor, media library and staff/technical admin styling. The live inbox uses tenant-scoped PostgreSQL reads; enquiry status writes require `enquiries.write`, the existing CSRF check and an optimistic revision token, with an audit insert in the same transaction. A status change does **not** send a traveller notification.

Do not imply publication success until the separately approved publication worker/deployment confirms the exact release. An accepted draft or publication request is not an actual live release.

## Staging acceptance tests

1. API-host `/healthz` returns 200 and `/readyz` returns 200; the portal host `/healthz` is only liveness.
2. Signed-out CMS homepage/static assets and `/api/auth/status` redirect to Cloudflare Access at the edge, and a direct origin request without a valid assertion returns 401. Alternate Railway hostnames do not serve the CMS.
3. Complete real Google sign-in plus independent MFA, then GET the **CMS hostname** `/api/auth/status`. It must return JSON with `configured: true`, not the HTML homepage.
4. Unprovisioned identity remains denied; approved Owner obtains a local cookie and can read content and permitted enquiries. Verify no duplicate Access assertions, JWT leakage or direct-API bypass.
5. Confirm POST `/api/auth/access-session` requires exact Origin and initiation header. Verify same-origin cookies, local session expiry, CSRF, logout/re-login and role separation.
6. Read inbox list/detail, change status with current revision, test stale revision conflict and missing permission; check audited write and no automatic traveller contact.
7. Test content save/preview/revert and permission-denied publication, permitted media operations and noindex. Verify service crashes do not expose draft content.
8. Verify staging placeholders are visually labelled and no fabricated offers, prices, bookings, customer data or live forms appear. Confirm production build hides unapproved placeholder modules.
9. Review CI tests, the committed SHA, backup/restore evidence and hosted TLS/DNS before approval. Do **not** automatically promote to `main`.

## Rollback

Keep the current verified Railway release and DNS records documented. If staging login fails, roll the API application back to the prior reviewed SHA and restore the prior CMS hostname route after checking DB migration compatibility. No database deletion, migration checksum edits or weakening of Access guards.


## Railway build artifact regression — 2026-10-28

The hosted deployment was observed repeatedly crashing with `ENOENT .../apps/travel-with-ease-portal/dist/index.html` **after** the pre-deploy migrations passed. This means the CMS build output wasn't available to the running image even though the source code expected it.

The API now owns the build output directly in `apps/travel-with-ease-api/dist/cms`; build scripts fail if the portal HTML/assets are absent, and GitHub CI asserts this exact output. **A successful GitHub build does not prove Railway ran the same build command or packaged the result.**

Check **Railway → TWE API → Settings → Build**: root directory `/` (monorepo root), build command `pnpm --filter @faako/travel-with-ease-api build` (or `railway:build`, now equivalent), and explicit config file `/apps/travel-with-ease-api/railway.json` if supported. Remove an outdated dashboard build override if it supersedes the checked-in config. Verify build logs contain `TWE CMS assets packaged inside API workspace`, then deploy the resulting image and confirm `API listening`, `/healthz`, and `/readyz`. Do not rerun migrations to fix this missing frontend artifact; normal approved pre-deploy migration safety still applies.
