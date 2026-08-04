# Public-sites performance baseline

Audit date: 2026-07-29
Source: local production output after focused builds. Sizes are emitted files on disk; gzip is the sum of individually compressed text assets. These are build signals, not field Core Web Vitals or exact per-route transfer sizes.

## Build-output inventory

| Site | Output files | Total output | JS files / minified / gzip | CSS files / minified / gzip | Image files / bytes | Rendering model |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| byNana Portfolio | 155 | 38.3 MiB | 23 / 1,050 KiB / 302 KiB | 9 / 233 KiB / 42 KiB | 92 / 15.0 MiB | Static Astro HTML plus one deferred React compatibility island; contact loads immediately |
| Faako Website | 112 | 16.2 MiB | 25 / 940 KiB / 237 KiB | 14 / 371 KiB / 66 KiB | 41 / 13.5 MiB | Fully hydrated Vite/React SPA with lazy route chunks |
| REEBS Website | 180 | 150.0 MiB | 30 / 1,118 KiB / 286 KiB | 17 / 935 KiB / 192 KiB | 123 / 145.7 MiB | Fully hydrated Vite/React storefront |
| Stroane public routes | 130 | 97.8 MiB | 10 / 852 KiB / 223 KiB | 5 / 380 KiB / 54 KiB | 103 / 67.1 MiB | Fully hydrated Vite/React storefront sharing a workspace with portal/backend concerns |
| TTNGH artifact | 5 | 16 KiB | none | none | one tiny SVG | Static placeholder artifact |

## byNana

- Eighteen routes are pre-rendered as HTML. Search-critical content does not require JavaScript.
- The compatibility island was previously `client:load` on every route. Static routes now use `client:idle` with a bounded timeout; `/contact` remains `client:load`.
- The primary compatibility chunk has a 150 KiB minified test budget.
- The build optimization step converted/optimized 73 images and reduced the copied image set from about 192 MiB to about 14.3 MiB in the latest build.
- Images are optimized after build rather than through Astro’s responsive image pipeline, so responsive `srcset` coverage is still transitional.
- Analytics is consent-controlled and is not required to render content.

## Faako

- Route-level lazy loading limits some initial JavaScript, but the shell, router, shared UI, icon vendor, particles, and animation code still require hydration before content is interactive.
- The icon vendor chunk is about 330 KiB minified and the React/vendor chunk about 209 KiB.
- Several route CSS files and a 111 KiB shared UI stylesheet are emitted.
- Large PNG and SVG assets dominate the non-code output.
- Google Analytics is consent-controlled. Public content and metadata should become static during the planned Astro migration instead of receiving piecemeal SPA optimization now.

## REEBS

- The image inventory dominates output: about 146 MiB, including large PNG and SVG files.
- All public routes hydrate a React storefront. Booking, cart, checkout, auth, analytics, and catalogue data can create route-specific API waterfalls.
- Static root metadata reduces some crawler work, but route content and structured data still depend on JavaScript.
- The next migration should inventory which product/rental data is build-time, request-time, or user-specific before choosing islands.

### Astro follow-up — 2026-07-31

The public site now pre-renders 1,125 documents from tracked source. Product, category, policy, and error pages do not hydrate a page-level React application. Live catalogue, cart, booking, checkout, contact, session, and selected content interactions remain route-level islands. The former 1.12 MiB all-route SPA JavaScript baseline is no longer shipped to every route. Across all route chunks, the Astro output contains 33 JavaScript files totalling 974,194 bytes raw / 248,626 bytes gzip; the largest is 476,418 bytes raw, so the previous over-500 kB build warning is gone. The principal remaining risk is the legacy media library, which keeps the complete static artifact near 215 MiB; this is post-parity optimisation work.

## Stroane

- The public storefront and portal are code-split, but the emitted public storefront chunk remains about 241 KiB minified alongside vendor and shared UI chunks.
- The workspace builds Prisma client before the Vite frontend, reflecting the current mixed public/backend boundary.

### Boundary follow-up — 2026-08-02

The storefront and admin now compile from independent entry graphs into `dist/storefront` and `dist/admin`. The storefront no longer emits a portal application chunk, and public pages are route-lazy: the storefront entry is 19.93 kB raw, while individual page chunks range from small policy/auth modules to 21.16 kB for the homepage, with the catalogue data isolated in a 69.59 kB raw chunk. The shared React/router vendor remains 232.47 kB raw. Browser builds no longer run Prisma generation. Static route shells add route-specific metadata and structured data without changing the interactive Vite runtime.
- About 67 MiB of emitted images dominates output.
- Google Fonts add third-party DNS, connection, stylesheet, and font requests.
- Product APIs and checkout flows are legitimate dynamic work; service, about, resource, legal, and marketing content should become static at migration time.

## TTNGH

- The tiny artifact is not a meaningful production performance baseline.
- Future measurement must include real imagery, fonts, donation providers, form endpoints, analytics consent, and Cloudflare/Railway network behaviour.

## Highest-value opportunities

1. Keep removing byNana compatibility hydration page by page as static views are converted to Astro.
2. At each Astro migration, make static content zero-JavaScript by default and budget every island.
3. Establish image inventory and compression work as a prerequisite for REEBS and Stroane migrations.
4. Self-host/subset fonts where licensing permits and avoid loading unused weights.
5. Measure production Core Web Vitals separately; build size does not reveal LCP, INP, CLS, cache effectiveness, or API latency.
