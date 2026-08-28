# Final system map

## Application and service decisions

| Surface | Actual framework/runtime | Purpose | Deployment boundary | Decision |
| --- | --- | --- | --- | --- |
| byNana Portfolio | Astro + selective React islands | Public portfolio/content/contact | Static public deployment | Astro approved and implemented |
| Faako Website | Astro + React islands | Public product/marketing/setup forms | Static public deployment | Astro approved and implemented |
| Dev ERP | React/Vite + Express/Prisma | Authenticated operational ERP and monitoring | Static frontend + API/database | Remain React/Vite |
| Faako ERP | React/Vite | Fixture/demo operational surface | Static preview/internal | Remain React/Vite; authority deferred |
| Faako API | Express/Prisma | Faako signup/onboarding/API | Railway service/database | Backend service |
| REEBS Website | Astro + React islands | Public catalogue, cart, checkout and content | Static public deployment calling approved APIs | Astro approved and implemented |
| REEBS Portal | React/Vite + Express/Prisma/serverless handlers | Authenticated operations/POS/inventory/orders/water | Static portal + API/database | Remain React/Vite |
| Stroane storefront | React/Vite | Public catalogue/services/enquiry/checkout | Independent static storefront graph | Vite retained by ADR |
| Stroane admin/API | React/Vite + Express/Prisma | Authenticated products/inventory/customers/orders | Independent admin graph + API/database | Remain React/Vite |
| Faako Analytics (compatibility path: REEBS Analytics) | FastAPI/Python | Shared private, read-only, tenant-scoped advanced analytics | Private container service | Shared platform service; physical rename deferred |
| TTNGH | No tracked implementation | Planned NGO public site/donations/events | None | Deliberately deferred; Astro remains the expected content-first choice subject to scaffold approval |
| System Starter | React/Vite | Internal scaffold/reference | No default production deployment | Retain as tooling |
| UI Workbench | React/Vite | Shared UI/theme/layout/notification development | No default production deployment | Retain as tooling |

## Runtime relationships

```text
Public Astro/Vite sites
  -> approved public API/catalogue/form boundaries

Operational React/Vite apps
  -> @faako/api-client + compatible adapters
  -> Express/Prisma authoritative services
  -> PostgreSQL per deployment/tenant rules

Approved application backends
  -> authenticated, permission-checked, minimised tenant snapshot
  -> Faako Analytics (scoped service principal + stable contracts)
  -> quality-aware analytical result

Current: REEBS dashboard consumer
Prepared: Dev ERP operational-health producer/consumer boundary

All JavaScript surfaces
  -> shared contracts/types/validation/security/logger/design foundations
  -> Turbo/pnpm workspace quality gates
```

## Shared boundaries

- `packages/types`: framework-independent domain and analytical contracts.
- `packages/validation`: Zod boundary schemas and inferred inputs.
- `packages/api-contracts`: response/error/request-ID model.
- `packages/api-client`: browser/server-safe request behaviour and compatibility adapters.
- `packages/security`: framework-independent roles/permissions and helpers; backend enforcement remains authoritative.
- `packages/logger` and `packages/audit`: redacted diagnostics and distinct audit-event conventions.
- `packages/ui`, `theme`, `layout`, `notifications`: global foundations with brand-specific tokens; not complete page ownership.

No Next.js or replacement authentication provider was introduced.

Advanced analytics is a shared capability, not an application-owned Python layer.
Simple totals/charts stay in SQL, application code or BI where those are clearer.
The shared architecture, metric catalogue and data-quality rules govern new analyses.
