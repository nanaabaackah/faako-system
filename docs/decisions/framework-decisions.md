# Framework decisions

Date: 2026-07-25
Decision status: proposed, based on repository audit

## Decision rules

- Astro is preferred for content-led public sites where route HTML, structured data, crawlability, and low JavaScript cost are primary.
- React/Vite is preferred for authenticated, stateful operational applications where client navigation and dense interaction dominate.
- Express/FastAPI services remain service runtimes rather than being forced into a frontend framework.
- Next.js is not selected without a demonstrated need for React-specific server rendering and a compatible deployment/runtime boundary.
- “Migration required” means a recommended framework or ownership change, not authorization to perform it now.

## Application decision table

| Current application | Current framework | Application purpose | Recommended framework | Migration required | Priority | Main risks | Recommended next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| byNana Portfolio | Astro 7 + site-wide React 19/React Router island | Public portfolio, resume, projects, blog | Astro with smaller React islands | Partial refactor, not framework migration | Medium | Duplicate Astro/React route ownership; large client chunk; hydration sensitivity | Keep Astro, add page-level regression baselines, then reduce the site-wide router island incrementally |
| Dev ERP | React 19/Vite + Express/Prisma | Authenticated ERP, monitoring, projects, finance, rent, automation | React/Vite + existing API | No | High quality-gate priority | Current lint failure; broad env surface; DB-coupled build; complex auth/CSRF | Fix lint and make type/test/build gates complete before touching architecture |
| Faako API | Express 5 + Prisma | Onboarding, demo access, activity integration | Express or equivalent dedicated API | No | High | Missing standard test script; API contracts implicit; deployment migrations | Add standard tests/contracts and keep API independently deployable |
| Faako ERP | React 18/Vite | Interactive ERP demo | React/Vite | No | Low | Client-persisted demo access could be mistaken for production auth; no tests | Document the demo trust boundary and add a smoke test |
| Faako Website | Astro static site with bounded React islands (migrated from React 18/Vite) | Public marketing plus signup/onboarding/configuration | Astro for public routes; bounded React islands/app flow | Complete | Completed | Interactive intake/prototype routes still require careful API and no-index handling | Validate the branch preview, API CORS, analytics consent, and Cloudflare headers before promotion |
| REEBS Portal | React 19/Vite + Express/functions/Prisma | Authenticated operations/admin portal and API | React/Vite + existing API | No framework migration | High cleanup priority | Large surface; tests not on root command; duplicated website code; mixed function/server styles | Add standard quality scripts and establish portal ownership of API/auth/contracts |
| REEBS Website | Astro 7 + React 19 islands (migrated from Vite SPA) | Public rentals, shop, cart, checkout, and bounded customer access | Astro + React commerce islands | Completed; production cutover pending preview parity | High validation priority | Large legacy media; shared compatibility chunk; live API/cookie parity; 1,067 catalogue item routes | Validate Cloudflare preview, forms/payments boundary, API routing, mobile UX, and analytics before promotion |
| Stroane Web | React 19/Vite TypeScript + Express/Prisma; independent storefront/admin browser entries | Public catalogue/customer commerce, private portal, separate API runtime | React/Vite storefront and portal, with separate artifacts; Express API | Public framework decision complete; physical workspace split remains optional | Completed decision, high preview priority | Client-rendered body SEO; one source workspace; live stock/payment launch dependencies | Preview both artifacts against staging API, measure public SEO/performance, and migrate remaining API adapters incrementally |
| System Starter | React 19/Vite | Internal starter/scaffold | React/Vite | No | Low | No lint/test/typecheck scripts; may propagate weak defaults | Add standard quality scripts and keep it aligned with authenticated app conventions |
| UI Workbench | React 19/Vite | Shared component workbench | React/Vite | No | Medium | No automated component/accessibility tests; not Storybook-like isolated docs | Add smoke/accessibility coverage and keep it as the UI verification surface |
| TTNGH | No active source; generated Astro artifacts only | Intended NGO public site | Astro + server-side donation/form APIs | Recreate scaffold | After shared standards | Root script points to missing workspace; artifact-only state; payment/PII/security requirements | Do not build yet; recreate from a proven public-site template after quality/API conventions land |
| REEBS Analytics | FastAPI/Pydantic | Read-only forecasting and operational insights | FastAPI | No | Low | Outside pnpm/Turbo/CI; optional auth if secret absent | Add explicit CI/test/deployment checks and define whether auth must fail closed |

## Applications that should remain React with Vite

- Dev ERP
- Faako ERP
- REEBS Portal
- Stroane Portal
- System Starter
- UI Workbench

Stroane's storefront and portal now have independent compile-time entries and deployable artifacts. The evidence-based ADR retains Vite for the storefront because customer authentication, live catalogue reconciliation, cart, location search, Paystack checkout, and return verification are core responsibilities. Reconsider Astro only after measuring the route-shell SEO result and defining a separate customer/checkout owner.

## Applications that should use Astro

- byNana Portfolio: already Astro; reduce the React footprint over time.
- Faako Website: public routes.
- REEBS Website: public/content/catalogue routes with commerce islands.
- TTNGH: when its scaffold is recreated.
- Stroane Storefront is not an active Astro candidate under the accepted 2026-08-02 ADR; reconsider only with measured evidence and a customer/checkout boundary plan.

## Applications that should use Next.js

None at present. The repository already has separate Express APIs and a Cloudflare/Railway deployment model. Next.js would add operational complexity without addressing the immediate SEO, duplication, contract, or test problems. Revisit this decision only when an application has an explicit same-origin React SSR/server requirement.

## Architecture decision

Adopt a two-frontend-strategy target:

1. Astro for public, content-led, SEO/AEO-sensitive websites.
2. React/Vite for authenticated and operational applications.

Retain dedicated Express and FastAPI services. Treat Next.js as an exception requiring a separate architecture decision record.

## First implementation decision

Before any framework migration, make checks representative:

1. fix the Dev ERP undefined-variable lint failure;
2. add Turbo/root `typecheck`;
3. expose existing app tests through standard `test` scripts;
4. include the Python service in CI;
5. declare environment inputs for cached builds.

This creates a reliable baseline without changing application architecture.
