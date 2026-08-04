# Stroane public modernisation

Date: 2026-08-02

Framework: React/Vite retained

## Completed

- Created a storefront-only entry graph and `dist/storefront` artifact.
- Removed portal modules and portal service-worker registration from the storefront graph.
- Lazy-loaded storefront routes rather than importing every page into the initial route module.
- Added framework-independent public product/category base contracts in `@faako/types`.
- Preserved live catalogue API reads and the checked-in public outage fallback.
- Generated route-specific metadata shells for content, policy, customer, checkout, and product routes.
- Generated Product and Organization JSON-LD only from existing catalogue/business facts.
- Marked checkout, search, customer, and authentication routes `noindex`.
- Generated the sitemap from the same source used for product route shells.
- Preserved contact/product enquiry and Paystack checkout boundaries.

## Performance result

The previous combined output emitted separate 240.52 kB storefront and 257.94 kB portal application chunks plus their CSS. The separated storefront build emits no portal application chunk. Its route shell is 19.93 kB raw (6.52 kB gzip), while informational, product, account, and checkout pages are loaded on demand. The shared React/vendor chunk remains 232.47 kB raw (74.21 kB gzip) and is cached independently from route chunks.

The storefront artifact also removes the portal service worker after the Vite copy stage, so public hosting cannot accidentally serve an admin-only worker.

## Compatibility

- Existing URLs and React Router behavior remain.
- `/catalogue` and `/shop` remain equivalent public routes.
- `/login` and `/admin/*` continue to hand off to the portal origin.
- API payloads and Paystack flow are unchanged.
- The existing combined localhost mode remains available.

## Follow-up measurement

Measure indexed catalogue coverage, search impressions, Core Web Vitals, and conversion before reopening the Astro decision. Do not infer an Astro migration solely from another app’s framework.
