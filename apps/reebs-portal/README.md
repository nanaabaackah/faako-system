# Reebs Portal

Workspace package: `@faako/reebs-portal`

Reebs Portal is the admin portal and Netlify Functions backend for the Reebs product. It owns the operational frontend, Prisma-backed backend functions, admin accounting workflows, bookings, content, and internal product modules used by the Reebs stack.

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

Full local Reebs stack from the repo root:

```bash
pnpm run dev:reebs
```

Default local ports:

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
pnpm --filter @faako/reebs-portal run test:e2e
```

## Inventory Products And Variants

Inventory products are stored in the legacy `sourceCategory` table, scoped per organization for compatibility with existing data. Inventory categories are stored in the legacy `specificCategory` table and linked to those products. The database also exposes read aliases `inventoryProduct` and `inventoryCategory`, and the API returns `inventoryProduct*` plus `category` aliases for the current product/category wording. Admin users can create products and categories from the stock form combobox or from bulk reassignment, and duplicate names are rejected case-insensitively within the same organization.

Numbered balloon stock uses a parent `product` row with `itemType = VARIANT_PARENT` and child rows in `inventoryVariant`. Each variant tracks `stockQty`, `reservedQty`, `reorderLevel`, optional `priceOverride`, and dimensions such as `variantNumber`, `color`, and `size`. Available stock is calculated as `max(stockQty - reservedQty, 0)`. Orders and bookings can reference `variantId`; standard inventory items continue to use the original product stock flow.

To generate number balloon variants, open the item in Admin > Inventory, set the item type to `Variant parent`, then use the variants section to generate digits `0-9` with optional comma-separated colors and sizes. The order builder can expand a typed number like `18` into variant `1` and variant `8`.

Existing Toys-linked items are relinked only through an explicit mapping script. Review first:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:dry
```

After confirming the exact matched item names, apply:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:apply
```

The script creates `Household` and `Supplies` first, moves only explicitly mapped product names currently under Toys, and logs the moved count per target category. Anything not mapped stays under Toys for admin review and can be bulk-moved from the stock module.

## Relationship To Reebs Website

- `apps/reebs-website` is the public customer-facing site
- `apps/reebs-portal` owns the backend and admin experience
- local full-stack Reebs work normally runs both together through `pnpm run dev:reebs`

## Deployment

This app has its own Netlify config in `apps/reebs-portal/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/reebs-portal build
```

Functions are served from `apps/reebs-portal/netlify/functions`, and selective deploys use:

```bash
node ./scripts/netlify-ignore.mjs @faako/reebs-portal
```

## More Detail

- `apps/reebs-portal/docs/FRONTEND.md`
- `apps/reebs-portal/docs/BACKEND.md`
