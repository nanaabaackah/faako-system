# REEBS public-site scope decision

Date: 2026-07-31
Status: Accepted

## Decision

The public REEBS Website remains an Astro candidate. It is a public storefront and enquiry surface with bounded React commerce islands; it is not an authenticated operational application. REEBS Portal remains React/Vite and owns staff/admin workflows. The REEBS API and Portal backend remain the source of truth for inventory, customers, orders, bookings, authentication, and payment state.

Next.js is not justified by the current scope. The authenticated surface is too narrow to invalidate the approved Astro recommendation.

## Confirmed responsibilities

| Capability | Public website scope | Boundary |
| --- | --- | --- |
| Public catalogue | Yes | Astro exposes indexable catalogue/category/product documents; live records come from the REEBS API |
| Categories | Yes | Public category URLs are derived from the reviewed API snapshot |
| Product details | Yes | Rental and shop detail URLs are pre-rendered; live rental availability is refreshed by the existing API flow |
| Search/filter | Yes | React islands retain live search, filtering, variants, and availability controls |
| Cart | Yes | Browser-local cart state; API remains authoritative at submission |
| Checkout | Yes | Customer/order/booking intake only; API validates and creates records |
| Customer authentication | Limited | `/customer-login` and password reset support the existing bounded session flow |
| Customer account | No | No customer dashboard/profile application was discovered |
| Order history | No | No public order-history route was discovered |
| Enquiry flows | Yes | Contact, booking, checkout, email, telephone, and WhatsApp |
| WhatsApp | Yes | Public contact links are retained |
| Paystack | No direct browser checkout | Existing privacy/payment references are retained; no Paystack secret or card credential is handled by Astro |
| MoMo | Preference only | Checkout records the selected provider; it does not collect a PIN or mobile-money credential |

## Ownership rules

- REEBS Website may consume public/shared types, validation, API-client, UI, theme, finance, and utility packages.
- REEBS Website must not own Prisma, a database connection, Express routes, operational authentication policy, admin/POS pages, payment credentials, email infrastructure, or inventory mutations.
- REEBS Portal remains the staff surface. `/login` and `/admin/*` redirect to `portal.reebspartythemes.com`.
- Backend enforcement and API validation are authoritative. Frontend status and permission checks are user-experience aids only.
- The committed public catalogue snapshot contains public display fields only. Refresh is explicit; ordinary builds never query production.

## Consequences

- Astro owns documents, canonical URLs, metadata, sitemap, robots, redirects, JSON-LD, and error pages.
- React remains where stateful interaction is required: live catalogue filters, cart, booking, checkout, contact, customer session, maps, and selected home-page behaviour.
- Product/category routes can be indexed without making the public app a database owner.
- Production cutover requires a Cloudflare preview and parity sign-off; the current deployment remains the rollback target until then.
