# REEBS storefront design restoration

Date: 2026-08-11

## Audit scope

The current Shop and Rentals entry pages were captured before changes, then
compared with the complete React storefront views that remained in the codebase
from before the Astro route migration. The check covered desktop and mobile
Shop/Rentals, generated catalogue and product pages, the shared navigation,
representative rental detail, the bottom party-planning CTA and the complete
public route smoke suite.

## Regression found

The Astro entry pages mounted the preserved React Shop and Rentals content with
`chrome={false}`, then added a separate Astro header, catalogue prelude and
footer. This changed the established page presentation, removed the full React
navigation behavior and omitted the `Plan your next celebration` footer CTA.
The rental-detail route used the same mixed-shell pattern.

## Restoration

- Shop, Rentals and rental-detail islands now use the existing public React
  route shell again.
- The duplicate Astro header, prelude and footer were removed from the Shop and
  Rentals entry pages.
- The established navbar, page heroes, search/filter interactions, cart overlay,
  footer and bottom CTA are restored without changing catalogue or booking logic.
- Generated category, product and error routes now use the same server-rendered
  navbar and footer, including the bottom CTA.
- Astro still owns the routes, static output, SEO metadata, structured data,
  sitemap and security headers. React islands are rendered into the initial
  HTML before they hydrate; Shop and Rentals no longer expose a loading-only
  initial document.
- The Shop index includes representative products from every public category in
  its generated HTML, while category and product routes retain full static
  catalogue coverage for SEO and answer-engine discovery.
- About was removed from desktop and mobile navigation as requested. The page is
  retained and linked in the footer so it remains reachable and crawlable.
- The restored desktop navbar measures 950 px wide and approximately 115 px high
  at the 1440 px verification viewport, matching the preserved reference.
- Initial hydration no longer scrolls Shop past its hero automatically.

## Flow health

1. Shop entry — healthy: original hero, full navigation and catalogue controls
   are visible at desktop and mobile sizes.
2. Rentals entry — healthy: original hero, full navigation, popular-rental panel
   and catalogue entry are visible at desktop and mobile sizes.
3. Rental detail — healthy: the existing detail experience now uses the same
   full navigation and footer shell.
4. Bottom CTA — healthy: the original party-planning form is present above the
   full footer on entry, generated category/product and detail routes, and routes
   to Contact as before.
5. Remaining storefront routes — healthy in the automated sweep: every core
   customer route and representative generated detail route returned 200,
   hydrated without console errors, preserved one page heading and had no
   horizontal overflow.

## Evidence

- `before/01-shop.png` and `before/02-rentals.png`: mixed Astro/React shell before
  restoration.
- `after/01-shop.png` and `after/02-rentals.png`: restored desktop pages.
- `after/03-bottom-cta.png`: restored party-planning CTA and full footer.
- `after/04-shop-mobile.png` and `after/05-rentals-mobile.png`: restored mobile
  page and navigation treatment.
- `after/06-shop-astro-navbar.png`: server-rendered Shop page with the restored
  navbar dimensions and original hero position.
- `after/07-product-bottom-cta.png`: generated Astro product route with the full
  bottom CTA and footer.

## Accessibility and evidence limits

The browser sweep checked hydration, heading count, mobile navigation operation,
responsive overflow and the cart path. Screenshot review confirms responsive
reflow and visible touch controls. Screenshots alone do not prove full keyboard,
screen-reader, focus-order or contrast compliance; those remain implementation
and assistive-technology checks rather than claims from this restoration.

## Verification

- Static build: 1,125 pages generated.
- Output tests: 8 passed.
- Full browser smoke: passed across all core routes, representative Shop/Rentals
  details, mobile navigation and cart persistence.
- ESLint: passed.
- Astro typecheck: 0 errors, warnings or hints.
- Security scan: passed.
- Security gate: passed.

## Design approval rule

Future storefront work must preserve the established design by default. Any
proposed visual redesign, page-composition change, navigation redesign or removal
of a conversion section must be shown to the owner and approved before it is
implemented.
