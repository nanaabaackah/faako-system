# TTNGH social previews and favicons

Updated 22 October 2026. This change preserves the supplied logo and existing navigation/footer branding.

## Assets

- Default social card: `apps/ttngh/public/images/social/ttngh-default.png`, 1200 × 630. It uses the existing TTNGH logo on white, including its original pink tagline.
- Root favicon: `public/favicon.svg`, a self-contained SVG wrapper around the supplied artwork with a white backing for dark/light browser tabs. `public/favicon.ico` is the fallback.
- Supplied PNGs and Apple touch icon: `public/favicon_io/`. The manifest uses root-relative URLs, so icons work on both production and preview.
- To replace icons, update the approved artwork and matching PNG/ICO exports in `favicon_io`. Keep the 16/32/180/192/512 sizes. Run `node apps/ttngh/scripts/generate-brand-assets.mjs` from the repository root to regenerate the root SVG/ICO and default social card. This uses Astro's installed Sharp image engine; no AI-generated branding or external image service is involved.
- To change only the default social card, replace the PNG with an approved 1200 × 630 image and update its alt text in `src/lib/social-metadata.js`. The generator will recreate the logo card if rerun.

## Editor controls and fallbacks

Deploy the updated Sanity Studio schema to expose optional `seo.socialTitle`, `seo.socialDescription`, and `seo.socialImage` on documents that already have SEO fields (including programmes, events, news, resources and site settings). A social image needs approved artwork and descriptive alt text. A separate upload is **not required** for every page.

Sharing text uses page social fields, then page SEO/content, then site settings, then built-in TTNGH defaults. Sharing images use the optional page social image, page content image, site-settings social image, then the branded default card. CMS projections resolve image URLs, dimensions and alt text. Invalid CMS social assets stop publication; drafts and versions remain excluded from the published queries.

Code-authored pages pass `seo`, `image`, `imageAlt`, `imageWidth`, and `imageHeight` to `BaseLayout` when needed. Local image dimensions are read from the asset at build time. CMS images carry their actual dimensions. The team listing retains its existing approved founder preview; no new individual team routes are introduced.

## Production and preview

Canonical links, `og:url`, local social-image URLs and BaseLayout structured data always use `https://thethrivingnetworkgh.org`, regardless of the build hostname. Sanity image assets use their public HTTPS CDN URLs. Never use a private preview URL as an image source.

Indexing still uses the **deployment** origin and explicit `PUBLIC_SITE_INDEXABLE=true`, not the canonical origin. Preview/local builds and pages with `noIndex` remain `noindex, nofollow`. This patch does not deploy Studio, publish CMS documents or change hosting settings. Production assets must be deployed before a public sharing crawler can retrieve them.

## Checks

Run `pnpm --filter @faako/ttngh test`, `pnpm --filter @faako/ttngh-studio test`, then build and run `pnpm --filter @faako/ttngh test:seo`. For a preview build set `PUBLIC_SITE_URL=https://preview.thethrivingnetworkgh.org` and `PUBLIC_SITE_INDEXABLE=false`; run `EXPECT_NOINDEX=true pnpm --filter @faako/ttngh test:seo` afterward. The checks cover real asset existence, dimensions, metadata fallbacks, canonical/share domain protection and preview indexing.

Social networks and browsers cache previews/icons. After deployment, request a fresh scrape in the platform's sharing inspector; a stale preview does not necessarily mean the new HTML is incorrect.

## Local validation results

On 22 October 2026: 33 website tests and 9 Studio tests passed. A preview-origin build produced 15 pages; all passed the built-HTML checks with `EXPECT_NOINDEX=true`, including production canonical/share URLs and preview noindex. No published event detail records were returned by the public dataset at this check, so page-specific fallbacks are covered by unit tests and the wired dynamic templates rather than a live event detail page.

The build with the existing local credentials was rejected by Sanity. The public query and the build with `SANITY_READ_TOKEN=` (command-scoped only) succeeded. No `.env` files were edited. Review the configured read token before relying on the normal credentialed deployment path; do not bypass authentication for a private dataset. These changes have not been committed, deployed or published to Studio.
