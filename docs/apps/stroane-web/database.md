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

Product operations publishing fields added on 2026-05-30:

- `CatalogueProduct.compareAtPrice`
- `CatalogueProduct.publishingStatus`
- `CatalogueProduct.isFeatured`

Migration: `20260530000000_add_catalogue_product_publishing_fields`

This migration is additive. Existing catalogue rows remain `active` by default so a production deploy does not unexpectedly hide the storefront catalogue. Admins can then move products to `draft` or `archived` intentionally. Public catalogue queries require both `isPublished=true` and `publishingStatus=active`.

Inventory owner alert fields added on 2026-05-31:

- `InventoryItem.inventoryTrackingEnabled`
- `InventoryAlert`
- `InventoryAlertDispatch`

Migration: `20260531000000_add_inventory_alert_foundation`

This migration is additive. Existing inventory items default to tracking enabled.
`InventoryAlert` stores durable low-stock, out-of-stock, and recovery state with
cooldown timestamps. `InventoryAlertDispatch` stores safe channel audit rows
without persisting recipient addresses or WhatsApp numbers. Draft, archived,
unpublished, and explicitly tracking-disabled products are excluded from scans.

## Admin Inventory API Mapping

The protected admin inventory API now uses the existing inventory/supplier foundation without adding a new migration:

- `Supplier` stores supplier profile details and private admin notes.
- `SupplierContact` stores supplier-side contacts. The first admin API foundation can replace a supplier contact list during supplier updates; a dedicated contact editor can later make this granular.
- `CatalogueProductSupplier` links products to suppliers and keeps supplier SKU, cost, lead time, minimum order quantity, preferred-supplier flag, and private supplier notes admin-only.
- `InventoryItem` stores operational stock metadata per product/variant, including `quantityOnHand`, `reservedQuantity`, `availableQuantity`, `reorderThreshold`, `lowStockThreshold`, `stockStatus`, `allowBackorder`, and `isPurchasable`.
- `InventoryItem.inventoryTrackingEnabled` allows staff to explicitly exclude a product from operational alert checks.
- `InventoryAlert` stores active and resolved owner-alert state plus cooldown timestamps.
- `InventoryAlertDispatch` stores safe per-channel attempt history for email delivery and provider-neutral WhatsApp preparation.
- `InventoryMovement` stores stock movement history for `RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `MANUAL_CORRECTION`, `RESERVED`, and `RELEASED`.
- `InventoryAuditEntry` stores lightweight audit trail records for supplier changes, inventory item updates, product inventory updates, and movement entries.
- Product/media operations also append `InventoryAuditEntry` records for copy, media, publishing, and preferred-supplier edits.

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

For an existing deployment, use the reviewed non-destructive reconciliation
workflow. The planning commands are read-only. Reconciliation archives stale
public rows and deactivates stale categories; it does not delete them. Inventory
bootstrap creates only missing base inventory records and never overwrites
existing counts:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:plan
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:reconcile
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory:apply
```

New inventory rows keep unknown quantities as `null`, remain non-purchasable,
and include an `INVENTORY_ITEM_BOOTSTRAPPED` audit entry. Staff must record a
physical count or restock movement before enabling online purchasing.

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
- Run `20260530000000_add_catalogue_product_publishing_fields` before deploying the product operations API and `/admin/products` UI.
- Run `20260531000000_add_inventory_alert_foundation` before enabling inventory alert scans or the owner-alert summary in `/admin/inventory`.
- Direct file upload and external media-provider metadata remain deferred. Current product media fields store validated local `/imgs/products/` paths.
