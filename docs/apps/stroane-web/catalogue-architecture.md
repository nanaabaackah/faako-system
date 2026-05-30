# Stroane Catalogue Architecture

## Purpose

Stroane catalogue data should remain product-focused and scalable without becoming a full ERP. The browser-safe outage snapshot is `apps/stroane-web/src/data/stroaneCatalogue.json`, with storefront normalization in `apps/stroane-web/src/data/products.ts`. The server-side import source is `apps/stroane-web/prisma/data/stroaneCatalogueSeed.json`; it may retain manual-review metadata that must not enter the Cloudflare Pages bundle.

## Product Vs Variant Rules

- Standalone products are items customers would compare or buy separately, such as infrared thermometers, fridge thermometers, humidity thermometers, and digital probe thermometers.
- Variants are colour/style choices under one product, such as Chef Waterproof Apron black and wine variants.
- Variant parents use `productType: "variant_parent"` and store variant-level SKU, price placeholder, stock placeholder, image, and options.
- Variants should not be split into separate products unless they are operationally different products with different use cases.

## Category Hierarchy

The normalized seed supports parent groups and leaf categories:

- Temperature & Food Safety
- Digital Probe Thermometers
- Meat Thermometers
- Fridge Thermometers
- Freezer Thermometers
- Infrared Thermometers
- Humidity Thermometers
- Kitchen Apparel
- Aprons
- Food Safety Posters & Signage

Parent groups use `isGroup: true`. Storefront filters should use leaf categories only.

## Media Structure

Products and variants should use a normalized media object:

```json
{
  "url": "/imgs/products/thermometers/example.jpg",
  "alt": "Customer-safe product image alt text",
  "type": "primary",
  "sortOrder": 1,
  "publicId": "stroane/products/thermometers/example"
}
```

Supported media types are `primary`, `gallery`, `variant`, `lifestyle`, `detail`, and `packaging`.

Cloudinary-ready values can later map to:

- `secure_url`
- `public_id`
- `alt`
- `sortOrder`
- `type`
- `variantId`

Current local asset folders:

- `apps/stroane-web/public/imgs/products/thermometers/`
- `apps/stroane-web/public/imgs/products/aprons/`

## Specification Structure

Specifications are stored as structured entries:

```json
{
  "label": "Temperature Range",
  "value": "-50 C to 300 C",
  "group": "Temperature"
}
```

Use consistent labels so future filters can be added without scraping display text.

## Inventory Foundation

Catalogue products and variants may include:

- `sku`
- `stockQuantity`
- `availableQuantity`
- `reservedQuantity`
- `stockStatus`
- `lowStockThreshold`
- `reorderThreshold`
- `allowBackorder`
- `isPurchasable`
- `supplier`
- `costPrice`
- `sellingPrice`

Unknown inventory must not be treated as sellable. New PDF/image-imported products default to `stockQuantity: null`, `stockStatus: "unavailable"`, and `isPurchasable: false` until Stroane enters real stock counts and approved pricing.

The operational inventory foundation adds dedicated tables for suppliers, supplier contacts, product-supplier links, inventory items, stock movement entries, adjustment/restock notes, and inventory audit entries. These tables are additive and are not yet wired to checkout deduction or reservation behavior.

## Backend Compatibility

The current database schema stores product-level catalogue rows and supplier/inventory planning records, but does not yet persist category hierarchy metadata, variant rows, or media rows as dedicated tables. The backend catalogue adapter merges local seed metadata into DB-backed product/category responses so current storefront images, variants, and category grouping remain visible after seeding.

Do not expand into ERP-grade inventory automation until a separate stock/admin workflow is approved. Order-to-inventory reservation, deduction, supplier purchase workflows, and stock reconciliation screens remain future work.

## Manual Review Required

Before enabling online purchase for the normalized products, Stroane must confirm:

- real selling prices
- real stock quantities
- variant-level stock for aprons
- supplier/cost details if needed
- exact product model/version names
- final image approvals
