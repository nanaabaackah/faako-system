# Temporary production holding page — Travel With Ease (2026-11-15)

## Purpose

The main public site can be replaced with a small standalone static holding
artifact until production API and CMS readiness is confirmed. The holding page
uses the existing gold logo, approved Kenya/Zanzibar photography and verified
public email/WhatsApp details. It contains no Astro routes, scripts, API calls,
forms, analytics, CMS snapshots, website sections or sitemap.

This changes only the TWE public web build. It does not change Railway,
PostgreSQL, Cloudflare Access, the protected CMS or staging.

## Activate in Cloudflare Pages

In the existing public TWE Cloudflare Pages project, add the following variable
to the production/main build environment, NOT the staging/develop environment:

- TWE_HOLDING_PAGE = true
- PUBLIC_APP_ENV = production
- PUBLIC_SITE_URL = https://travelwitheasegh.com
- PUBLIC_SITE_INDEXABLE = false

Keep the existing build command:
pnpm --filter @faako/travel-with-ease-web build

Keep the existing output directory:
apps/travel-with-ease-web/dist

On a successful production deployment, check the production hostname and any www
alias. Confirm /, /packages, /journal, /contact, /api/public/enquiries and an
unknown path return only holding content, while /holding.css and approved images
load. The deployed artifact has an explicit Cloudflare Pages _redirects rule,
404 fallback and noindex metadata plus headers. Verify provider overrides or
Cloudflare rules do not expose older content. Noindex is not access control.

Avoid merging unrelated develop changes into main merely to activate this page.
The production-only setting must be applied at deployment time; merging this
code with the flag absent leaves the normal Astro site online.

## Disable when ready

Remove TWE_HOLDING_PAGE (or set it to false) and redeploy the approved production
revision. Restore PUBLIC_SITE_INDEXABLE according to launch approval after
verifying the API, content, auth, form, notification worker, SEO and production
readiness. Staging can continue to use the original Astro build throughout.
