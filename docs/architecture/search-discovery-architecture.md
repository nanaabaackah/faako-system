# Search visibility and AI discovery architecture

Date: 2026-10-18  
Status: implemented foundation

## Boundaries and vocabulary

- **SEO** covers crawlability, indexability, canonical URLs, metadata, semantic HTML, links, performance, redirects, sitemaps and response status.
- **AEO** covers visible, well-structured answers and exact schema that help an answer engine understand supported facts.
- **GEO** covers clear entities, relationships, provenance and citation-suitable public content for generative discovery. It does not guarantee a citation or ranking.
- **Geographic targeting** covers genuine market, language, currency and service-area relevance. It must not manufacture offices, coverage or near-duplicate city pages.
- **Agentic AI readiness** covers authenticated capability discovery and safe, permission-scoped actions. Public indexing is not permission to perform an action.
- **Accessibility** covers keyboard and screen-reader support, readable content, reduced motion, reading assistance and text-to-speech. These features are not AEO.

The repository audit did not find text-to-speech or reading-assistance controls labelled as AEO. Existing AEO labels describe content/answer structure, so no stored accessibility preference or API needed renaming. Accessibility behavior remains independently governed by `docs/accessibility/`.

## Ownership model

`@faako/discovery` is a small, framework-neutral package. It owns canonical path normalization, absolute URLs, safe JSON-LD serialization, exact-input FAQ and breadcrumb builders, robots output, and a page-contract validator.

Applications own all facts and policy decisions:

- production origin and indexability;
- page titles, descriptions and social images;
- organization, person, service, product, event and article data;
- whether visible FAQs justify `FAQPage`;
- localized routes and service areas;
- sitemap route inventory and redirects;
- authentication, authorization and agent permissions.

This split prevents a shared helper from inventing business claims or coupling Astro, React, Express and FastAPI applications.

## Rendering and indexing strategy

| Surface | Rendering | Discovery policy |
| --- | --- | --- |
| byNana Portfolio | Astro static pages with React islands | Public, indexable route documents |
| Faako Website | Astro static pages with React islands | Public service pages; onboarding/auth-like routes noindex |
| REEBS Website | Astro static pages with commerce islands | Public pages and approved catalogue details; account/checkout noindex |
| TTNGH | Astro static pages | Production may index only when explicitly enabled; CMS route excluded |
| Travel With Ease Website | Astro static foundation | Fail-closed noindex until a real domain and explicit launch flag are approved |
| Stroane storefront | Vite plus generated route HTML shells | Public approved routes/products; search, checkout and account flows noindex |
| Dev ERP, Faako ERP, REEBS Portal, REEBS Water, Travel With Ease Portal | React/Vite operational applications | Entire surface noindex; server authorization remains mandatory |

Static public pages must contain their primary copy, title, description, canonical, robots directive and applicable JSON-LD before client JavaScript runs. Dynamic islands may enhance interaction but must not own indexable page identity.

## Measurement and ownership verification

- Every public site accepts a deployment-provided Google Search Console HTML verification token and emits the verification meta tag only when the token is non-empty. Astro sites use the public prefix already established by that app; the Stroane storefront uses a Vite HTML plugin and excludes the private portal build.
- Google Analytics identifiers are public configuration, never secrets. Analytics starts only after an explicit analytics choice, keeps advertising storage denied, respects Do Not Track, and removes Google Analytics cookies when consent is withdrawn.
- Public-site content security policies allow the Google tag and Analytics collection endpoints. Private operational applications are not given Search Console ownership tags.
- Consent records must match the current application schema. Missing, malformed or incomplete records cause the cookie notice to be shown instead of being treated as consent.
- Search Console property creation, DNS verification and sitemap submission remain deployment/Google-console operations; the repository provides the HTML-tag integration point without claiming those external steps are complete.

## Geographic targeting

1. Use `en-GH`, `en_GH`, `GH` and `GHS` only where they match approved content or data.
2. Add `hreflang` only for real localized alternatives. A single Ghanaian English page does not imply translations.
3. Use `areaServed` for verified service coverage. A postal address or `LocalBusiness` requires a real customer-facing location.
4. Create city or regional pages only when each has distinct useful content, availability or contact information. Do not create doorway pages.
5. Keep contact details consistent with the visible page and content owner records.

## Agentic AI decision

No new MCP server or generic agent-action API is approved. Public information is discoverable through server-rendered HTML, JSON-LD, sitemaps and approved catalogue routes. Existing APIs remain application APIs.

A future agent action requires a named use case and threat model, explicit authentication, backend capability and tenant checks, bounded input validation, rate limits, request IDs, audit events, idempotency for mutations, and human confirmation for payments or privileged changes. Prompt content and retrieved documents are untrusted input. Robots directives are never an authorization control.

See `docs/security/agentic-ai-readiness.md` for the application decision matrix.

## Test contract

Shared unit tests cover normalization, canonical generation, safe JSON-LD, exact schema builders, fail-closed robots output, the page contract, and the public measurement/verification contract. Application output tests remain responsible for real built HTML, one H1, status codes, sitemap membership, visible/schema agreement and public/private separation. Browser QA verifies TTNGH consent, withdrawal, persistence and Do Not Track with Google requests mocked.
