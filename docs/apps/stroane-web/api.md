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
- `POST /api/customer/signup`
- `POST /api/customer/login`
- `POST /api/customer/logout`
- `GET /api/customer/me`
- `PATCH /api/customer/me`
- `GET /api/customer/orders`

Catalogue endpoints prefer persisted database rows when available and fall back to the local JSON seed when the API/database is unavailable or not yet seeded. Category and product responses remain source-coherent: persisted categories are used only when published persisted products also exist. Legacy aliases remain available at `GET /api/categories`, `GET /api/products`, and `GET /api/products/:slug` during the Railway API rollout.

## Current Private Endpoints

- `POST /api/auth/login`
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
- `GET /api/admin/products`
- `GET /api/admin/products/:id`
- `PATCH /api/admin/products/:id`
- `PATCH /api/admin/products/:id/media`
- `PATCH /api/admin/products/:id/publishing`
- `PATCH /api/admin/products/:id/suppliers`
- `GET /api/admin/inventory/alerts`
- `POST /api/admin/inventory/alerts/check`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders`
- `PATCH /api/admin/orders/:id`
- `POST /api/admin/orders/:id/paystack/initialize`
- `POST /api/admin/orders/:id/paystack/verify`
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id`
- `POST /api/admin/customers`
- `PATCH /api/admin/customers/:id`
- `POST /api/admin/customers/:id/invite`

Private endpoints require backend `SiteUser` auth via the HttpOnly staff cookie, with legacy bearer fallback during transition. `ADMIN` and `VIEWER` can read protected product, supplier, inventory, movement, alert, order, and customer directory data where allowed; write/update routes require `ADMIN`. Public customer account endpoints use a separate HttpOnly customer cookie and never grant staff portal access.

## Customer Account Endpoints

Customer account routes are storefront routes, not admin routes. They use a distinct customer auth cookie and customer token audience.

- `POST /api/customer/signup`
  - Creates/activates a customer account from either a valid staff-generated invite token or a Paystack/order reference whose email matches the submitted email.
  - Stores password hashes server-side, clears invite token hashes after activation, links matching orders, and sets the customer HttpOnly cookie.
- `POST /api/customer/login`
  - Signs in an active customer with email/password and sets the customer HttpOnly cookie.
- `POST /api/customer/logout`
  - Clears the customer cookie.
- `GET /api/customer/me`
  - Returns only the authenticated customer's profile.
- `PATCH /api/customer/me`
  - Updates only the authenticated customer's editable profile fields. Email cannot be changed through this route.
- `GET /api/customer/orders`
  - Returns orders linked to the authenticated customer, plus verified matching-email orders that are then linked server-side.

State-changing customer routes require the storefront client header and are rate-limited. Do not add customer data reads that accept arbitrary customer IDs from the browser.

## Inventory Owner Alerts

Inventory-owner notifications are private operational workflows. They never run
from public catalogue requests and never expose configured recipients publicly.

- `GET /api/admin/inventory/alerts`
  - `ADMIN` and `VIEWER` can review active alert counts, alert rows, and safe dispatch history.
- `POST /api/admin/inventory/alerts/check`
  - `ADMIN` only. Runs a manual inventory scan and grouped delivery attempt.
- `POST /api/internal/inventory/alerts/check`
  - Internal scheduler route. Requires `Authorization: Bearer <STROANE_ALERT_CRON_SECRET>`.

Alert scans also run after committed admin inventory movements, direct inventory
updates, and product-inventory updates. A durable cooldown claim prevents
duplicate sends when multiple scans overlap.

Alert types:

- `LOW_STOCK`: available quantity reached either the low-stock threshold or reorder threshold.
- `OUT_OF_STOCK`: available quantity is zero.
- `RESTOCKED`: a previously warned item recovered above its thresholds.

Eligibility rules:

- Product must be published and active.
- Inventory tracking must be enabled.
- Draft, archived, unpublished, and tracking-disabled products do not trigger owner notifications.
- Unknown quantity remains visible for review but does not generate a misleading stock alert.

Email uses the existing backend Resend pattern and groups affected products into
one operational summary. WhatsApp is provider-neutral preparation only: the
backend creates a prepared dispatch record and message format without calling a
WhatsApp Cloud API, Twilio, or another provider.

## Frontend Route Boundaries

- Public storefront routes, including `/catalogue` and `/products/:slug`, render outside the ERP shell.
- Customer account surfaces live at `/account`, `/orders`, `/quotes`, `/signin`, and `/signup`.
- Staff authenticate at `https://portal.stroanesolutions.com/login`.
- Protected operations routes render inside the shared ERP shell under `/admin/*`.
- Active portal modules include `/admin`, `/admin/inventory`, `/admin/orders`, `/admin/crm`, and `/admin/directory`; other placeholder module routes remain compatibility shells.

Frontend route guards are navigation boundaries only. Protected `/api/admin/*` endpoints continue to enforce backend `SiteUser` authorization, and protected `/api/customer/*` endpoints continue to enforce customer-cookie authorization.

## Railway Deployment Contract

- Health endpoint: `GET /health`, independent of database availability.
- Railway workspace env: `RAILWAY_WORKSPACE=@faako/stroane-web`
- Railway API build command: `node ./scripts/railway-service.mjs build`
- Railway API pre-deploy migration command: `pnpm --filter @faako/stroane-web run db:deploy:prod`
- Railway API start command: `node ./scripts/railway-service.mjs start`
- Cloudflare Pages public API base: `VITE_API_BASE_URL=https://api.stroanesolutions.com`
- Browser CORS origins: `https://stroanesolutions.com`, `https://www.stroanesolutions.com`, `https://portal.stroanesolutions.com`, approved local development origins, and Cloudflare Pages preview domains ending in `.pages.dev`.

Cloudflare Pages is the frontend host. Railway hosts the API and Postgres database.

## Internal Dashboard Data Reads

- Frontend route: `/admin`
- Existing staff sessions from backend `POST /api/auth/login` are reused.
- `ADMIN` and `VIEWER` can review dashboard product, supplier, inventory, movement, alert, order, and customer signals.
- Active module routes include inventory, orders, and CRM/directory. Supplier, product, operations, reports, and settings routes remain reset placeholders.
- Initial supplier creation/editing, product-supplier linking, and product editing remain backend foundations until focused module editors are rebuilt. Inventory movement entry is active through `/admin/inventory`.
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
  - Admin-only. Updates stock metadata such as `quantityOnHand`, `stockQuantity`, `reservedQuantity`, `lowStockThreshold`, `reorderThreshold`, `stockStatus`, `inventoryTrackingEnabled`, `allowBackorder`, `isPurchasable`, `supplierId`, `sku`, `lastCountedAt`, and `notes`.

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

## Admin Product Data Foundation

There is no active `/admin/products` editor UI after the portal reset. Product list reads remain wired to the `/admin` dashboard and inventory/product management surfaces so product fetches continue to work. These routes are staff-auth protected and return private operational fields only to staff sessions:

- `GET /api/admin/products?search=&publishingStatus=&categorySlug=&tag=&limit=`
  - Returns product rows, publishing status, stock summary, private preferred-supplier summary, and active category options.
- `GET /api/admin/products/:id`
  - Returns one internal product record for the edit drawer.
- `PATCH /api/admin/products/:id`
  - Admin-only. Updates catalogue copy, slug, SKU, price, compare-at price, currency, category, and tags.
- `PATCH /api/admin/products/:id/media`
  - Admin-only. Updates thumbnail and gallery paths. Paths must resolve below `/imgs/products/`, use a supported image extension, and omit traversal segments, query strings, and fragments.
- `PATCH /api/admin/products/:id/publishing`
  - Admin-only. Updates `draft`, `active`, or `archived` publishing state and featured status. Only `active` products remain public.
- `PATCH /api/admin/products/:id/suppliers`
  - Admin-only. Selects or clears a preferred supplier and stores the supplier product code and private supplier notes.

Product updates append lightweight `InventoryAuditEntry` records. Public catalogue responses deliberately omit supplier references, supplier notes, internal cost fields, catalogue import/review metadata, draft products, and archived products. The server-side JSON-seed fallback passes through the same public mapper.

The checked-in browser fallback remains a deliberately public outage snapshot. It cannot observe a Railway database publishing change while the API is unavailable. If an active fallback product is archived or becomes unsuitable for public display, update the checked-in public catalogue snapshot and redeploy the Cloudflare Pages frontend as part of the publishing operation.

Direct module UI, media upload, external media hosting, product creation, category editing, bulk product editing, automated stock reservation, and order-to-inventory allocation are intentionally deferred.

## Admin Customer CRM Endpoints

Customer directory routes are private CRM workflows and must not expose customer data on the storefront.

- `GET /api/admin/customers?search=&status=&limit=`
  - Returns customer directory rows, account status, linked-order counts, total spend, last order summary, and CRM summary KPIs.
- `GET /api/admin/customers/:id`
  - Returns one customer profile plus recent linked orders for staff review.
- `POST /api/admin/customers`
  - Admin-only. Creates or updates a customer directory record and can generate a one-time account creation invite URL. The raw invite token is returned only in this response; the database stores a token hash.
- `PATCH /api/admin/customers/:id`
  - Admin-only. Updates safe CRM/profile fields and account status.
- `POST /api/admin/customers/:id/invite`
  - Admin-only. Regenerates an invite token, stores only its hash, and returns a new account creation URL for copying/sharing.

Customer CRM rows can link existing orders by normalized email. Account activation remains customer-controlled through `/api/customer/signup` with a matching invite or checkout reference.

## Inventory Rules To Preserve

- Frontend stock is display-only.
- Backend checkout/payment initialization must validate availability server-side.
- Orders should not reserve or deduct stock until a separate order-inventory workflow is designed.
- Low stock is computed from confirmed available quantity and thresholds.
- Unknown stock is allowed for priced products in the current storefront test/purchasing pass. Explicit zero quantity, `out_of_stock`, preorder without backorder, and known insufficient quantity must still block checkout server-side.
- Supplier cost and restock notes should stay private.
- Inventory admin routes are not a public source of supplier cost, restock notes, or internal adjustment history.

## Rate Limit And Security Expectations

Use route-specific backend protection plus Railway/provider-level request controls for deployed write routes. Inventory/supplier endpoints require backend admin auth and should log safely without exposing supplier cost details or customer data. The current implementation uses the existing in-process API/admin rate limit middleware; Railway/provider controls remain the production rate-limit layer.
