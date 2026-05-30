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

## Admin Inventory API Mapping

The protected admin inventory API now uses the existing inventory/supplier foundation without adding a new migration:

- `Supplier` stores supplier profile details and private admin notes.
- `SupplierContact` stores supplier-side contacts. The first admin API foundation can replace a supplier contact list during supplier updates; a dedicated contact editor can later make this granular.
- `CatalogueProductSupplier` links products to suppliers and keeps supplier SKU, cost, lead time, minimum order quantity, preferred-supplier flag, and private supplier notes admin-only.
- `InventoryItem` stores operational stock metadata per product/variant, including `quantityOnHand`, `reservedQuantity`, `availableQuantity`, `reorderThreshold`, `lowStockThreshold`, `stockStatus`, `allowBackorder`, and `isPurchasable`.
- `InventoryMovement` stores stock movement history for `RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `MANUAL_CORRECTION`, `RESERVED`, and `RELEASED`.
- `InventoryAuditEntry` stores lightweight audit trail records for supplier changes, inventory item updates, product inventory updates, and movement entries.

The API computes available stock as `quantityOnHand - reservedQuantity`, clamps customer-facing availability at zero, and syncs storefront `CatalogueProduct` stock fields when an admin updates a product/inventory item or records a movement. It does not reserve or deduct stock from orders yet.

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

Private `SiteUser` seeding is environment-specific:

```bash
# Development only: loads .env.development
pnpm --filter @faako/stroane-web run db:seed

# Production only: run intentionally after verifying the target database
pnpm --filter @faako/stroane-web run db:seed:prod
```

Both commands read the private CSV import file, hash passwords before writing,
and should be followed by removal of the plaintext CSV from local disk.

## Safety Notes

- Use nullable inventory fields for existing catalogue rows until real counts are entered.
- Keep `isPurchasable=false` when stock is unknown.
- Do not deduct inventory from orders until reservation/deduction rules are implemented and tested.
- Keep supplier cost notes and purchase/restock notes admin-only.
- Supplier/inventory admin API routes require backend `SiteUser` bearer auth. Reads allow `ADMIN` and `VIEWER`; writes require `ADMIN`.
- No destructive schema change is required for the protected admin API foundation.
