# Stroane boundary separation

Date: 2026-08-02

## Implemented boundary

```text
Stroane storefront build
  -> public/customer routes
  -> catalogue, enquiry, cart, checkout
  -> public and customer API endpoints

Shared packages
  -> @faako/types catalogue contracts
  -> @faako/validation inventory adjustment schema
  -> @faako/api-client request IDs and normalized errors
  -> @faako/security module/action identifiers
  -> @faako/ui state and confirmation primitives

Stroane admin build
  -> staff authentication
  -> inventory, orders, accounting, CRM, audit workflows
  -> protected admin API endpoints

Railway API
  -> authentication and authorization source of truth
  -> catalogue, stock, orders, payment and audit persistence
  -> Prisma/PostgreSQL ownership
```

## Code/build changes

- Added independent `src/frontend/main.tsx` and `src/portal/main.tsx` entries.
- `vite.config.ts` resolves exactly one entry when `STROANE_BUILD_SURFACE` is set.
- `build:storefront` emits `dist/storefront` and runs the public metadata/sitemap finalizer.
- `build:admin` emits `dist/admin` and applies private indexing/CSP policy.
- The default `build` creates both artifacts without running Prisma generation.
- `build:api` owns Prisma generation for the API deployment.
- Combined runtime routing remains only for compatible local development.

Output tests prevent the storefront from importing admin inventory code and prevent the admin artifact from importing public enquiry/Paystack browser code.

## Auth boundary

The standalone storefront entry imports only `StorefrontApp` and customer `AuthProvider`. The standalone portal entry imports only `PortalApp` and staff admin providers. The portal service worker is registered only by the portal entry.

The storefront can still redirect `/login` and `/admin/*` to the portal origin, but it does not own staff sessions or admin mutation logic.

## Data boundary

- PostgreSQL/API data remains authoritative.
- `stroaneCatalogue.json` is a public outage/build metadata snapshot only.
- Shared catalogue base contracts live in `@faako/types`.
- Stroane-only variants, media, descriptions, and presentation helpers remain in Stroane.
- The inventory API pilot now uses `@faako/api-client`; other API modules remain compatible and are future incremental migrations.

## Protected inventory boundary

- Backend permission middleware remains the source of truth.
- Negative stock, negative reserved stock, and reservations greater than on-hand stock are rejected by the API.
- Inventory movements and inventory audit entries are committed together in database transactions.
- The admin shows stock movement history and audit-log views.
- Archive/delete-listing actions require confirmation.

## Deliberate non-changes

- No authentication provider changed.
- No database schema or existing permission identifier changed.
- No payment secret moved to a browser build.
- No public fallback became a write source.
- The package was not split into separate workspace directories; this avoids a high-risk move while the new entry/output boundary is proven.
