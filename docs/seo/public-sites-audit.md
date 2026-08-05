# Final public-site SEO and AEO audit

Audit date: 2026-08-04. Generated-output tests were run after the migrations.

| Site | Metadata/canonical/indexing | Sitemap/robots/redirects/links | Structured/direct-answer content | Result |
| --- | --- | --- | --- | --- |
| byNana Portfolio | Route-specific titles/descriptions/canonicals/Open Graph; 404 is noindex | Sitemap matches content routes; tests find no broken local links or missing assets | Organisation/person/project/article structures derive from repository content | Passed |
| Faako Website | Every public route prerendered with complete metadata; canonical and indexability contract tested | Sitemap and robots agree; redirects, 404 and forms use Astro deployment contract; no placeholder targets | Existing product/service explanations are structured without invented claims | Passed |
| REEBS Website | Public route metadata and one h1 tested; cart/checkout/status routes are noindex | Sitemap/robots/redirect/CSP contract tested; catalogue snapshot contains public fields only | Product/category and organisation markup use approved catalogue facts | Passed |
| Stroane public | Route-specific static shells, canonicals and organisation/product data; checkout noindex | Storefront sitemap excludes checkout; admin disallowed and has no sitemap | Product data comes from the authoritative catalogue boundary | Passed for approved Vite ADR architecture |
| TTNGH | No tracked implementation | No sitemap/robots/redirects to inspect | Requirements only | Blocked/deferred |

## Broken links and route changes

Automated output tests for byNana and Faako reject missing local targets; the migrated public-site tests verify their redirects and status routes. No public route was removed in this final phase, so no new redirect was required. Continue treating redirects as tested deployment assets rather than client-router fallbacks.

## AEO conclusions

- Direct-answer headings, FAQs and schema must answer real supported questions; metadata alone is not AEO.
- Dates, prices, availability, organisation identity and event status must come from an authoritative content/API source.
- Transactional/private routes remain noindex and out of sitemaps.
- Article `datePublished`/`dateModified`, product offers/availability and event dates must be omitted when the facts are unavailable rather than guessed.

