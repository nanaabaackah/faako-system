# Target system map

Date: 2026-07-25
Status: proposed direction; no migration is authorized by this document

## Target principles

1. Use Astro for content-led, public, SEO/AEO-sensitive surfaces.
2. Keep authenticated, highly interactive business applications on React/Vite.
3. Keep APIs as independently deployable services with explicit contracts.
4. Introduce Next.js only when a product demonstrably needs same-origin React SSR/server features that Astro islands plus an API cannot provide.
5. Preserve database ownership; do not merge Prisma schemas because models share names.
6. Make quality gates and API contracts reliable before framework migration.
7. Separate public, private, and server trust boundaries even when they remain in one repository.

## Proposed topology

```text
                              Faako monorepo
                                    |
           +------------------------+-------------------------+
           |                        |                         |
      Public web layer       Application web layer        Service layer
          Astro                 React + Vite             Existing runtimes
           |                        |                         |
  Portfolio (simpler islands)   Dev ERP                    Dev ERP API
  Faako public website          Faako ERP demo             Faako API
  REEBS public website          REEBS Portal               REEBS API
  TTNGH future site             Stroane Portal             Stroane API
  Stroane public candidate*     Starter/workbench          REEBS Analytics

  * Only after storefront/portal build and contract ownership are separated.
```

## Target application decisions

### Astro public sites

- Portfolio remains Astro. Over time, replace the site-wide React Router island with page-level Astro ownership and small interactive islands.
- Faako Website moves public marketing, pricing, case studies, legal content, and contact content to Astro. Signup/onboarding/configuration should remain bounded React islands or a separately deployed React application until its product boundary is clear.
- REEBS Website moves public content, rentals/catalogue discovery, policies, and metadata generation to Astro. Cart, account, checkout, maps, and live inventory remain React islands backed by explicit APIs.
- TTNGH should be recreated as an Astro workspace after public-site standards are established. Donation/payment handling remains server-side through Railway/API endpoints; secrets never enter the static build.
- Stroane storefront is an Astro candidate, not an immediate migration. First separate portal/storefront builds and lock down commerce API contracts.

### React/Vite applications

- Dev ERP remains React/Vite plus Express/Prisma.
- Faako ERP remains React/Vite as a demonstration application.
- REEBS Portal remains React/Vite plus its API.
- Stroane Portal remains React/Vite.
- System Starter and UI Workbench remain React/Vite.

### Next.js

No current application should migrate to Next.js now. Next.js should be reconsidered only if a future surface requires several of the following together:

- authenticated same-origin SSR;
- server components tied to React-specific rendering;
- server actions replacing an existing API boundary;
- per-request personalization that cannot be safely expressed as Astro islands;
- a hosting/runtime decision that supports the required Node/edge behavior without duplicating Railway APIs.

Adopting Next.js solely for SEO would add a third frontend architecture without solving current contract, duplication, or quality-gate problems.

## Target package boundaries

| Boundary | Target ownership |
| --- | --- |
| `@faako/types` | Framework-neutral UI/system primitives only; React-dependent types moved to UI packages or declared correctly |
| API contracts | Small domain-owned packages per stable API boundary; request/response/error types and optional validation |
| `@faako/ui` | Application UI primitives and authenticated ERP shell; avoid forcing the whole ERP CSS surface into public Astro pages |
| Public web UI | A lightweight accessible public-site component/tokens package, separated from ERP shell dependencies |
| REEBS shared code | Only genuinely shared public/portal utilities and contracts; no copied source trees |
| Validation | Server-authoritative schemas with derived/shared client-safe contracts where appropriate |
| Logging | Shared structured server logger with request IDs/redaction; browser error adapter |
| Analytics | Consent-aware provider adapter and route/page tracking appropriate to Astro and SPA navigation |

## Target request flow

```text
Astro/React page
      |
      v
domain API client ----> versioned/validated API endpoint
      |                         |
typed result/error              v
      |                  service-owned database
      v
island/context state
```

- Browser clients use a common transport foundation for credentials, CSRF, timeouts, aborts, JSON parsing, and normalized errors.
- Domain clients remain app-owned so unrelated products do not share unstable types.
- Cookie and CSRF behavior remains enforced by each backend.
- Public content builds do not depend on a live operational API; dynamic sitemaps use deterministic exported data or a reliable post-deploy generation strategy.

## Target delivery and quality gates

1. Every active workspace exposes applicable `lint`, `typecheck`, `test`, and `build` scripts.
2. Turbo defines `typecheck`, meaningful inputs/outputs, and environment dependencies.
3. Python service checks run in CI even though the service remains outside pnpm.
4. Public sites have generated-HTML tests for canonical URLs, metadata, structured data, robots, sitemaps, accessibility, broken links, and performance budgets.
5. Authenticated apps have route/auth/API integration tests and critical Playwright journeys.
6. CI change detection covers all applications and shared packages, not only Stroane.
7. Deployments require explicit service selection; no production default points at an arbitrary app.
8. Error monitoring and structured logs provide a pre/post-migration comparison baseline.

## Migration sequence

```text
Quality gates
    -> environment/build determinism
        -> API contracts
            -> duplicate-code ownership
                -> public regression baselines
                    -> Faako Astro
                        -> REEBS Astro
                            -> Stroane boundary decision
                                -> TTNGH scaffold
```

This sequence intentionally keeps database, authentication, and payment behavior stable while rendering layers change.

## Success criteria

- Public routes return meaningful HTML without JavaScript.
- Authenticated workflows retain current cookie, CSRF, role, and organization protections.
- No framework migration changes database ownership.
- Root checks cover every active workspace and service.
- Public builds are deterministic without a live API.
- Shared packages reduce verified duplication without creating a universal domain model.
- Cloudflare serves static/public frontends and Railway serves explicit API workloads.
- Framework count remains justified: Astro for public content, React/Vite for application shells, existing Node/Python services for APIs.
