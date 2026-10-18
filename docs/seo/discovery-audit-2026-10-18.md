# SEO, AEO, GEO and geographic discovery audit

Date: 2026-10-18

## Application audit

| Application | Existing evidence | Gap or risk found | Completed in this change | Next justified step |
| --- | --- | --- | --- | --- |
| byNana Portfolio | Astro static output; centralized metadata/schema; canonical, OG/Twitter, sitemap, robots and SEO output tests | Discovery helpers were app-local | Adopted shared canonical, absolute URL and safe JSON-LD helpers | Continue reducing the site-wide React island and validate deployed response headers |
| Faako Website | Astro; unique route metadata; Organization, WebSite, WebPage, Service and visible FAQ schema; noindex app-like routes | Duplicated URL/serialization logic | Adopted shared discovery helpers | Add deeper approved service content for ERP development, integration and workflow automation; do not invent locations or outcomes |
| Faako ERP | Vite demo, not an approved public product surface | Generic HTML could be indexed | Added meta robots, fail-closed robots file and `X-Robots-Tag` | Keep demo APIs scoped; publish product information through the Faako Website instead |
| Faako API | Express/Prisma service with shared contracts and request IDs | No reviewed public OpenAPI contract; not a content surface | No public exposure added | Produce a reviewed OpenAPI document only for stable public intake endpoints, excluding internal integrations |
| Dev ERP | Authenticated Vite/Express ERP; rate limits, request IDs, capability checks, audit paths and bounded AI features | No explicit noindex directive in the initial shell | Added meta robots, fail-closed robots file and `X-Robots-Tag` | Test deployment headers and keep every AI operation authenticated, tenant-scoped and audited |
| REEBS Website | Astro public documents; catalogue route shells; canonical/social metadata; Product/Breadcrumb schema; sitemap and output tests | Shared discovery logic duplicated | Adopted shared canonical, URL and JSON-LD helpers | Validate live availability claims against public catalogue snapshots without exposing internal stock controls |
| REEBS Portal | Authenticated Vite/Express operations surface | `robots.txt`, sitemap, canonical and social metadata incorrectly described/indexed the public storefront | Replaced with noindex shell, fail-closed robots and `X-Robots-Tag`; removed stale portal sitemap and public canonical/social claims | Verify the deployed portal host returns private cache and indexing headers on every SPA fallback |
| REEBS Water | Authenticated Vite operational surface | No explicit initial-shell indexing restriction | Added meta robots, fail-closed robots and `X-Robots-Tag` | Keep orders, customers, credit, pricing and inventory unavailable to public discovery |
| Stroane storefront | Vite public storefront with generated route shells, canonical/social metadata, sitemap and conditional Product schema | Canonical and JSON-LD serialization duplicated; CSR remains a constraint between generated route shells | Adopted shared canonical and JSON-LD helpers while preserving the accepted Vite boundary | Add built-output tests for product price/availability agreement and measure route-shell crawlability before reconsidering framework |
| Stroane portal/API | Separate portal build plus co-located authenticated API; admin finalizer emits noindex headers | Public and private ownership remain in one workspace | No boundary rewrite; current portal finalizer retained | Separate ownership only under the accepted roadmap; never publish supplier, stock-control, customer or payment records |
| TTNGH | Astro; NGO/WebSite/WebPage, verified Person/Event/Article, breadcrumb and visible FAQ schema; dynamic robots; explicit preview indexability | Shared schema/serialization logic duplicated; deployment docs are stale about scaffold status | Adopted shared canonical, URL, breadcrumb, FAQ, robots and JSON-LD helpers | Reconcile active deployment documentation; keep event status/dates/location current and retain editorial approval gates |
| TTNGH API | Rate-limited enquiry/webhook/payment boundaries with validation, request IDs and payment transition audit | Not an agent API; sensitive donation/contact data | No agent exposure added | Document stable endpoints internally; require explicit confirmation and provider verification for any future assisted donation flow |
| Travel With Ease Website | Astro content and estimator foundation | Placeholder `.example` origin was allowed to index and emitted a sitemap | Made indexing fail closed unless a real origin and explicit launch flag are both present; added dynamic robots and shared discovery helpers | Launch only after identity, content, persistence, client approval and real contact details are complete |
| Travel With Ease Portal/API | Private Vite portal and Express API foundation | Production auth/persistence remain launch blockers | Added fail-closed portal robots and `X-Robots-Tag`; existing HTML noindex retained | Do not expose lead, itinerary, traveller or payment data to agents |
| Faako Analytics (`services/reebs-analytics` compatibility path) | Private FastAPI/Pydantic analytical capability with request IDs and service-secret boundary | Compatibility path and optional-auth history require continued review | No public discovery or new analytics service added | Keep fail-closed service auth and publish no tenant datasets |
| System Starter / UI Workbench | Internal reference tooling | Not deployment targets | Left unchanged | Add noindex only if either receives a hosted environment |

## Classification result

No accessibility feature was incorrectly implemented as AEO in active source. “AEO basics” in Faako client setup describes structured answers for answer engines; it is correctly classified. Repository documentation previously used “SEO/AEO” as a broad umbrella, so the new architecture document now separates SEO, AEO, GEO, geographic targeting, agent readiness and accessibility explicitly.

## Shared versus local

Shared: deterministic URLs, safe JSON-LD serialization, exact FAQ/breadcrumb shapes, robots text and page-contract validation.

Local: facts, copy, page types, indexability approvals, sitemaps, catalogue/event freshness, geographic coverage, redirects, APIs and authorization. Product, Event, LocalBusiness and FAQ schema remain opt-in because correctness depends on visible app-owned data.

## Security and privacy findings

- The REEBS Portal indexing leak was configuration exposure, not an authorization control; it is corrected at document, robots and response-header layers.
- Private and transactional data remains outside public schema and sitemaps.
- No arbitrary query interface, prompt-driven tool router, MCP server or autonomous payment action was introduced.
- Existing request IDs, validation, permission checks, rate limits, audit mechanisms and idempotency controls are prerequisites to reuse, not signals that every endpoint is agent-safe.
- Public structured data must contain only facts already approved for the visible page.

## Outstanding content gaps

- Faako needs more authoritative, approved service detail and evidence before stronger GEO claims are warranted.
- TTNGH event/editorial freshness is an ongoing content operation, not a one-time technical task.
- Travel With Ease is intentionally private and incomplete.
- Stroane route shells need continuing output verification because the storefront remains Vite-based.
- No genuine translated route set exists, so additional `hreflang` variants were not invented.
