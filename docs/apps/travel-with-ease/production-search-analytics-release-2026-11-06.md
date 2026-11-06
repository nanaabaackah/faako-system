# TWE Search Console and consented Analytics production release — 6 November 2026

## Release scope

This is an intentionally narrow release from `main`. It does not merge `develop`, change the API/portal, activate online enquiry submission, or promote the newer TWE CMS.

- Publish an approved Privacy notice and Cookies/preferences notice tailored to the older public website, which currently uses WhatsApp, email and telephone for enquiry contact.
- Keep all other previously unpublished business pages as `null` in the approved release snapshot.
- Reuse the existing consent-gated Google Analytics implementation and the public measurement ID `G-GVJ2HGT6YN`.
- Reuse the existing Astro sitemap, `robots.txt`, canonical URL, and Search Console verification meta-tag support.
- Strengthen automated production-build checks for published policy pages, noindex exclusions, analytics configuration, and XML sitemap/robots output.

The Privacy and Cookies notices are derived from the client-approved 1 November 2026 content on `develop`. References to an online enquiry form and newly built backend services were narrowed because those features are not yet published on `main`. This is editorial copy, not legal counsel; the client should review the policies before production handover.

## Cloudflare Pages — public TWE production

Confirm the *Production* build is sourced from `main`, not Preview. Configure:

```env
PUBLIC_APP_ENV=production
PUBLIC_SITE_URL=https://travelwitheasegh.com
PUBLIC_SITE_INDEXABLE=true
PUBLIC_GA_MEASUREMENT_ID=G-GVJ2HGT6YN
```

`PUBLIC_GA_MEASUREMENT_ID` is optional in code because the production default is pinned to the same value; an explicit variable simplifies deployment audits. **Confirm it against the correct Google Analytics 4 Web stream before shipping.**

`PUBLIC_GOOGLE_SITE_VERIFICATION` is optional for URL-prefix HTML ownership verification; when provided, it must contain the exact Google-issued token. Prefer Google Search Console *Domain* property ownership via a DNS TXT record in Cloudflare, which needs no application variable.

Never commit Google Cloud service account keys or Analytics access credentials. A GA measurement ID is public, not a secret.

### Important production snapshot override

The build uses `TWE_CONTENT_SNAPSHOT` when explicitly configured. That external snapshot takes precedence over the checked-in approved release. **Verify that the production build is using the intended approved snapshot and that its `privacy` and `cookies` pages are published.** An older snapshot containing `privacy: null` disables analytics even after this release.

Do not set `PUBLIC_SITE_INDEXABLE=true` in staging or previews. Robots/indexing opt-in is only for approved public production content.

## Build and verification

CI is expected to run:

```bash
pnpm --filter @faako/travel-with-ease-web lint
pnpm --filter @faako/travel-with-ease-web typecheck
pnpm --filter @faako/travel-with-ease-web build
pnpm --filter @faako/travel-with-ease-web test
```

The `public-release.test.mjs` suite also makes an isolated production build using the approved production origin and `PUBLIC_SITE_INDEXABLE=true`, checking:

- `/privacy` and `/cookies` are published with indexable robots metadata and canonical tags.
- `/contact`, `/terms`, and other unpublished routes remain unavailable and `noindex`.
- Homepage GA measurement configuration is present but the tag still requires explicit analytics consent.
- `/robots.txt` advertises `/sitemap-index.xml`.
- The sitemap index references `sitemap-0.xml`, which includes only the approved public URLs.

GitHub CI success is not confirmation that Cloudflare has deployed the commit.

## Hosted acceptance after deployment

1. Check `https://travelwitheasegh.com/`, `/privacy`, `/cookies`, `/robots.txt`, and `/sitemap-index.xml` return the intended pages/data, not a Cloudflare Access challenge, placeholder, 404, or cached old output.
2. Open the homepage source and confirm production canonical URL, `index, follow` on approved routes and the GA measurement configuration. Confirm staging remains `noindex`.
3. In a fresh browser session, choose **Essential only** and confirm that GA does **not** send measurement requests. In a separate fresh session, choose **Allow analytics** (without Do Not Track or tracking blockers) and verify the intended GA4 web stream receives a real-time pageview.
4. Google Search Console → add a *Domain* property for `travelwitheasegh.com` → verify a Google-generated TXT record in Cloudflare DNS. Do not confuse Google Search Console with Google Cloud Console. Submit `sitemap-index.xml` after the live URL is accessible.
5. Check Google Search Console URL Inspection for approved routes only. Indexing is controlled by Google and is not immediate or guaranteed.

## Rollback

If the live site exposes unapproved content or analytics breaks, roll back the Cloudflare Pages deployment to the previous known-good commit/artifact and restore the original production environment settings. Do not force-push `main` or bypass the content-publication guard.
