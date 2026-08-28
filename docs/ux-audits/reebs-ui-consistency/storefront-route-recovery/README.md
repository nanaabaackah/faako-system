# REEBS storefront route recovery

Date: 2026-08-12

## Problem found

Rental detail routes were correctly pre-rendered by Astro, but the React detail
island replaced the static rental with the live inventory response after
hydration. An empty, partial or differently shaped API response therefore turned
a valid detail page into the `Rental not found` state. Rental detail booking
buttons also used uppercase `/Book`, which is unsafe on case-sensitive static
hosting.

The same empty-response replacement risk existed on the Rentals and Shop entry
pages, where durable pre-rendered catalogue data could be erased during a
temporary API failure.

## Changes

- Rental details keep their Astro catalogue item as a fallback when live data is
  missing, while still preferring a matching live record when available.
- Rentals merges live data into the public snapshot instead of deleting snapshot
  routes from the listing.
- Shop keeps its pre-rendered catalogue when the live response is empty.
- Rental booking links now use the built lowercase `/book` route.
- A static route/link auditor checks every generated HTML file, every internal
  link, every catalogue route, configured redirects and linked assets.
- 404 and 500 pages now share one responsive storefront status-page component
  with clear recovery actions, the established header and the full footer CTA.
- Storefront loading skeletons now use REEBS surfaces and accent colours, fit the
  framed scroll container, and remain static when reduced motion is requested.

## Flow health

1. All generated routes — healthy: 1,125 HTML routes and their internal links
   resolve to a page, redirect or asset.
2. Rental details — healthy: all 22 routes retain their heading and booking link
   after hydration with empty API responses.
3. Shop details — healthy: all 1,045 generated product routes exist and remain
   reachable from their generated catalogue links.
4. Error recovery — healthy: 404 and 500 pages retain storefront navigation,
   full footer and clear next actions on desktop and mobile.
5. Loading feedback — healthy: page-shaped skeletons match the storefront frame,
   use polite live status text and respect reduced motion.

## Verification boundary

The crawl verifies local generated routes, assets, redirects and internal links.
External services such as WhatsApp, Maps and the separately deployed staff portal
are intentionally not requested by the crawler. The browser sweep uses mocked API
failures to prove the static storefront fallback remains usable.
