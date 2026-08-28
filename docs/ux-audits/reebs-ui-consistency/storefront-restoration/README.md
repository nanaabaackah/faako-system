# REEBS storefront restoration check

Date: 2026-08-11

## Scope

Checked the homepage, shared navigation, shop catalogue, product detail, rentals,
booking, cart, checkout, customer login, contact, FAQ, policies, error output and
representative generated catalogue routes at a 390 × 844 mobile viewport.

## Findings and corrections

- The pages still existed, but the React header exposed only four routes and the
  Astro catalogue header used a separate partial navigation list.
- Several React links used case-sensitive paths such as `/Shop`, `/Rentals`,
  `/Contact` and `/Cart`, which do not match the generated Astro paths.
- The static catalogue header clipped later links on mobile after navigation was
  restored.
- Inventory requests could report stale errors after the originating page had
  unmounted.
- The Contact map could render different fallback text on the server and first
  browser render when environment exposure differed, causing React hydration to
  replace the page.

The storefront now uses one shared navigation configuration. Both shells expose
Home, Shop, Rentals, Book a party, About and Contact; account, cart, checkout,
FAQ and policy destinations are available consistently through header actions
or the shared footer groups. All internal route literals use their generated
lowercase paths, mobile catalogue links wrap visibly, stale requests are ignored
after unmount and the map's initial fallback is hydration-safe.

## Evidence

1. `01-home.png` — homepage and primary conversion entry.
2. `02-shop.png` — shop with complete wrapped catalogue navigation.
3. `03-product.png` — generated product detail with complete navigation.
4. `04-mobile-menu.png` — React mobile menu exposing all primary destinations.
5. `05-cart.png` — cart after a product was added and persisted across navigation.
6. `06-checkout.png` — checkout route and empty-cart state.
7. `07-contact.png` — Contact after hydration and map fallback stabilization.
8. `08-customer-login.png` — customer booking-continuation login.

## Verification

- Static build: 1,125 pages generated.
- Output tests: 6 passed, including complete shared-navigation coverage.
- Browser smoke: all root customer routes, representative shop/rental detail,
  mobile navigation, hydration, canonical metadata, horizontal overflow and cart
  persistence passed with no page or console errors.
- Lint: passed.
- Astro typecheck: 0 errors, warnings or hints.

Screenshot review confirms the complete primary navigation is visible in both
mobile shells. The cookie settings region intentionally remains visible in the
first-visit captures and can obscure lower-viewport content until the visitor
chooses a preference.
