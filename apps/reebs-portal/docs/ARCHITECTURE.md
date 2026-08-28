# REEBS Architecture Foundation

## Scope and application boundaries

REEBS has two deployable frontend applications that share the REEBS API but serve different purposes:

- `apps/reebs-website` is the content-first public Astro site. Astro pages and layouts own routing and document delivery; React is used for interactive islands such as cart, checkout, booking, login, and catalogue interactions.
- `apps/reebs-portal` is the React/Vite operational application. It owns authenticated staff workflows and hosts the Express compatibility adapter for the REEBS API handlers.

This foundation preserves those approved framework boundaries. It does not move public pages back into the portal or convert the portal to Astro.

## Architecture discovered

Before this foundation pass, `src/App.jsx` owned provider composition, all lazy page imports, every route and access guard, the public/admin/store-mode shells, scroll restoration, admin preference synchronization, analytics tracking, update notices, and document titles. Pages were grouped by UI history under `src/pages`, while backend handlers were discovered from a flat `backend/functions` directory. Import and backfill utilities existed both at the portal root and under partially structured folders.

The API adapter in `backend/server.js` discovers flat `backend/functions/*.js` filenames at startup. Those filenames are public compatibility contracts because they map directly to `/api/:functionName`.

## Current foundation

```text
src/
  app/
    AppProviders.jsx   provider composition
    AppRouter.jsx      auth/access guards and route rendering
    routeConfig.js     URL, domain, access, and lazy component metadata
    AppShell.jsx       public, portal, and store-mode chrome/effects
  modules/
    <domain>/index.js  domain entry points over existing pages
  pages/               existing page implementations (gradual migration source)

backend/
  functions/           stable API compatibility entry points and shared adapters
  modules/
    <domain>/          domain ownership and incrementally migrated implementations

scripts/
  imports/
  backfills/
  seeds/
  maintenance/
```

`src/App.jsx` is now only the application composition root. Provider order and router behavior remain unchanged. `routeConfig.js` is the single route inventory and records a domain for every route.

The frontend domain entry points are: dashboard, bookings, rentals, orders, customers, inventory, delivery, invoicing, accounting, expenses, HR, maintenance, marketing, documents, audit, analytics, water, settings, plus supporting auth and vendor boundaries.

The backend registry establishes the same requested ownership boundaries. `auditLogs` is the representative low-risk migration: its implementation is in `backend/modules/audit/auditLogs.js`, while `backend/functions/auditLogs.js` re-exports the handler so its URL and adapter discovery remain unchanged.

## Target architecture

Future work should migrate one coherent capability at a time:

1. Move page-specific components, hooks, queries, and tests behind the relevant `src/modules/<domain>` entry point.
2. Keep cross-domain primitives in existing shared packages or genuinely shared portal folders; do not make one domain import another domain's internals.
3. Move backend implementations into `backend/modules/<domain>` behind stable `backend/functions` adapters until the API router has an approved versioned replacement.
4. Give each backend domain its own service/query/validation layers only when its complexity warrants them. Avoid empty abstraction layers.
5. Add contract and authorization tests before migrating high-risk auth, payment, accounting, inventory mutation, or tenant-scoping code.
6. Keep Water storage, services, permissions, reporting, and metrics explicitly separate as defined in `WATER_ARCHITECTURE.md`.

## Dependency rules

- `src/app` may compose any frontend domain; a domain must not import from `src/app`.
- Domain public entry points may temporarily reference existing `src/pages` implementations. New domain code belongs inside the domain folder.
- `backend/functions` is an inbound compatibility layer. Migrated implementations flow from compatibility entry point to `backend/modules`, never the reverse.
- Backend modules may use `backend/functions/_shared` during migration, but broadly reusable utilities should eventually move to a neutral backend shared boundary.
- Tenant and permission checks remain authoritative in backend handlers/services. Route guards are user experience controls only.
- Analytics must use shared metric contracts and must exclude Water unless a caller explicitly requests a separately labelled Water view.

## Deferred refactors

- Existing pages have not been bulk moved or rewritten.
- The flat API discovery contract has not been replaced.
- Most backend handler implementations remain in `backend/functions`.
- Auth/session, payment, accounting mutation, inventory mutation, and booking/order workflows remain in place pending focused migrations and tests.
- Shared components and utilities have not been reclassified solely for folder symmetry.
