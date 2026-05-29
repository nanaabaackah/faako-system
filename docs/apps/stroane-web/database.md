# Stroane Database Notes

## Provider

Use Railway Postgres for production. Keep application databases off frontend hosts and out of browser-visible environment variables.

## Current Prisma Foundations

Existing foundations:

- `CatalogueCategory`
- `CatalogueProduct`
- `CatalogueInquiry`
- `BusinessProfileContent`
- `CommerceOrder`
- `CommerceOrderItem`
- `SiteUser`

Inventory/supplier foundation added on 2026-05-29:

- `Supplier`
- `SupplierContact`
- `CatalogueProductSupplier`
- `InventoryItem`
- `InventoryMovement`
- `InventoryAuditEntry`

The 2026-05-29 migration is additive. It adds nullable stock planning columns to `CatalogueProduct` and creates new supplier/inventory tables. It does not alter order totals, payment verification, checkout behavior, or existing product fields.

## Migration Commands

Check the target before running:

```bash
pnpm --filter @faako/stroane-web run db:status:prod
```

Deploy production migrations:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:deploy:prod
```

Generate Prisma client:

```bash
pnpm --filter @faako/stroane-web run db:generate
```

Seed catalogue data only after confirming the database target:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue
```

## Safety Notes

- Use nullable inventory fields for existing catalogue rows until real counts are entered.
- Keep `isPurchasable=false` when stock is unknown.
- Do not deduct inventory from orders until reservation/deduction rules are implemented and tested.
- Keep supplier cost notes and purchase/restock notes admin-only.
- Add dedicated API permission checks before building supplier or inventory admin screens.
