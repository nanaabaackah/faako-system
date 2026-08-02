# Current system map

Date: 2026-07-25

## System topology

```text
                         pnpm workspace + Turborepo
              apps/* -------------------------------- packages/*
                |                                          |
                |                         config, types, theme, UI, utils,
                |                         security, finance, audit, logger,
                |                         notifications, offline sync, etc.
                |
  +-------------+----------------+----------------+------------------+
  |                              |                |                  |
Public static/SPAs       Authenticated SPAs    Node APIs         Python service
  |                              |                |                  |
Portfolio (Astro)        Dev ERP (Vite)        Dev ERP Express   REEBS Analytics
Faako Website (Astro)    Faako ERP demo        Faako API         FastAPI/Pydantic
REEBS Website (Astro)    REEBS Portal          REEBS API*
Stroane Storefront*      Stroane Portal*       Stroane API*
                         Starter/workbench

* Public UI, private UI, and/or API share an application workspace.
```

## Runtime and ownership map

| Public/browser surface | Backend owner | Data store/integrations | Deployment shape |
| --- | --- | --- | --- |
| Portfolio Astro pages plus React island | Portfolio serverless contact/trust endpoints and Dev ERP trust-stat upstream | Resend; Dev ERP monitoring data; Google Analytics | Cloudflare Pages/static |
| Faako Website | `faako-api` for onboarding/intake; Dev ERP activity webhook | Faako PostgreSQL through Prisma; Resend | Cloudflare Pages frontend; Railway API |
| Faako ERP demo | `faako-api` demo-access endpoint | Client demo data/session | Cloudflare Pages |
| Dev ERP | Dev ERP Express API | Dev ERP PostgreSQL/Prisma; Google, Trello, OpenAI, Paystack, Resend, Twilio, external jobs/weather/currency APIs | Cloudflare Pages frontend; Railway API |
| REEBS Website | REEBS Portal API/functions | REEBS PostgreSQL/Prisma; email, maps, WhatsApp, analytics service | Cloudflare Pages frontend; Railway portal/API |
| REEBS Portal | Co-located Express/functions | REEBS PostgreSQL/Prisma; REEBS Analytics | Cloudflare Pages frontend; Railway API |
| Stroane Storefront | Co-located Stroane Express API | Stroane PostgreSQL/Prisma; Paystack, Resend, Google Places/Maps | Cloudflare Pages frontend; Railway API |
| Stroane Portal | Same Stroane Express API | Same Stroane database | Separate Vite surface selected during build |
| REEBS Analytics | Called by REEBS Portal with a service secret | Receives snapshots; read-only calculations | Docker-capable service |

## Workspace dependency direction

- Applications consume shared package source directly through `workspace:*`.
- `@faako/api-contracts` provides framework-independent response builders,
  normalizers, error codes, pagination, and request metadata to Faako API and
  Faako ERP for the pilot adoption.
- `@faako/api-client` provides framework-independent browser/server transport,
  standard JSON and error handling, AbortSignal and request-ID support, and
  opt-in domain clients. Faako ERP demo access is the first transport pilot.
- `@faako/types` provides framework-independent domain contracts. Stroane's
  customer API boundary is the first application pilot; React-specific
  renderer/table types now remain inside `@faako/ui`.
- `@faako/validation` provides framework-independent Zod request schemas and
  inferred input types. Dev ERP's forgot-password boundary is the first pilot.
- `@faako/ui` depends on `@faako/security`, `@faako/theme`, `@faako/types`, and `@faako/utils`.
- `@faako/theme` and `@faako/config` depend on `@faako/types`.
- Dev ERP consumes the broadest shared set: config, logger, finance, notifications, offline sync, security, UI, utils, and email kit.
- REEBS Portal consumes config, core, finance, notifications, offline sync, security, UI, and utils.
- REEBS Website consumes API client, core, finance, theme, types, UI, utils, and validation packages. Its former portal/backend ownership has been removed; Astro owns public documents and route-level React islands retain commerce interaction.
- Stroane consumes core, notifications, offline sync, security, theme, types, UI, and utils.
- Portfolio, Faako Website, Faako ERP, Starter, and Workbench consume narrower UI/config/utils slices.
- The Python analytics service is isolated from the pnpm graph and communicates over HTTP.

## Frontend routing map

| Frontend | Router | Route ownership |
| --- | --- | --- |
| Portfolio | Astro file routes plus React Router 7 static/browser router | Duplicated between Astro page files and `src/App.jsx` |
| Dev ERP | React Router 7 | Single guarded SPA tree |
| Faako ERP | React Router 6 | Single demo SPA tree |
| Faako Website | React Router 6 | Public, onboarding, configuration, dashboard, and auth-like pages in one tree |
| REEBS Portal | React Router 7 | Protected admin tree |
| REEBS Website | Astro file routes with route-level React Router islands | Public commerce/customer pages; `/login` and `/admin/*` redirect externally |
| Stroane | React Router 7 | Separate storefront and portal trees selected by `VITE_APP_SURFACE` |
| System Starter | React Router 7 | Starter shell |
| UI Workbench | React Router 7 | Workbench shell |

All Vite frontends use Cloudflare SPA fallbacks. Public route HTML is therefore generic until JavaScript runs, except for the Astro portfolio.

## Authentication and trust boundaries

```text
Public/no account
  Portfolio, public Faako pages, public REEBS pages, public Stroane pages

Demo/client-only gate
  Faako ERP demo -> API grant -> browser-persisted demo session

Cookie sessions
  Dev ERP: access + refresh HttpOnly cookies + CSRF token
  REEBS: HttpOnly user cookie; sanitized browser user shell
  Stroane: separate customer and admin HttpOnly cookies

Bearer/shared-secret paths
  Dev ERP bearer compatibility
  REEBS manager tokens and service/webhook secrets
  Stroane bearer compatibility and cron/webhook secrets
  Faako activity/demo secrets
  REEBS Analytics service secret
```

Faako Website's `AuthContext` is presentation state only and should not be treated as an authentication boundary.

## Data and contract map

- Four independent Prisma schemas: Dev ERP, Faako API, REEBS Portal, and Stroane.
- Each schema owns its database lifecycle and migrations.
- Repeated names do not imply shared records; `Organization`, `User`, orders, products, accounting, inventory, and audit concepts differ by product.
- Stable API/event fields now have shared structural contracts in
  `@faako/types`; Prisma models, state machines, and application extensions
  remain locally owned.
- Cross-system integration is HTTP/webhook based, not shared-database based.
- Frontend API contracts are mostly handwritten and app-local.
- Native `fetch` remains the universal HTTP primitive. A shared transport now
  exists, but only Faako ERP demo access has adopted it; no shared query cache
  exists.
- REEBS Website still depends on the Portal API's route/cookie contract for transactional flows, but public document generation and catalogue snapshots no longer depend on Portal source or database ownership.

## Cross-cutting capabilities

| Capability | Current implementation |
| --- | --- |
| UI system | `@faako/ui` and `@faako/theme`, plus substantial app CSS/components |
| Analytics | Shared GA utilities/route tracker; REEBS Python operational analytics |
| Logging | Pino in Dev ERP; console logging elsewhere |
| Error monitoring | No centralized third-party error monitoring |
| Validation | Shared Zod schemas with a Dev ERP pilot; Pydantic in analytics; custom validation remains elsewhere pending compatible adoption |
| State | React context/hooks, storage, IndexedDB/offline queues |
| Testing | Node test, Playwright, some Jest/Testing Library assets, Pytest |
| Hosting | Cloudflare static frontends; Railway/Nixpacks Node APIs; Docker-capable Python service |
| Security headers | App-local Cloudflare `_headers` files and shared security profiles |

## Current high-risk couplings

1. REEBS public and portal source trees overlap heavily.
2. Stroane builds two different products from one environment-selected workspace.
3. Faako Website mixes public marketing and application-like onboarding/configuration.
4. Portfolio route ownership is duplicated between Astro and React Router.
5. Railway service selection defaults to Dev ERP if an explicit selector is missing.
6. Dev ERP and Stroane builds generate Prisma clients outside `dist/**`, so those build tasks cannot yet use safe artifact caching.
7. Existing root checks are not consistently connected to CI.

The former live-API sitemap build and missing Turbo build-environment hashing risks were resolved on 2026-07-26. REEBS sitemap inventory refresh is now an explicit operation outside the ordinary build.
