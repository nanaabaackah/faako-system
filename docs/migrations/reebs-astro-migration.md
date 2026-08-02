# REEBS Website Astro migration

Date: 2026-07-31
Application: `apps/reebs-website`
Portal status: unchanged React/Vite

## Outcome

The public REEBS Website now builds as a static Astro site with route-level React islands. The migration preserves the existing public commerce flows while moving document ownership, SEO, sitemap, redirects, and error handling out of the Vite SPA shell.

The REEBS API remains the live source of truth. `src/content/public-catalogue.json` is a reviewed, public-only build snapshot generated explicitly from `/api/inventory`; it is not a second operational database.

## Route parity

| Previous path | Astro destination | Status | Redirect | Content/interaction |
| --- | --- | --- | --- | --- |
| `/` | `/` | Migrated | No | Server-rendered home plus deferred React interaction |
| `/home` | `/` | Covered | 301 | Legacy alias |
| `/about` | `/about` | Migrated | No | Server output plus visible React island for live counts |
| `/book` | `/book` | Migrated | No | React booking island; API creates customers/bookings |
| `/cart` | `/cart` | Migrated, noindex | No | React cart island |
| `/checkout` | `/checkout` | Migrated, noindex | No | React checkout island; API creates order/booking records |
| `/contact` | `/contact` | Migrated | No | React form/map island |
| `/customer-login` | `/customer-login` | Migrated, noindex | No | Existing bounded customer session UI |
| `/reset-password` | `/reset-password` | Migrated, noindex | No | Existing password-reset API flow |
| `/login` | Portal `/login` | Externalised | 302 | Staff authentication remains in Portal |
| `/admin/*` | Portal `/admin/*` | Externalised | 302 | Admin/POS remain outside the public app |
| `/delivery-policy` | Same | Migrated | No | Static server output |
| `/faq` | Same | Migrated | No | Server output plus deferred accordion interaction |
| `/gallery` | `/about` | Covered | 301 | Existing alias |
| `/privacy-policy` | Same | Migrated | No | Static server output |
| `/refund-policy` | Same | Migrated | No | Static server output |
| `/rentals` | Same | Migrated | No | Static category introduction plus live React catalogue |
| `/rentals/:slug` | Same canonical family | Migrated | Legacy numeric aliases receive 301 redirects | Pre-rendered product facts plus live rental island |
| `/shop` | Same | Migrated | No | Static category introduction plus live React catalogue |
| Unknown paths | `404.html` | Corrected | No catch-all home rewrite | Real noindex 404 |

New indexable routes:

- `/rentals/category/:category`
- `/shop/category/:category`
- `/shop/:slug`

## Catalogue boundary

`scripts/refreshPublicCatalogue.mjs` performs the only live catalogue refresh. It:

- reads the public inventory API;
- applies the existing website visibility/rental filters;
- keeps a fixed public-field allowlist;
- produces stable lower-case slugs and legacy rental aliases;
- omits server, customer, payment, and database fields.

Normal Astro builds consume the committed snapshot and do not use the network. Browser islands refresh live stock, variants, and rental status through the API. Shared `@faako/api-client` is piloted by the inventory cache; remaining direct requests retain their existing contracts for incremental adoption.

## SEO and AEO

- Every indexable document has a title, description, canonical URL, Open Graph metadata, social-preview metadata, and JSON-LD.
- Organization, local-business, website, service, FAQ, breadcrumb, collection, and accurate product data are emitted in initial HTML.
- Transactional/session routes are excluded from the Astro sitemap and marked `noindex`.
- Category and product URLs create crawlable internal links.
- The former SPA catch-all and client-only route metadata are removed from the deployment contract.
- No business facts were added beyond existing reviewed website content and public API fields.

## Accessibility

- Skip links target the existing page main landmark.
- Native catalogue pages use one initial `h1`, breadcrumbs, labelled navigation, descriptive status text, and keyboard-visible links.
- Existing React form labels, live regions, dialog semantics, reduced-motion rules, and validation behaviour are retained.
- Native category grids remain usable without JavaScript.

## Performance comparison

Pre-migration Vite baseline:

| Signal | Vite baseline |
| --- | --- |
| Route model | One fully hydrated SPA shell |
| JavaScript | 1,144,580 bytes raw; 293,751 bytes gzip across the build |
| CSS | 957,161 bytes raw; 197,011 bytes gzip |
| Static media | Approximately 155 MiB |
| Routes in sitemap | 24 |

Astro result:

- 1,125 static documents are generated from tracked source, including 1,067 catalogue items and 41 category pages.
- Native product/category/legal/error documents ship no page-specific React island.
- Catalogue, booking, checkout, contact, session, and selected content routes load only their route island.
- The shop's interactive filter/cart shell is client-only because the migrated legacy DOM is not hydration-safe; the Astro heading, direct-answer content, category pages, and product pages remain server-rendered and indexable.
- Shop/rental islands use a smaller commerce shell instead of importing the full site navigation/footer shell.
- Large legacy media remains the dominant artifact-size issue; asset compression is deliberately a follow-up rather than a risky migration-time redesign.
- The largest emitted JavaScript chunk is 476,418 bytes raw. The build no longer emits the previous over-500 kB chunk warning, although splitting the remaining compatibility shell is still worthwhile after parity sign-off.

## Validation and remaining parity checks

Automated checks cover pre-rendered routes, metadata, one initial `h1`, robots/sitemap agreement, redirects, CSP finalisation, catalogue field allowlisting, and the absence of backend packages. The production browser smoke check also covers the homepage, catalogue, product detail, rentals, rental detail, cart persistence, mobile overflow, console errors, and hydration errors at a 390 × 844 viewport.

Before production cutover, validate against the current deployment:

1. live inventory, search, and variant selection against a preview API route;
2. booking, contact, checkout, customer login, reset, and logout against the preview API route;
3. mobile navigation, focus order, dialogs, maps, and WhatsApp;
4. Cloudflare `/api/*` routing to the unchanged Railway API;
5. analytics consent and page-view reporting;
6. representative legacy rental redirects.

## Rollback

Do not delete or overwrite the current production deployment before sign-off. Cloudflare deployment history remains the rollback mechanism. A rollback redeploys the last Vite production artifact; no database, Portal, or API rollback is required because this migration changes only the public frontend.
