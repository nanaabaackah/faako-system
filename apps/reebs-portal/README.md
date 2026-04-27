# Reebs Portal

Workspace package: `@faako/reebs-portal`

Reebs Portal is the admin portal and Netlify Functions backend for REEBS. It owns the operational frontend, Prisma-backed backend functions, product and variant management, bookings, invoicing, delivery, accounting, website content, and the internal modules used by the REEBS stack.

## What Lives Here

- `src/`: React admin portal frontend
- `netlify/functions/`: backend functions
- `prisma/`: Prisma schema, migrations, and generated client output
- `docs/`: deeper frontend and backend notes
- `netlify.toml`: local and hosted Netlify configuration
- `.env.example`: runtime configuration reference

## Run It Locally

Frontend only:

```bash
pnpm --filter @faako/reebs-portal run dev:frontend
```

Backend/functions only:

```bash
pnpm --filter @faako/reebs-portal run dev:backend
```

Full local REEBS stack from the repo root:

```bash
pnpm run dev:reebs
```

Typical local ports:

- portal frontend: `5174`
- functions/backend: `8888`

## Common Commands

```bash
pnpm --filter @faako/reebs-portal run build
pnpm --filter @faako/reebs-portal run netlify
pnpm --filter @faako/reebs-portal run db:generate
pnpm --filter @faako/reebs-portal run db:migrate:dev
pnpm --filter @faako/reebs-portal run db:deploy:dev
pnpm --filter @faako/reebs-portal run db:status:dev
pnpm --filter @faako/reebs-portal run source-categories:seed
pnpm --filter @faako/reebs-portal run source-categories:relink:dry
pnpm --filter @faako/reebs-portal run source-categories:relink:apply
pnpm --filter @faako/reebs-portal run test:e2e
```

## Current Shared Shell

- the portal follows the current shared shell system used across the repo
- sidebar width, collapse behavior, edge toggle placement, shared modal spacing, and mobile-safe bottom-nav padding should stay aligned with the other ERP apps
- shared form styling should be preferred over browser-native control chrome

## Current Access Model

Role assignment currently uses these primary roles:

- `Owner`
- `Admin`
- `Manager`
- `Staff`
- `Warehouse`
- `Driver`
- `Water`

Current route and navigation behavior:

- `Owner`, `Admin`, and `Manager` can access the standard portal modules plus the privileged admin modules
- `Owner` and `Admin` also keep the inventory product and template admin routes
- `Staff` and `Warehouse` stay in the standard operations modules
- `Driver` is intentionally narrow and should only see the dashboard, bookings, delivery, and customer-directory related flows
- `Water` keeps dashboard/profile access plus the water module
- legacy `viewer`, `custodian`, and `sales` values are normalized to `staff`

Current module groups:

- standard operations: Store Mode, Inventory, Purchases, Offline, Orders, New Order, CRM, Users, Employees, Directory, Maintenance, Timesheets, Rentals
- privileged admin: Bookings, Schedule, Accounting, Expenses, Vendors, Delivery, Documents, Settings, HR, Roles, Invoicing, Marketing, Advanced, Website Template
- owner/admin inventory admin: Inventory Products, Inventory Templates
- water access: Water

## Products And Variants

- inventory still maps through the legacy `sourceCategory` and `specificCategory` tables for compatibility with existing REEBS data
- variant parents use `itemType = VARIANT_PARENT`, with child rows stored in `inventoryVariant`
- orders, bookings, scheduling, and invoicing should preserve `variantId` and `variantLabel` instead of collapsing everything to the parent product
- the product modal only shows the variant creation section when the item type is a variant parent

To relink Toys-era source categories safely, review first:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:dry
```

Then apply only after confirming the matches:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:apply
```

## Auth And Security

- failed login attempts are lockout-protected
- manager login uses additional rate limiting
- backend functions log through `@faako/logger`
- keep secrets out of any `VITE_*` values

## Relationship To Reebs Website

- `apps/reebs-website` is the public customer-facing site
- `apps/reebs-portal` owns the admin experience and backend
- full local REEBS development normally runs both together through `pnpm run dev:reebs`

## Deployment

This app has its own Netlify config in `apps/reebs-portal/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/reebs-portal run build
```

Functions are served from `apps/reebs-portal/netlify/functions`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/reebs-portal
```

## More Detail

- [docs/FRONTEND.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/docs/FRONTEND.md)
- [docs/BACKEND.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/docs/BACKEND.md)
