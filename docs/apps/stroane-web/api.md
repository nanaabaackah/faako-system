# Stroane API Notes

## Current Public/Customer Endpoints

- `GET /health`
- `GET /api/catalogue/categories`
- `GET /api/catalogue/products`
- `GET /api/catalogue/products/:slug`
- `POST /api/inquiries`
- `POST /api/orders`
- `POST /api/orders/:orderId/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook`

Catalogue endpoints prefer persisted database rows when available and fall back to the local JSON seed when the API/database is unavailable or not yet seeded. Category and product responses remain source-coherent: persisted categories are used only when published persisted products also exist. Legacy aliases remain available at `GET /api/categories`, `GET /api/products`, and `GET /api/products/:slug` during the Railway API rollout.

## Current Private Endpoints

- `POST /api/auth/login`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `PATCH /api/admin/orders/:orderId/status`
- `GET /api/admin/suppliers`
- `GET /api/admin/suppliers/:id`
- `POST /api/admin/suppliers`
- `PATCH /api/admin/suppliers/:id`
- `GET /api/admin/inventory`
- `GET /api/admin/inventory/:id`
- `PATCH /api/admin/inventory/:id`
- `GET /api/admin/inventory/movements`
- `POST /api/admin/inventory/movements`
- `PATCH /api/admin/products/:id/inventory`

Private endpoints require backend `SiteUser` bearer auth. `ADMIN` and `VIEWER` can read admin order/inventory data; write/update routes require `ADMIN`. Public customer sign-in/sign-up is not a backend security boundary.

## Railway Deployment Contract

- Health endpoint: `GET /health`, independent of database availability.
- Railway API build command: `pnpm --filter @faako/stroane-web exec prisma generate`
- Railway API pre-deploy migration command: `pnpm --filter @faako/stroane-web run db:deploy:prod`
- Railway API start command: `pnpm --filter @faako/stroane-web start:api`
- Cloudflare Pages public API base: `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`
- Browser CORS origins: `https://stroanesolutions.com`, `https://www.stroanesolutions.com`, approved local development origins, and Cloudflare Pages preview domains ending in `.pages.dev`.

Cloudflare Pages is the frontend host. Railway hosts the API and Postgres database. Netlify configuration is not required.

## Internal Inventory Operations UI

- Frontend route: `/admin/inventory`
- Existing staff sessions from backend `POST /api/auth/login` are reused.
- `ADMIN` can review inventory, suppliers, movement history, and submit audited inventory movements.
- `VIEWER` can review the same operational data without write actions.
- The first dashboard layer records movement entries only for existing inventory items. Initial stock-item setup, supplier creation/editing, and product-supplier linking remain protected API/admin setup tasks until a focused setup editor is approved.
- The public storefront does not read supplier notes, purchase notes, or internal movement history.

## Admin Inventory/Supplier Endpoints

These routes are internal API foundations only. Do not expose supplier notes, costs, or stock adjustments on the public storefront.

### Suppliers

- `GET /api/admin/suppliers?search=&status=&limit=`
  - Returns supplier summaries, contact counts, linked product counts, and inventory item counts.
- `GET /api/admin/suppliers/:id`
  - Returns supplier detail, contacts, and product-supplier links for admin review.
- `POST /api/admin/suppliers`
  - Admin-only. Accepts `name`, optional `slug`, `status`, `email`, `phone`, `website`, `location`, `notes`, and up to 10 contacts.
- `PATCH /api/admin/suppliers/:id`
  - Admin-only. Updates safe supplier fields. If `contacts` is supplied, contacts are replaced as a lightweight foundation until a dedicated contact editor exists.

### Inventory

- `GET /api/admin/inventory?search=&stockStatus=&supplierId=&productSlug=&limit=`
  - Returns inventory items with product/supplier summaries, available quantity, low-stock flag, and reorder flag.
- `GET /api/admin/inventory/:id`
  - Returns one inventory item.
- `PATCH /api/admin/inventory/:id`
  - Admin-only. Updates stock metadata such as `quantityOnHand`, `stockQuantity`, `reservedQuantity`, `lowStockThreshold`, `reorderThreshold`, `stockStatus`, `allowBackorder`, `isPurchasable`, `supplierId`, `sku`, `lastCountedAt`, and `notes`.

### Inventory Movements

- `GET /api/admin/inventory/movements?productSlug=&supplierId=&movementType=&limit=`
  - Returns movement history.
- `POST /api/admin/inventory/movements`
  - Admin-only. Records a movement and updates the linked inventory item.
  - Supported `movementType` values: `RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `MANUAL_CORRECTION`, `RESERVED`, `RELEASED`.
  - Records before/after quantity, before/after reserved quantity, notes, timestamps, and `createdBy` placeholders from the authenticated admin user.

### Product Inventory

- `PATCH /api/admin/products/:id/inventory`
  - Admin-only. Updates storefront-facing `CatalogueProduct` stock fields and syncs/creates an `InventoryItem` unless `syncInventoryItem=false`.
  - `:id` may be a catalogue product id or slug.

## Inventory Rules To Preserve

- Frontend stock is display-only.
- Backend checkout/payment initialization must validate availability server-side.
- Orders should not reserve or deduct stock until a separate order-inventory workflow is designed.
- Low stock is computed from confirmed available quantity and thresholds.
- Unknown stock should remain non-purchasable.
- Supplier cost and restock notes should stay private.
- Inventory admin routes are not a public source of supplier cost, restock notes, or internal adjustment history.

## Rate Limit And Security Expectations

Use route-specific backend protection plus Railway/provider-level request controls for deployed write routes. Inventory/supplier endpoints require backend admin auth and should log safely without exposing supplier cost details or customer data. The current implementation uses the existing in-process API/admin rate limit middleware; Railway/provider controls remain the production rate-limit layer.
