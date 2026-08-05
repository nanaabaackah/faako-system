# Final frontend performance audit

Audit date: 2026-08-04. Values below are local built-output disk sizes, not network transfer sizes; media-heavy directories can dominate them. Bundle findings use Vite/Astro build output and the prior baseline in `public-sites-baseline.md`.

| Surface | Built output | Main observation | Final assessment |
| --- | ---: | --- | --- |
| byNana Portfolio | ~39 MB / 19 asset files | Astro prerenders every route, but the React portfolio application remains a large island. Static routes use deferred hydration and the contact route loads immediately. Image and initial-chunk budgets are tested. | Improved from the Vite-only baseline; further content-to-Astro extraction remains valuable. |
| Faako Website | ~18 MB / 7 asset files | Astro route shells, selective islands, optimised static output and hashed CSP. | Meets current baseline. |
| REEBS Website | ~175 MB / 8 primary asset files | Astro owns routing/SEO, but catalogue/cart/checkout islands and large product media dominate. | JavaScript is bounded; media pipeline/CDN sizing is the main opportunity. |
| Stroane storefront + admin | ~321 MB / 15 primary assets | Separate Vite graphs prevent admin code and Paystack/storefront code from crossing surfaces. Storefront vendor is about 232 KB raw/74 KB gzip; admin vendor about 287 KB raw/86 KB gzip. | Boundary split is effective; media/data output remains large. |
| REEBS Portal | ~135 MB / 94 assets | Route chunks exist; large vendors include React (~496 KB raw), jsPDF, PDF rendering and icons. | Acceptable operational split, but PDF/icon loading should be lazy and measured. |
| Dev ERP | ~2.3 MB / 55 assets | Operational modules are route split. | No framework change warranted. |
| Faako ERP | ~540 KB / 16 assets | Small fixture/demo surface. | No optimisation priority until product status changes. |

## Hydration and waterfalls

- Astro public sites should continue converting genuinely static content to `.astro`; interactive forms, cart, auth and checkout remain islands.
- byNana still hydrates the full portfolio view, though static routes defer it. This is the largest remaining hydration opportunity.
- REEBS public catalogue uses an approved API/snapshot boundary and must not regain database dependencies. Avoid duplicate snapshot plus live-API waterfalls where one source can satisfy the route.
- Third-party analytics is consent-gated. Maps, Paystack, PDF and rich animation libraries should load on interaction/visibility, not global application start.

## Caching, images and fonts

- Public `_headers` provide immutable caching for hashed assets and short/no-cache rules for route HTML where applicable.
- Keep width/height/aspect-ratio metadata, responsive formats and lazy loading below the fold. Product/portfolio source media should be resized before commit; repository size is not a CDN strategy.
- Self-host or preconnect only fonts actually used. Avoid adding brand-specific fonts to shared operational bundles.

## Next budgets

- Public initial JavaScript: maintain each current tested budget; require an explanation for >10% growth.
- Operational route chunks: investigate any new gzip chunk over 150 KB.
- Images: no unoptimised multi-megabyte hero/product image in initial viewport.
- New third-party scripts require purpose, consent classification, failure behaviour and performance evidence.

