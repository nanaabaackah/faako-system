# Stroane API Notes

## Current Public/Customer Endpoints

- `GET /health`
- `GET /api/catalogue/categories`
- `GET /api/catalogue/products`
- `GET /api/catalogue/products/:slug`
- `GET /api/location/search`
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

## Location Search Endpoint

Delivery checkout uses `GET /api/location/search?q=<query>&limit=6` to search selectable addresses through the backend. The browser sends only the customer's typed query to the Stroane API; provider endpoint configuration, user-agent headers, and any future provider keys stay server-side. Results are provider-neutral location objects with `placeId`, `label`, `address`, optional coordinates, and an optional `mapUrl`.

The route is rate-limited separately from checkout writes. If the location provider is disabled or unavailable, the backend returns a safe failure payload instead of exposing provider errors. The storefront requires delivery customers to select one of the returned GPS/search results before creating a delivery order, and the public checkout backend rejects delivery orders that do not include a selected location result.

## Current Private Endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `GET /api/auth/users`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:id`
- `GET /api/auth/roles`
- `POST /api/auth/roles`
- `PATCH /api/auth/roles/:id`
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
- `POST /api/admin/products`
- `PATCH /api/admin/products/bulk`
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
- `GET /api/admin/accounting/overview`
- `POST /api/admin/accounting/entries`
- `GET /api/admin/accounting/expenses`
- `POST /api/admin/accounting/expenses`

Private endpoints require backend `SiteUser` auth via the HttpOnly staff cookie, with legacy bearer fallback during transition. `ADMIN` and `OWNER` are elevated across portal modules. `VIEWER` has read access to operational modules, and `CUSTOM` roles must carry the matching module/action permission from their active custom role. Product, supplier, inventory, movement, and inventory-alert reads require `inventory.view`; their write/update routes require the relevant `inventory.create` or `inventory.edit` permission. Public customer account endpoints use a separate HttpOnly customer cookie and never grant staff portal access.

## Staff Auth And Profile Endpoints

- `POST /api/auth/login`
  - Signs in an active `SiteUser`, sets the HttpOnly staff cookie, and returns non-secret profile metadata.
- `POST /api/auth/logout`
  - Clears the staff cookie.
- `GET /api/auth/me`
  - Returns the authenticated staff user's profile, role label, and resolved portal permissions.
- `PATCH /api/auth/me`
  - Updates only the authenticated staff user's own profile fields and appearance preference. It also accepts an optional `newPassword`, hashes it server-side into `SiteUser.passwordHash`, and never returns password material in the response. This lets users created with temporary/invited passwords change their own password from `/admin/profile`.

## Staff Team And Role Endpoints

Team management endpoints are limited to `ADMIN` and `OWNER`. `VIEWER` and `CUSTOM` users cannot create users, assign roles, list role definitions, create custom roles, or edit custom roles through these routes.

- `GET /api/auth/users`
  - Lists portal users with role metadata for `/admin/team`.
- `POST /api/auth/users`
  - Creates a portal user with a temporary password and a system or active custom role.
- `PATCH /api/auth/users/:id`
  - Updates another user's active status or assigned role. Users cannot modify their own account through this route.
- `GET /api/auth/roles`
  - Returns immutable system role definitions plus saved custom roles.
- `POST /api/auth/roles`
  - Creates an active custom role. Custom role permissions are sanitized so they cannot grant team management access.
- `PATCH /api/auth/roles/:id`
  - Edits a custom role's name, description, permissions, or active status. System roles cannot be edited, and custom role permissions are sanitized so they cannot grant team management access.

## Accounting And Expense Endpoints

Accounting endpoints are private staff routes. Reads require `accounting.view`; manual ledger and expense creation require `accounting.create`. `ADMIN` and `OWNER` are elevated.

- `GET /api/admin/accounting/overview`
  - Returns revenue, receivables, stock value, paid expenses, unpaid expense liabilities, net profit, net position, category movement, monthly movement, and ledger transactions for the requested period.
- `POST /api/admin/accounting/entries`
  - Creates a manual historical ledger entry such as income, expense, asset, liability, equity, or adjustment.
- `GET /api/admin/accounting/expenses`
  - Lists paid expense and unpaid expense-liability entries, with summary totals and class breakdowns for the Expenses module.
- `POST /api/admin/accounting/expenses`
  - Records a paid expense as an `EXPENSE` ledger entry or an unpaid obligation as a `LIABILITY` ledger entry. Expense metadata includes class, category, payee/supplier, payment state, due date, reference, and notes.

## Customer Account Endpoints

Customer account routes are storefront routes, not admin routes. They use a distinct customer auth cookie and customer token audience.
Customer email is the account identifier. The backend normalizes submitted email addresses to lowercase and uses case-insensitive lookup so one email cannot create multiple customer accounts.

- `POST /api/customer/signup`
  - Creates/activates a customer account with email/password profile details. Optional staff invite tokens and checkout/order references link existing CRM/order context when present.
  - Enforces the strong password policy server-side, stores password hashes server-side, clears invite/reset token hashes after activation, links matching orders, and sets the customer HttpOnly cookie.
- `POST /api/customer/login`
  - Signs in an active customer with email/password and sets the customer HttpOnly cookie.
- `POST /api/customer/password/forgot`
  - Accepts an email address and returns a generic response. If an active account exists, generates a fresh reset token, replaces any previous reset-token hash, stores a one-hour expiry, and emails the new reset link.
- `POST /api/customer/password/reset`
  - Accepts a reset token and new password, verifies the stored token hash/expiry, rejects expired or replaced links, enforces the strong password policy, hashes the new password server-side, clears reset token fields, and sets the customer HttpOnly cookie.
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
  - Requires `inventory.view`. Returns active alert counts, alert rows, and safe dispatch history.
- `POST /api/admin/inventory/alerts/check`
  - Requires `inventory.edit`. Runs a manual inventory scan and grouped delivery attempt.
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
- Browser CORS origins: exact origins configured through `CORS_ORIGINS`; development also has known localhost defaults. Cloudflare Pages previews are disabled by default and only an exact configured owned preview origin is accepted.

Cloudflare Pages is the frontend host. Railway hosts the API and Postgres database.

## Internal Dashboard Data Reads

- Frontend route: `/admin`
- Existing staff sessions from backend `POST /api/auth/login` are reused.
- The dashboard only calls module APIs the current session can view. Inventory/product/supplier/movement/alert requests require `inventory.view`; order requests require `orders.view`.
- Active module routes include inventory, orders, and CRM/directory. Supplier, product, operations, reports, and settings routes remain reset placeholders.
- Initial supplier creation/editing and product-supplier linking remain backend foundations until focused module editors are rebuilt. Inventory product creation, product editing, product publishing, bulk product actions, and movement entry are active through `/admin/inventory`.
- The public storefront does not read supplier notes, purchase notes, or internal movement history.

## Admin Inventory/Supplier Endpoints

These routes are internal API foundations only. Do not expose supplier notes, costs, or stock adjustments on the public storefront.

### Suppliers

- `GET /api/admin/suppliers?search=&status=&limit=`
  - Requires `inventory.view`. Returns supplier summaries, contact counts, linked product counts, and inventory item counts.
- `GET /api/admin/suppliers/:id`
  - Requires `inventory.view`. Returns supplier detail, contacts, and product-supplier links for admin review.
- `POST /api/admin/suppliers`
  - Requires `inventory.create`. Accepts `name`, optional `slug`, `status`, `email`, `phone`, `website`, `location`, `notes`, and up to 10 contacts.
- `PATCH /api/admin/suppliers/:id`
  - Requires `inventory.edit`. Updates safe supplier fields. If `contacts` is supplied, contacts are replaced as a lightweight foundation until a dedicated contact editor exists.

### Inventory

- `GET /api/admin/inventory?search=&stockStatus=&supplierId=&productSlug=&limit=`
  - Requires `inventory.view`. Returns inventory items with product/supplier summaries, available quantity, low-stock flag, and reorder flag.
- `GET /api/admin/inventory/:id`
  - Requires `inventory.view`. Returns one inventory item.
- `PATCH /api/admin/inventory/:id`
  - Requires `inventory.edit`. Updates stock metadata such as `quantityOnHand`, `stockQuantity`, `reservedQuantity`, `lowStockThreshold`, `reorderThreshold`, `stockStatus`, `inventoryTrackingEnabled`, `allowBackorder`, `isPurchasable`, `supplierId`, `sku`, `lastCountedAt`, and `notes`.

### Inventory Movements

- `GET /api/admin/inventory/movements?productSlug=&supplierId=&movementType=&limit=`
  - Requires `inventory.view`. Returns movement history.
- `POST /api/admin/inventory/movements`
  - Requires `inventory.edit`. Records a movement and updates the linked inventory item.
  - Supported `movementType` values: `RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `MANUAL_CORRECTION`, `RESERVED`, `RELEASED`.
  - Records before/after quantity, before/after reserved quantity, notes, timestamps, and `createdBy` placeholders from the authenticated admin user.

### Product Inventory

- `PATCH /api/admin/products/:id/inventory`
  - Requires `inventory.edit`. Updates storefront-facing `CatalogueProduct` stock fields and syncs/creates an `InventoryItem` unless `syncInventoryItem=false`.
  - `:id` may be a catalogue product id or slug.

## Admin Product Data Foundation

There is no standalone `/admin/products` editor UI after the portal reset. Product list reads and product write actions remain wired to the `/admin/inventory` product management surface so staff can manage catalogue rows without code/seed edits. These routes are staff-auth protected and return private operational fields only to staff sessions:

- `GET /api/admin/products?search=&publishingStatus=&categorySlug=&tag=&limit=`
  - Requires `inventory.view`. Returns product rows, publishing status, stock summary, private preferred-supplier summary, and active category options.
- `GET /api/admin/products/:id`
  - Requires `inventory.view`. Returns one internal product record for the edit drawer.
- `POST /api/admin/products`
  - Requires `inventory.create`. Creates a catalogue product and a linked base inventory row in one transaction. Accepts catalogue fields such as name, SKU, price, currency, category, publishing status, featured flag, short description, plus initial stock fields such as quantity on hand, reserved quantity, thresholds, stock status, supplier, purchasable/backorder flags, tracking flag, and notes.
- `PATCH /api/admin/products/bulk`
  - Requires `inventory.edit`. Applies safe bulk publishing actions to up to 100 selected products. Supported actions are archive, delete/delete listing, restore/activate, and draft. Delete listing is implemented as archive/unpublish rather than hard-delete so order, inventory, audit, and historical links remain intact.
- `PATCH /api/admin/products/:id`
  - Requires `inventory.edit`. Updates catalogue copy, slug, SKU, price, compare-at price, currency, category, and tags.
- `PATCH /api/admin/products/:id/media`
  - Requires `inventory.edit`. Updates thumbnail and gallery paths. Paths must resolve below `/imgs/products/`, use a supported image extension, and omit traversal segments, query strings, and fragments.
- `PATCH /api/admin/products/:id/publishing`
  - Requires `inventory.edit`. Updates `draft`, `active`, or `archived` publishing state and featured status. Only `active` products remain public.
- `PATCH /api/admin/products/:id/suppliers`
  - Requires `inventory.edit`. Selects or clears a preferred supplier and stores the supplier product code and private supplier notes.

Product creation, product updates, product publishing, and bulk product publishing actions append lightweight `InventoryAuditEntry` records. Public catalogue responses deliberately omit supplier references, supplier notes, internal cost fields, catalogue import/review metadata, draft products, and archived products. The server-side JSON-seed fallback passes through the same public mapper.

The checked-in browser fallback remains a deliberately public outage snapshot. It cannot observe a Railway database publishing change while the API is unavailable. If an active fallback product is archived or becomes unsuitable for public display, update the checked-in public catalogue snapshot and redeploy the Cloudflare Pages frontend as part of the publishing operation.

Media upload, external media hosting, category editing, automated stock reservation, hard product deletion, and order-to-inventory allocation are intentionally deferred.

## Admin Customer CRM Endpoints

Customer directory routes are private CRM workflows and must not expose customer data on the storefront.

- `GET /api/admin/customers?search=&status=&limit=`
  - Requires `crm.view`. Returns customer directory rows, account status, linked-order counts, total spend, last order summary, and CRM summary KPIs.
- `GET /api/admin/customers/:id`
  - Requires `crm.view`. Returns one customer profile plus recent linked orders for staff review.
- `POST /api/admin/customers`
  - Requires `crm.create`. Creates or updates a customer directory record and can generate a one-time account creation invite URL. The raw invite token is returned only in this response; the database stores a token hash.
- `PATCH /api/admin/customers/:id`
  - Requires `crm.edit`. Updates safe CRM/profile fields and account status.
- `POST /api/admin/customers/:id/invite`
  - Requires `crm.edit`. Regenerates an invite token, stores only its hash, and returns a new account creation URL for copying/sharing.

Customer CRM rows can link existing orders by normalized email. Account activation remains customer-controlled through `/api/customer/signup`; invite and checkout references are optional linking context rather than mandatory creation gates.

## Inventory Rules To Preserve

- Frontend stock is display-only.
- Backend checkout/payment initialization must validate availability server-side.
- Orders should not reserve or deduct stock until a separate order-inventory workflow is designed.
- Delivery orders may include a selected `deliveryLocation` object from `/api/location/search`. The backend normalizes and stores place ID, display label, provider, coordinates, and map URL when present; delivery method remains the order type, while fulfillment status remains the internal progress field.
- Low stock is computed from confirmed available quantity and thresholds.
- Unknown stock is allowed for priced products in the current storefront test/purchasing pass. Explicit zero quantity, `out_of_stock`, preorder without backorder, and known insufficient quantity must still block checkout server-side.
- Supplier cost and restock notes should stay private.
- Inventory admin routes are not a public source of supplier cost, restock notes, or internal adjustment history.

## Rate Limit And Security Expectations

Use method-aware global backend protection plus route-specific limits for deployed write routes. Global read/write buckets protect the API baseline; staff login, customer signup/login/password, general staff/customer session routes, admin routes, inquiry, checkout, Paystack initialize, Paystack verify, Paystack webhook, and inventory alert routes use separate buckets so normal portal read chatter does not exhaust auth/payment limits. The admin limiter is mounted once before the admin router stack so one protected request does not consume a hit for each unmatched admin router. Inventory/supplier endpoints require backend admin auth and should log safely without exposing supplier cost details or customer data. The current implementation uses in-process rate limit middleware; Railway/provider controls remain the production rate-limit layer.
