# REEBS Portal architecture foundation

Status: implemented foundation; incremental domain migration continues.

## Architecture discovered

REEBS Portal is a React/Vite application with React Router, a co-located Express/functions backend, Prisma/PostgreSQL persistence, and shared Faako packages. Before this foundation pass, `src/App.jsx` owned providers, shell behavior, route guards, lazy imports, route declarations, analytics and global chrome. Frontend pages and backend functions remain largely feature-complete but vary in size and local conventions. Operational import, backfill, seed and maintenance files also lived at the application root.

REEBS Website is an Astro public site with route-level React islands for interactive commerce and customer flows. It remains a separate deployable surface and must not acquire portal authentication, database or admin ownership.

## Implemented target structure

```text
src/App.jsx                    composition entry only
src/app/AppProviders.jsx       router and application providers
src/app/AppRouter.jsx          route rendering and access guards
src/app/routeConfig.js         route metadata and lazy page ownership
src/app/AppShell.jsx           public/admin chrome and global behavior
src/modules/<domain>/index.js  frontend domain entry points
backend/modules/<domain>/      backend domain entry points/registry
scripts/imports/               operational imports
scripts/backfills/             data corrections and backfills
scripts/seeds/                 deterministic seed operations
scripts/maintenance/           explicit operator maintenance
```

Frontend and backend module entry points now exist for dashboard, bookings, rentals, orders, customers, inventory, delivery, invoicing, accounting, expenses, HR, maintenance, marketing, documents, audit, analytics, Water and settings. Vendors and authentication keep explicit supporting boundaries. The entry points prove dependency direction without rewriting large pages or backend handlers.

Only the low-risk audit backend adapter was moved behind a representative domain module. Existing routes, endpoint response shapes, authentication, permissions, organisation scoping and page behavior remain unchanged.

## Dependency rules

- `App.jsx` composes the application; it does not own route or domain behavior.
- Route configuration may import domain entry points; domains must not import the route tree.
- Frontend domain entry points may temporarily re-export legacy pages during migration.
- Backend domain entry points may temporarily re-export existing handlers; authoritative permission and tenant checks remain in backend handlers.
- Shared framework-neutral code stays in existing packages rather than new REEBS-specific packages.
- Water follows the standalone rules in `docs/architecture/reebs-water-domain.md`.

## Deferred refactors

- Split the largest page components into domain-local views, hooks and API adapters one workflow at a time.
- Move additional backend handlers behind domain entry points only with focused permission, tenant and contract tests.
- Continue shared API-client and validation adoption using compatibility adapters.
- Do not combine finance, analytics or reporting queries until Water exclusion behavior is explicit and tested.
- Keep authentication/session replacement, database redesign and framework changes outside this incremental programme.

## Operational scripts

Package commands retain their existing names while targets now live under `scripts/imports`, `scripts/backfills`, `scripts/seeds` and `scripts/maintenance`. Moving a script does not authorize running it; database-affecting operations remain environment-scoped and operator-controlled.
