# REEBS storefront SEO, AEO, discoverability and conversion

Status: Phase 8 implementation record, 2026-08-29.

## Architecture and rendering

REEBS Website remains an Astro static site. Astro owns routes, canonical URLs,
metadata, JSON-LD, sitemap generation, HTTP status documents, and crawlable
catalogue/category/product HTML. The existing React designs live under
`src/views` and hydrate only the interactions that need browser state, such as
search, filters, cart, booking, checkout, login, consent, and scroll reveal.

The audit found a temporary React/Vite SPA regression in the local workspace.
That model would have made metadata, route status, and catalogue detail output
dependent on a client bundle. Phase 8 restored the approved Astro boundary and
kept the current React page designs as islands rather than redesigning them.

Public catalogue builds use `src/content/public-catalogue.json`. The refresh
script reads the public inventory endpoint, applies the storefront visibility
rules, and writes only these fields: identity/SKU, kind, public slug/path and
legacy paths, name, public description/category, public price/currency/image,
public availability, and public variants. Cost price, Water cost, margins,
supplier data, internal notes, private inventory data, customers, and finance
records are not part of this snapshot.

Water remains a standalone business area. No Water revenue, cost, margin,
customer, inventory, or finance field is included in storefront metadata,
analytics, catalogue content, or structured data.

## Indexability map

| Route class | Classification | Rationale |
|---|---|---|
| `/`, `/about`, `/contact`, `/faq` | INDEX | Public business and support content |
| `/rentals`, `/shop` | INDEX | Primary catalogue landing pages |
| `/rentals/category/:slug`, `/shop/category/:slug` | INDEX | Stable, curated category pages from public records |
| `/rentals/:slug`, `/shop/:slug` | INDEX | Active public catalogue detail pages |
| `/book` | INDEX | Public booking entry with useful process content |
| Delivery, refund, privacy, and terms pages | INDEX | Useful customer policy content |
| Search/filter query states (`?q=`, sort/filter state) | CONDITIONAL | Canonical remains the clean catalogue path; combinations are not sitemap routes |
| `/cart`, `/checkout` | NOINDEX | Transactional and user-state-specific |
| `/customer-login`, `/reset-password` | NOINDEX | Authentication/recovery flows |
| `/404`, `/500` | NOINDEX | Status and recovery pages |
| `/login`, `/admin/*` | PRIVATE/REDIRECT | Redirected to the REEBS Portal |
| Customer account/history/invoice routes | PRIVATE/AUTHENTICATED, not currently implemented in this app | Must use customer-owned DTOs when implemented |

## Metadata and structured data

`BaseLayout.astro` provides one canonical URL with lowercase paths and no trailing
slash (except the origin root), route-specific titles/descriptions, robots,
Open Graph, Twitter cards, and safely escaped JSON-LD. Indexable pages emit
Organization, LocalBusiness, WebSite, WebPage, and BreadcrumbList entities.
The visible FAQ is the sole source for FAQPage questions and answers.

Shop details expose Product and Offer only when a public price exists, with
availability derived from storefront stock rules. Rental details use Product as
the closest searchable entity and mark the Offer business function as
`LeaseOut`. Exact future-date rental availability is intentionally omitted from
JSON-LD because a listed rental requires date confirmation; schema.org does not
perfectly model REEBS date-specific rental availability.

No ratings, reviews, testimonials, awards, coordinates, customer counts,
guarantees, fabricated stock, fabricated prices, or cost/margin data are emitted.

## URLs, redirects, and links

Canonical catalogue URLs are lowercase and human-readable. Old uppercase
`/Shop`, `/Rentals`, `/Book`, and `/Contact` paths redirect to lowercase routes.
Legacy numeric rental paths redirect to the current public slug paths. The old
SPA catch-all rewrite was removed and unknown paths now use the real 404 page.

Rendered HTML links connect catalogue pages to categories and detail pages.
Product details include visible Home → catalogue → category → product
breadcrumbs. Important links do not depend exclusively on click handlers.

## Analytics and privacy

Current analytics is intentionally minimal: consent-gated `page_view` collection.
No analytics script initializes until optional analytics consent is present.
No passwords, contact-form contents, card/mobile-money data, payment tokens,
customer notes, internal identifiers, costs, margins, or Water data are sent.

Intended future event map, to implement only with a reviewed shared event helper:

| Funnel point | Event |
|---|---|
| Home, category, product | `view_home`, `view_category`, `view_product` |
| Catalogue search | `search` with sanitized query/category only |
| Cart | `add_to_cart`, `remove_from_cart` with public item reference/value |
| Booking/checkout | `begin_booking`, `begin_checkout` |
| Verified provider result | `payment_success`, `payment_failure` |
| Verified completion | `booking_complete` |
| Customer access | `customer_login` without email or credentials |

These conversion events are deferred because the shared analytics utility
currently exposes page views only; scattering direct `gtag` calls would create
an inconsistent and harder-to-audit privacy boundary.

## Search Console and content follow-up

Manual production actions:

1. Configure a real Search Console verification value in the deployment platform;
   do not commit the token.
2. Submit `https://www.reebspartythemes.com/sitemap-index.xml` after deployment.
3. Validate representative Organization, FAQ, shop Product, rental Product, and
   BreadcrumbList results with Google Rich Results and schema.org validators.
4. Inspect the production 404 response and uppercase/legacy redirects at the CDN.
5. Review Core Web Vitals after enough field data is available.

Business confirmation is still required for existing FAQ/policy statements about
booking lead times, delivery windows/areas, rescheduling, cleaning, payment
methods, security fees, opening hours, and custom work. Phase 8 preserved this
existing wording rather than inventing replacements.

## Astro versus Next.js

Classification: **NO_REASON_TO_MIGRATE**.

Evidence: Astro produces the complete route set, canonical metadata, public
catalogue HTML, structured data, status pages, and sitemap at build time while
hydrating only interactive storefront areas. No confirmed Phase 8 requirement is
blocked. A future benefit could exist if catalogue freshness must become
request-time personalized or on-demand regenerated at very high frequency, but
that is not a current technical blocker and does not require Next.js specifically.

## SEO/AEO implementation matrix

| Area | Before | After | Status |
|---|---|---|---|
| Robots | Public/private intent depended on the SPA route model | Public content is allowed; auth, cart, checkout, admin, and recovery routes are disallowed | Complete |
| Sitemap | Hand-maintained output could diverge from real routes | Astro generates 1,119 validated canonical public URLs | Complete |
| Canonicals | Client-derived and inconsistent across legacy paths | Server-rendered lowercase canonical per indexable route | Complete |
| Page titles | Generic SPA metadata | Route-, category-, and product-specific server-rendered titles | Complete |
| Meta descriptions | Generic or hydration-dependent | Page-specific descriptions from approved public content | Complete |
| Heading hierarchy | Not verifiable until the app rendered | One generated H1 on every primary public route; logical page headings preserved | Complete |
| Product structured data | Incomplete/unreliable in the SPA shell | Public Product/Offer entities; rental offers use `LeaseOut` | Complete |
| Organization schema | Not consistently emitted | Organization and PartySupplyStore entities use known public details only | Complete |
| FAQ schema | Not tied reliably to visible output | FAQPage is generated only from visible FAQ content | Complete |
| Breadcrumb schema | Partial | BreadcrumbList on public pages and visible category/product trails | Complete |
| Open Graph | Generic SPA tags | Canonical page title, description, URL, and safe public image | Complete |
| Internal linking | Important catalogue navigation relied partly on React | Server-rendered category, product, policy, booking, and recovery links | Complete |
| Product URLs | Mixed legacy/SPA paths | Stable lowercase slugs with compatibility redirects | Complete |
| Category URLs | No durable generated category layer | Stable `/shop/category/:slug` and `/rentals/category/:slug` routes | Complete |
| Image SEO | Mixed image attributes | Product/category output has descriptive alt text, dimensions, and intentional loading | Complete for generated pages; source image optimization remains ongoing |
| Core Web Vitals | SPA made public text depend on the main client render | SEO content is static HTML; hydration race fixed; layout dimensions retained | Verified structurally and responsively; field CWV remains manual |
| Indexability | Client shell and fallback rewrite obscured route intent | Explicit INDEX/NOINDEX classes, actual 404/500 output, and validated sitemap | Complete |

## Customer journey matrix

| Flow | Issues Found | Changes | Remaining |
|---|---|---|---|
| Homepage | SEO content and routes depended on the SPA shell; unsupported social proof existed | Restored Astro output, crawlable CTAs/categories, bottom CTA, and removed invented customer/age claims | Confirm existing business wording and collect field CWV |
| Catalogue | Category/product discovery was not durable HTML | Static catalogue and category prelude/grid plus hydrated filters | Continue reducing interactive-island payload |
| Search | Search UI was client-only and filter URLs risked duplication | Real `?q=` search URL, clean canonical, partial/category matching, useful zero state retained | Add reviewed analytics event helper before tracking queries |
| Product Detail | Some detail URLs failed after the migration and metadata was generic | Generated shop/rental detail pages, public price context, breadcrumbs, related category links | Add more specifications only when authoritative source data exists |
| Booking | Route was dependent on SPA fallback | Real indexable Astro route with existing booking logic hydrated | Full provider-backed journey needs isolated fixtures |
| Cart | Transactional state should not be indexed | Real noindex route; existing quantity/date/edit/remove behavior retained | End-to-end stateful fixture coverage |
| Checkout | Transactional state should not be indexed | Real noindex route; existing validation, summary, payment/retry logic retained | Provider-mocked success/failure automation |
| Payment Recovery | Must not imply unverified success | Existing verified-result and recovery behavior preserved | Provider-mocked regression test |
| Confirmation | Must show customer-safe result data | Existing confirmation path preserved; no internal-only fields added | Dedicated fixture-based completion test |
| Customer Login | Auth flow should remain private and usable | Real noindex route; loading, validation, recovery, keyboard and mobile behavior preserved | Authenticated fixture coverage |
| Customer Account | No complete public-site account route currently exists | Classified PRIVATE/AUTHENTICATED; no placeholder dashboard created | Design only after customer-owned API contracts/routes are approved |
| Contact/Support | Needed durable public discovery | Real indexable route plus crawlable public contact/WhatsApp/social links | Business confirmation of public channels/hours |

## Validation record

- Production build: 1,125 HTML pages, including 1,045 shop details and 22 rental details.
- Sitemap: 1,119 expected canonical public URLs; no transactional routes.
- Browser regression: 10 Playwright tests passed across 320, 375, 390, 430, 768, and 1,440 px.
- Accessibility: no serious or critical axe violations on the selected critical routes.
- SEO/output tests: 8 passed, including metadata, schemas, sitemap, redirects, and public DTO boundaries.
- Typecheck: 139 files, zero errors, warnings, or hints.
- Lint: zero errors; eight existing React hook/fast-refresh warnings remain documented debt.
- Security scan and security gate: passed.
- Current complete build asset inventory (not a single-page payload): 36 JavaScript chunks, 897,847 bytes raw / 231,871 bytes gzip; 14 CSS assets, 933,996 bytes raw / 191,884 bytes gzip.
- No reliable numeric Phase 3 baseline was found in the available documentation, so a before/after bundle claim is intentionally not fabricated. Metadata and JSON-LD are static HTML and add no hydration dependency.
