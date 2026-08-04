# ADR: retain Vite for the Stroane public storefront

Date: 2026-08-02

Status: accepted

## Decision

Retain React/Vite for the Stroane public/customer storefront after separating it into an independent compile-time entry and deployable artifact. Do not migrate it to Astro in this change.

## Evidence

| Factor | Retain Vite | Move to Astro |
| --- | --- | --- |
| SEO/content | Weaker body rendering; mitigated with per-route static metadata, canonical, JSON-LD, and sitemap shells | Stronger default static body rendering |
| Catalogue | Live API plus outage fallback, filters, cart controls, variants and stock reconciliation fit the existing React model | Would require a substantial island and data-boundary rewrite |
| Authentication | Customer signup/login/reset/account routes are part of the storefront | Authenticated islands would remain substantial |
| Checkout | Multi-step delivery/pickup, location search, order creation, redirect and return verification are core | Most checkout would remain React and client-rendered |
| Interactivity | High and business-critical | Astro would reduce JavaScript mainly on informational routes |
| Hosting | Two deterministic Vite artifacts fit current Cloudflare/Railway deployment | Astro is also compatible but adds migration/cutover cost |
| Maintenance | Preserves proven commerce behavior and current tests | Would temporarily duplicate or relocate a large commerce surface |
| Performance | Separate entry graph plus lazy routes removes admin code from the public artifact | Better theoretical floor for content pages |

The decisive difference from byNana, Faako Website, and REEBS Website is that Stroane’s public surface currently owns customer authentication and an approved Paystack checkout, not merely enquiry links or a light catalogue.

## SEO mitigation

The retained Vite build now generates route-specific static HTML shells for public content and catalogue items. These include title, description, canonical URL, robots policy, Open Graph, Twitter metadata, and accurate Organization/Product structured data. Transactional/customer routes are `noindex`. The sitemap is generated from the same route/product source.

This is not equivalent to server-rendered page body content. If organic catalogue performance remains below target after measurement, a later ADR may move only the public content/catalogue-reading routes to Astro while leaving checkout and customer identity as an explicitly separate React application.

## Consequences

- Public and admin deploy independently.
- Public route chunks are lazy-loaded.
- The API remains unchanged and authoritative.
- The team avoids an unproven framework migration during payment/admin boundary work.
- A future Astro decision requires measured SEO benefit and an explicit customer/checkout ownership plan.
