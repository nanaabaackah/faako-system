# Public-sites SEO and AEO baseline

Audit date: 2026-07-29
Scope: byNana Portfolio, Faako Website, REEBS Website, Stroane public routes, and the TTNGH scaffold artifact.

This is a repository and local-production-build audit, not a live search-console or production crawl. It records what the current applications can emit. Business claims were not added or validated by this audit.

## Summary

| Site | Initial HTML | Canonicals | Sitemap / robots | Structured data | Social metadata | AEO readiness | Baseline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| byNana Portfolio | Route-specific, static Astro HTML | Route-specific and absolute | Generated sitemap; explicit robots | Person, WebSite, ProfilePage, BlogPosting, CreativeWork, BreadcrumbList | Complete OG and Twitter fields | Strong page summaries and case-study content | Reference |
| Faako Website | One Vite shell; useful home metadata added in this task | Home only in initial HTML; route titles remain client-only | No sitemap or repository robots file | None | Home baseline added in this task | Home and module copy answer common questions, but it is not independently crawlable by route | Needs Astro migration |
| REEBS Website | One Vite shell with a useful home description | Client-applied by route | Static sitemap and robots | Organisation/store, service, FAQ, product and breadcrumb data, mostly client-rendered | Present, mostly client-applied | Good FAQ and service detail | Partial |
| Stroane public routes | One Vite shell with a useful home baseline | Home in initial HTML; route canonicals client-applied | Static but incomplete sitemap; robots present | Organisation/service/FAQ/product data, client-rendered | Home baseline repaired in this task; route fields client-applied | Strong advisory/resource content | Partial |
| TTNGH | Static, non-interactive scaffold artifact only | Placeholder `.example` canonical | Robots blocks all crawling | Organisation and WebSite scaffold data | Scaffold only | Requirements identify future direct-answer content; no launch content exists | Intentionally not indexable |

## byNana Portfolio

- Indexable routes: `/`, `/about`, `/resume`, `/projects`, five project detail routes, `/blog`, five blog detail routes, `/contact`, and `/privacy`.
- `/404` returns a 404 status and emits `noindex, nofollow`; it is excluded from the sitemap.
- Every generated public route has a unique title, description, canonical URL, primary heading, OG metadata, Twitter metadata, and JSON-LD graph.
- Blog schema includes ISO publication and modification dates from the existing article records.
- Project and article detail pages include breadcrumbs. Project pages use `CreativeWork`; blog pages use `BlogPosting`.
- Internal local links and assets are checked against the built output. Duplicate HTML IDs are also checked.
- The current migration did not rename retained public routes. Removed hidden project records are not advertised in the sitemap; no unverified replacement destination was invented.
- The contact route is crawlable as content and progressively enhanced as a form. A configured submission endpoint is optional; without it the existing mail-client fallback remains.
- No dedicated FAQ page is warranted for a personal portfolio solely for SEO. Direct answers are instead supplied by descriptive introductions, project summaries, resume content, and article headings.

## Faako Website

- The public and authenticated routes share one Vite SPA shell.
- Before this task, the initial document exposed only the title `Faako`. The home shell now has a descriptive title, description, canonical, robots, author, OG, and Twitter baseline using facts already stated on the home page and the registered production host.
- Per-route titles are changed after React runs. Descriptions, canonicals, and indexability are not reliably differentiated in initial HTML.
- No sitemap, structured data, or repository robots file was found.
- Public, account, setup, dashboard, and password-reset routes share the same crawlable shell. This is an indexability risk until routes can emit server/static heads.
- The home page and module records contain useful direct-answer copy, but search crawlers receive it only after the SPA executes.
- The route model includes no declared redirects for historical public URLs.

## REEBS Website

- The root document contains useful description, robots, canonical, OG, and Twitter metadata.
- A client-side SEO helper updates titles, descriptions, canonicals, alternate language links, social metadata, and JSON-LD by route.
- Structured-data coverage includes organisation/store, website, service, FAQ, product, webpage, and breadcrumb concepts.
- The static sitemap lists public pages and rental categories. Robots excludes account, admin, cart, checkout, and customer-login paths.
- `/home` duplicates `/`; the application marks the duplicate route noindex. `/gallery` redirects to `/about`.
- Product/rental structured data and canonical URLs depend on browser execution.
- Unknown SPA paths redirect to `/`, which hides genuine not-found states from users and crawlers.
- Large image and SVG inventories increase crawl/render cost even though metadata coverage is comparatively mature.

## Stroane public routes

- The base document already contained a useful title and description. This task added the missing home canonical, OG title/description/URL/alt, and Twitter title/description/image/alt.
- The previously referenced `/assets/og-image.png` did not exist. Both the static shell and client SEO helper now reference the existing Stroane long logo.
- Route metadata and canonicals are applied by a React hook after hydration.
- JSON-LD exists for organisation, services, FAQs, and products, but it is also client-rendered.
- `/catalogue` and `/shop` expose the same shop surface without a single declared canonical alias. This is a duplicate-content risk.
- The static sitemap covers only a subset of relevant public routes and omits some content, contact, legal, and product routes.
- Search, error, and transactional/account routes need a single, explicit indexability matrix rather than relying on a shared SPA document.
- Google Fonts are loaded from a third party before the application renders.

## TTNGH

- `apps/ttngh` currently has no source package or build configuration. Only a small generated artifact and planning documents exist.
- The artifact intentionally uses `noindex, nofollow`, disallows all robots, and points to a placeholder `.example` canonical.
- This is correct for a non-launch scaffold. It must not be treated as a deployable production website.
- Mission, programmes, events, donations, support access, leadership, contact details, and impact facts remain editorial inputs. No facts should be inferred from the requirements.

## Priority findings

1. Keep byNana as the static-HTML reference and enforce its output tests in CI.
2. Migrate Faako public routes first among the remaining marketing sites because its route metadata and indexability are weakest.
3. During REEBS migration, preserve the existing schema coverage while moving it into static/server output and replacing the catch-all home redirect with a real 404.

4. During Stroane migration, choose one canonical shop URL, expand the sitemap from the route inventory, and emit product/service schema without client execution.
5. Recreate TTNGH from its approved requirements and real content; do not promote the artifact.

### REEBS Astro follow-up — 2026-07-31

The public REEBS Website now emits titles, descriptions, canonicals, Open Graph metadata, social-preview metadata, organization/service/FAQ/breadcrumb/product JSON-LD, and crawlable category/product links in initial Astro HTML. Transactional routes are noindex and excluded from the Astro sitemap. The SPA catch-all was replaced by a real 404, and changed/legacy paths have explicit redirects.
