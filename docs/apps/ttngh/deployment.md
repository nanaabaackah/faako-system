# TTNGH deployment status

## Current boundary — 2026-09-27

The existing TTNGH Astro source is under development. Cloudflare has **not** been
configured. This change completes app metadata; it does not deploy, approve a
production domain, enable donations or change the site's design.

`apps/ttngh/appSystem.js` declares the existing pink/black theme mappings and a
public interactive site with no authentication. The contact form currently
prepares a mailto handoff; it is not an authenticated backend submission.

## CI behavior

- Normal affected builds/tests and repository security checks still apply.
- The security gate still requires app metadata and the security header baseline.
- `scripts/hosting-policy.mjs` explicitly defers only the Cloudflare readiness
  check for the exact `@faako/ttngh` / `apps/ttngh` workspace. The hosting check
  reports this deferral, rather than claiming TTNGH is ready to deploy.
- All other apps retain their checks. Railway start-path and legacy-hosting
  checks are not disabled. Optional monitoring is not a hosting exemption.
- CI tests the deferral boundary. TTNGH's own test checks metadata and its theme
  mappings without loading environment files.

## Before configuring Cloudflare

1. Approve the production domain, editorial content and launch checklist.
2. Configure an independently verifiable preview and production build. Supply
   `PUBLIC_SITE_URL` for the approved deployment; keep credentials out of public
   variables. The current `.example` default is not a production canonical URL.
3. Add and test `public/_redirects` with an Astro `/404.html 404` fallback, not an
   SPA rewrite. Review redirects, generated sitemap, canonical URLs and indexing.
4. Review CSP against built scripts (including inline structured data), validate
   actual response headers and test the contact handoff and consent behavior.
5. Remove TTNGH's explicit deferral from `scripts/hosting-policy.mjs` and update
   its regression test. Run `pnpm hosting:check`, security checks and the applicable
   build/browser checks before deployment. Do not leave the exception in place
   after Cloudflare is configured.

## Public events calendar

The Events page can display an approved public Google Calendar without OAuth or
provider secrets. Create or select a dedicated TTNGH events calendar, make only
the intended event details public, then set its public calendar ID as
`PUBLIC_TTNGH_GOOGLE_CALENDAR_ID` in preview and production.

The calendar ID is browser-readable and must not be treated as a credential. Do
not place a Google client secret, service-account key or private-calendar URL in
any `PUBLIC_` variable. The external calendar is loaded only after a visitor
chooses the load button; the local fallback remains visible when no calendar ID
is configured. Recheck the privacy notice, CSP, event visibility and mobile
rendering before launch.

No Cloudflare/Railway credentials, secret files or live provider calls are needed
for these local metadata and CI checks.
