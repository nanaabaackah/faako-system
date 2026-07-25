# Stroane Web

Workspace package: `@faako/stroane-web`

Stroane Web is a full-stack commerce app. It pairs a React 19 + TypeScript frontend with an Express backend and a Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## What Lives Here

- `src/`: React browser source split into `frontend/` for the public storefront, `portal/` for private operations, and shared browser components/data/API helpers
- `backend/`: Express API server, route handlers, and middleware
- `prisma/`: Prisma schema and migrations
- `vite.config.ts`: Vite dev server and build config
- `.env.example`: environment variable reference

## Catalogue And Inquiry Foundation

The public browser fallback lives in `src/data/stroaneCatalogue.json`, with typed storefront helpers in `src/data/products.ts`. Seed-only import notes and manual-review metadata live separately in `prisma/data/stroaneCatalogueSeed.json` so operational review details are not bundled into the Cloudflare Pages frontend. Both datasets are normalized around categories, products, brands, SKUs, descriptions, features, pricing, availability placeholders, inquiry CTAs, tags, and use cases.

The catalogue now separates customer-filterable leaf categories from parent category groups. Thermometers are standalone products; apron styles are variant-parent products with colour/style variants. See `docs/apps/stroane-web/catalogue-architecture.md` for the current product-vs-variant rules.

Product imagery lives in `public/imgs/products/` and should be referenced from `src/data/stroaneCatalogue.json`, not hardcoded in page components. Current asset folders are:

- `public/imgs/products/thermometers/`
- `public/imgs/products/aprons/`

Current product image fields are:

- `thumbnailUrl`: catalogue card/list thumbnail
- `imageUrl`: primary product image
- `galleryImages`: product detail gallery images
- `media`: normalized media entries with `url`, `alt`, `type`, `sortOrder`, optional `publicId`, optional `secureUrl`, and optional `variantId`
- `imageAlt`: customer-facing alt text

Use lower-case slug filenames and WebP where possible, for example `/imgs/products/astro-ai-ir-thermometer.webp`. Transparent catalogue cutouts should use the `-transparent.webp` suffix and remain mapped in `src/data/stroaneCatalogue.json`. Keep `/imgs/products/product-placeholder.webp` as the fallback for products that need manual image review.

To regenerate transparent product cutouts from the current catalogue references:

```bash
pnpm --filter @faako/stroane-web assets:cutout
```

The cutout script removes connected near-white image backgrounds, writes optimized transparent WebP files, and updates catalogue image references. Keep original source images in place for manual review and rollback.

Product variants can define their own SKU, price placeholder, stock placeholder, image, media, and option labels. The current storefront can preview/switch variant imagery, but variant-level checkout remains disabled until a separate safe variant checkout/admin stock workflow is approved.

Specifications should use structured entries such as `{ "label": "Temperature Range", "value": "-50 C to 300 C", "group": "Temperature" }` so future filtering/search can remain data-driven.

Storefront availability is also data-driven. Catalogue products support:

- `stockQuantity`: confirmed sellable quantity, or `null` when unknown
- `availableQuantity`: optional confirmed available-to-sell quantity after reservations
- `reservedQuantity`: optional quantity held for pending/manual orders
- `stockStatus`: `in_stock`, `low_stock`, `out_of_stock`, `preorder`, or `unavailable`
- `lowStockThreshold`: threshold for “Few left” display
- `reorderThreshold`: supplier/restock planning threshold
- `allowBackorder`: whether preorder/backorder is allowed
- `isPurchasable`: whether the storefront may add the item to cart/checkout

Current storefront purchase visibility is price-led: products with a numeric price are shown in the storefront commerce grid and can be added to cart unless an explicit blocker exists. Explicit zero available quantity, `out_of_stock`, or preorder without backorder support blocks purchase. Unknown quantities do not block add-to-cart by themselves during the current price-fill and inventory-backfill pass, but staff should still enter real counts and thresholds before broad public promotion.

The current backend foundation exposes:

- `GET /api/catalogue/categories`
- `GET /api/catalogue/products`
- `GET /api/catalogue/products/:slug`
- `POST /api/inquiries`

Catalogue read endpoints prefer persisted `CatalogueCategory` and `CatalogueProduct` rows when the database has been migrated and seeded. If the database is unavailable, empty, or not yet migrated, the endpoints fall back to `src/data/stroaneCatalogue.json` so the public catalogue can keep rendering safely. Legacy aliases remain available at `/api/categories`, `/api/products`, and `/api/products/:slug` during the Railway API rollout.

Production catalogue reconciliation is explicit and non-destructive. Review the
plan, archive stale public rows without deleting them, then bootstrap missing
inventory records:

```bash
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:plan
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue:reconcile
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory
APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory:apply
```

The inventory bootstrap never overwrites existing rows and does not invent stock
counts. Newly bootstrapped products stay visible in the operations portal with
unknown quantities until staff records a physical count or restock movement.

`POST /api/inquiries` validates basic contact details and persists a minimal `CatalogueInquiry` record when the database migration has been deployed. It does not send email, create orders, take payments, update inventory, or run CRM automation. If storage is unavailable, the endpoint returns a safe error so the frontend can fall back to direct email.

Frontend catalogue pages use the centralized catalogue helpers. `/shop`, `/products`, and product detail routes attempt the API first and fall back to local seed data if the backend is unavailable. The catalogue page includes category browsing, search, sort, local fallback notices, and mobile-friendly product cards. Product pages include product-specific inquiry forms; priced products keep cart quantity controls, while custom-order/price-unavailable products avoid checkout quantity controls.

The frontend normalizes backend responses against local catalogue image metadata for known products. This keeps mapped product images visible even if a backend seed is older than the latest image extraction pass.

The public contact page also submits through the same validated inquiry endpoint when available, with a direct email fallback if the backend is unavailable. Both product and contact inquiry forms keep payloads minimal, include a simple honeypot field, and do not send automated email/SMS/WhatsApp messages yet.

## Commerce And Checkout Foundation

Stroane now has a lightweight commerce foundation, not a full ERP or Shopify-style platform.

- Cart state persists product IDs and quantities only in browser `localStorage`.
- The header/mobile navigation shows a cart count and links to `/checkout`.
- Checkout collects customer contact details plus a delivery or pickup choice, then asks the customer to review before submitting.
- Delivery checkout uses a searchable/selectable address field backed by the server-side location provider. Set `GOOGLE_MAPS_API_KEY` on the API service to use Google Places Autocomplete for suggestions and Place Details for the selected address; without a key, local/dev search falls back to Nominatim. Pickup checkout captures one of the configured pickup spots plus pickup date and time.
- `POST /api/orders` creates a `PAYMENT_PENDING` order request when the commerce migration has been deployed.
- The backend recalculates product prices from catalogue data; frontend totals are display-only.
- Custom-order and price-unavailable products are hidden from the commerce grid and should use the product inquiry flow. Explicit out-of-stock, zero-available, and preorder-without-backorder products remain blocked from checkout. Unknown stock quantities are allowed for priced products in this interim storefront pass so Paystack/cart testing can continue while physical counts are entered.
- Product cards/details show availability before purchase. Inquiry/notify CTAs are fallback paths for out-of-stock, enquiry-only, price-unavailable, or custom-order products.

The commerce order foundation is additive and uses Prisma/Postgres models for `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`. It does not deduct inventory, manage warehouses, create fulfillment tasks, or run CRM automation. Automated customer messaging is currently limited to verified payment-confirmed email when the backend email provider is configured.

The checkout backend validates server-side price, currency, explicit stock blockers, preorder policy, fulfillment details, and quantity before order preparation and payment initialization. Fulfillment method is stored on `CommerceOrder.deliveryMethod`; pickup/delivery timing is stored on `CommerceOrder.expectedDeliveryDate`. The inventory foundation now has additive supplier, inventory item, stock movement, adjustment/restock note, and audit-entry tables. This is still not a full warehouse system: automatic stock deduction and stock reservation are future work.

Paystack is the first payment provider for checkout. The checkout flow creates a pending order, asks the backend to initialize a Paystack transaction, redirects the customer to Paystack, then returns to `/checkout/return` where the frontend asks the backend for a customer-facing status check. The signed Paystack webhook is the trusted source for marking an order paid.

Current payment boundaries:

- `POST /api/orders/:orderId/paystack/initialize` uses the server-side Paystack secret to initialize payment for a validated order.
- `POST /api/paystack/verify` verifies a Paystack reference server-side for the return-page status check. Successful browser-return verification does not finalize paid status until webhook confirmation exists.
- `POST /api/paystack/webhook` verifies `x-paystack-signature`, validates charge events, calls Paystack transaction verification server-side, checks the verified reference/amount/currency against the stored order, and marks an order `PAID` only when those checks pass.
- Amount and currency are checked from the Paystack-verified transaction against the server-side order total.
- Card/MoMo sensitive details are not stored.
- Webhook processing is implemented as the payment confirmation source; callback polling is customer messaging only.
- Optional Dev ERP activity forwarding is backend-only. Set `DEV_ERP_ACTIVITY_WEBHOOK_URL` to Dev ERP's `/api/webhooks/app-activity` endpoint and `DEV_ERP_ACTIVITY_WEBHOOK_SECRET` to the matching Dev ERP `APP_ACTIVITY_WEBHOOK_SECRET` to emit minimal order-created, payment-initialized, and Paystack-webhook activity events. These events omit customer contact details, raw Paystack payloads, card/MoMo data, and provider secrets.

After a successful verified payment, the backend can send a customer-safe payment-confirmed order email through Resend when email env values are configured. The email includes order number, items summary, total, payment status, and customer contact details only. It does not include internal notes, audit metadata, raw database IDs, secrets, Paystack authorization payloads, or card/MoMo details.

Order notification boundaries:

- Email sending is currently limited to payment-confirmed checkout orders after signed Paystack webhook confirmation.
- WhatsApp and SMS formatters exist as helpers only; no WhatsApp Business API or SMS provider is connected.
- Order received, processing, completed, payment pending, and payment failed templates exist for future workflows but are not automated yet.
- Duplicate sends are reduced with `customerNotificationSentAt`, but a full payment event and notification log/audit table is still needed before webhook replay tooling, retries, or multi-channel automation.

## Public Site, Customer Area, And Operations Portal

Stroane now keeps its browser surfaces intentionally separate:

- Public storefront: `https://stroanesolutions.com` serves `/`, `/catalogue`, `/shop`, `/products`, `/products/:slug`, and informational pages with the public website layout.
- Future customer account area: `/account`, `/orders`, and `/quotes` are safe placeholders. They do not render the operations shell and do not expose backend order data yet.
- Internal operations portal: `https://portal.stroanesolutions.com` serves `/login` and protected `/admin/*` routes inside the shared `@faako/ui` ERP shell after private staff authentication. Active modules are dashboard, inventory, orders, and profile. Suppliers, products, operations, reports, and settings remain placeholders until rebuilt.

Public sign-in actions and the legacy storefront `/signin` route redirect to `https://portal.stroanesolutions.com/login`. `/signup` remains a public placeholder that stores only temporary name/email profile metadata in `sessionStorage`. Staff login uses backend `SiteUser` auth with an HttpOnly admin cookie. The old portal `/admin/signin` path redirects to `/login` for bookmark compatibility.

Cloudflare Pages should build two surfaces from this workspace:

- storefront: `VITE_APP_SURFACE=storefront`
- portal: `VITE_APP_SURFACE=portal`

Storefront browsers do not fetch the lazy portal modules. Localhost keeps a combined compatibility mode when `VITE_APP_SURFACE` is blank so local development and Playwright can cover both surfaces.

The staging pair follows the same split:

- storefront: `https://stage.stroanesolutions.com` with `VITE_API_BASE_URL=https://api-staging.stroanesolutions.com`
- portal: `https://portal-stage.stroanesolutions.com` with `VITE_API_BASE_URL=https://api-staging.stroanesolutions.com`

Both storefront and portal shells mount `AppUpdateNotice` from `@faako/ui`. It is enabled in production and can be tested locally with `VITE_ENABLE_APP_UPDATE_NOTICE=true`; it polls the root app shell for changed same-origin build assets, prompts users to refresh when a newer deployed bundle exists, and never auto-reloads an active cart, checkout form, inquiry, or portal edit.

The private order module at `/admin/orders` lists storefront/manual orders, creates manual orders from active priced products, edits fulfillment metadata, initializes Paystack links, and refreshes Paystack status. This module is protected by backend `SiteUser` auth; order writes and Paystack actions require admin access.

## Internal Product And Media Operations

Authenticated staff can see product, inventory, supplier, alert, and order signals on the `/admin` dashboard. Dashboard KPI cards open focused drilldown modals. The dedicated `/admin/inventory` module has stock value analytics, full-width table pagination, product management lightbox, movement recording, and autosave. The dedicated `/admin/orders` module handles current order operations. `/admin/accounting` combines revenue, receivables, stock value, paid expenses, unpaid expense liabilities, and exports; `/admin/expenses` records paid and unpaid expenses by class, payee, date, and due date. `/admin/audit-logs` is an Admin-only read-only audit console over existing inventory, order, payment, receipt, accounting, CRM, and team activity sources. `/admin/products` and `/admin/suppliers` remain placeholders while their module shape is rebuilt.

Public catalogue APIs still return active published products. Product media currently accepts validated local `/imgs/products/` paths only; direct uploads and external media-provider wiring are intentionally deferred.

The checked-in browser fallback is a public outage snapshot, not a live publishing source. If an existing fallback product is archived or should no longer appear publicly, update the snapshot and redeploy Cloudflare Pages as part of that publishing change.

Deploy the additive publishing migration before enabling this workflow:

```bash
pnpm --filter @faako/stroane-web run db:deploy:prod
```

## Security And Production Readiness

Stroane reuses the shared `@faako/security` API header baseline through `backend/security.js`. The backend also disables `x-powered-by`, uses CORS allowlists, requires explicit trusted proxy hops, limits JSON bodies, and keeps a default write-deny middleware for unknown API write routes.

Route-specific rate limits are layered on top of the global API limiter for:

- global API reads and writes
- staff login, plus normal staff session/profile/team routes
- customer signup/login/password routes, plus normal customer session/profile/order routes
- inquiry/contact submissions
- checkout order creation
- protected admin routes
- Paystack payment initialization
- Paystack return-page verification
- Paystack webhooks

The global limiter is method-aware so normal portal read chatter does not exhaust the same bucket as writes. Login, customer auth, checkout, payment, webhook, and admin routes keep separate buckets. These rate limits are in-memory and per Node process. Railway is the chosen production rate-limit layer for deployed checkout/inquiry/payment protection, so configure Railway/provider request controls before high-volume production checkout.

Checkout/payment integrity rules:

- Frontend prices, totals, stock state, and cart state are display/convenience only.
- The backend validates catalogue price, currency, explicit stock blockers, preorder policy, and quantity at order creation and again before Paystack initialization.
- Paystack metadata sent to the provider is minimized to order number/source. Internal raw order IDs and customer phone are not sent as Paystack custom metadata.
- Browser callback verification is not final payment truth; the signed webhook path marks orders paid only after server-side Paystack transaction verification confirms the reference, amount, and currency.
- Railway-level rate limiting, Railway Postgres least-privilege access, payment event logging, and notification log idempotency are still required before fulfillment automation or broader order operations.

Customer account placeholders remain frontend-only and must not protect admin, order, payment, stock, customer-data, or inquiry-management workflows. They do not store passwords or browser-side account records. Private staff usernames go through the dedicated backend-backed `https://portal.stroanesolutions.com/login` entrypoint; staff accounts still live in the database and are not read from CSV at runtime.

Detailed app security posture and remaining production gaps are tracked in `docs/apps/stroane-web/security-notes.md`.

Start with Paystack test keys in development/staging. Expected server-side env vars are:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_CURRENCY`
- `PAYSTACK_ALLOW_LIVE`
- `RESEND_API_KEY`
- `ORDER_NOTIFICATION_FROM`
- `ORDER_NOTIFICATION_REPLY_TO`
- `CUSTOMER_ACCOUNT_EMAIL_FROM`
- `CUSTOMER_ACCOUNT_EMAIL_REPLY_TO`

Keep Paystack and email-provider secrets server-side only. Paystack webhook signatures use the backend Paystack signing secret; if `PAYSTACK_WEBHOOK_SECRET` is blank, the backend falls back to `PAYSTACK_SECRET_KEY`. The backend blocks `sk_live_*` keys unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set. A payment event/notification log should be added before relying on webhook replay handling for automated fulfillment, retries, staff alerts, WhatsApp, or SMS updates.

The database foundation is additive and uses Prisma/Postgres models for `CatalogueCategory`, `CatalogueProduct`, `CatalogueInquiry`, `BusinessProfileContent`, `Supplier`, `SupplierContact`, `CatalogueProductSupplier`, `InventoryItem`, `InventoryMovement`, and `InventoryAuditEntry`. Existing environment variables still apply:

- `VITE_API_BASE_URL`: primary frontend API base URL when the backend is hosted separately
- `VITE_BACKEND_BASE_URL`: legacy frontend API base URL fallback for older deployments
- `CORS_ORIGINS`: exact allowed browser origins for the backend; hosted environments must configure every owned origin explicitly, and Cloudflare Pages previews are not trusted by suffix
- `APP_AUTH_SECRET`: backend-only token signing secret for private `SiteUser` admin/viewer auth
- `DATABASE_URL`: Railway Postgres default database URL
- `DATABASE_URL_DEVELOPMENT`: optional development database URL
- `DATABASE_URL_PRODUCTION`: optional production database URL
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_CURRENCY`, `PAYSTACK_ALLOW_LIVE`: server-side Paystack setup values. `PAYSTACK_SECRET_KEY` must never be exposed through `VITE_*`.
- `RESEND_API_KEY`, `ORDER_NOTIFICATION_FROM`, `ORDER_NOTIFICATION_REPLY_TO`, `CUSTOMER_ACCOUNT_EMAIL_FROM`, `CUSTOMER_ACCOUNT_EMAIL_REPLY_TO`: server-side customer order and account email setup values. `RESEND_API_KEY` must never be exposed through `VITE_*`.

Catalogue import is prepared through:

```bash
pnpm --filter @faako/stroane-web run db:deploy:prod
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue
```

Run migrations and the catalogue seed only after the target database has been verified. The catalogue seed upserts catalogue categories/products/business-profile content from the server-side `prisma/data/stroaneCatalogueSeed.json`; it does not touch payments, orders, supplier records, inventory movements, CRM records, or notifications. The catalogue stock metadata, supplier/inventory foundation, commerce, payment metadata, notification metadata, webhook metadata, and admin fulfillment metadata migrations are additive and must be deployed before storefront stock gating, inventory admin/API work, `/api/orders`, Paystack confirmation, customer email metadata, and `/admin/orders` fulfillment notes can persist correctly.

Manual review still needed:

- Full PDF text extraction/OCR for catalogue copy beyond the visual product-image extraction
- Apron variants, sizes, images, and pricing
- Real stock counts, low-stock thresholds, and backorder decisions for each priced product before broad public online checkout promotion
- Final product photography to replace any catalogue-derived crops where better assets are supplied
- Whether inquiries should also send staff email notifications or route into a future lightweight admin view

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start both frontend and backend together:

```bash
pnpm --filter @faako/stroane-web run dev:with-backend
```

This dev command now runs `predeploy:local` first, which generates the Prisma
client, applies pending development migrations with `prisma migrate deploy`, and
checks the development migration status before the frontend/API processes start.
The root shortcut `pnpm run dev:stroane` uses the same guarded startup path.

Or run each side separately:

```bash
pnpm --filter @faako/stroane-web run dev:frontend
pnpm --filter @faako/stroane-web run server:dev
```

Use `dev:frontend` only when you intentionally want to skip the database/API
predeploy step for a frontend-only styling pass.

Typical local ports:

- frontend: `5175`
- backend: `3000`

## Database

Recommended provider: Railway Postgres. Cloudflare Pages hosts the frontend, Railway hosts the API/backend and database, and Cloudflare manages DNS/domain routing. Keep any registrar/email provider separate from application hosting and database responsibilities. Use separate Railway Postgres credentials/roles for migrations and runtime if available, and keep database URLs out of browser-visible env values.

```bash
pnpm --filter @faako/stroane-web run db:migrate:dev
pnpm --filter @faako/stroane-web run db:studio
pnpm --filter @faako/stroane-web run db:status:dev
pnpm --filter @faako/stroane-web run db:status:prod
pnpm --filter @faako/stroane-web run db:deploy:prod
pnpm --filter @faako/stroane-web run db:seed:catalogue
```

Backend user seeding is private and CSV-driven. For local development, use
`pnpm --filter @faako/stroane-web run db:seed`; it explicitly targets
`.env.development`. Production seeding requires the intentionally separate
`pnpm --filter @faako/stroane-web run db:seed:prod` command. For now, seed only
one `ADMIN` account and one `VIEWER` account, then remove the plaintext CSV from
local disk after seeding. Do not use the public sign-up page for backend
admin/viewer accounts. Runtime staff login uses the persisted `SiteUser` rows
through `/api/auth/login`; the CSV is only an import source.

## Configuration

Use `apps/stroane-web/.env.example` only as a public reference. Local development
runtime values belong in the ignored `apps/stroane-web/.env.development` file.
`pnpm run dev:stroane` starts the Stroane frontend and API in development mode,
after running the local Prisma predeploy migration check, so both prefer
`.env.development`. Never place real secrets in `.env.example`.

Only browser-safe values should use the `VITE_*` prefix.

Legacy `VITE_PAYSTACK_PUBLIC_KEY` usage should not be used for production settlement. Current checkout uses backend initialization, browser-return status checks, signed webhook confirmation, and server-side Paystack transaction verification before paid order finalization. Payment event logging plus notification-log idempotency remain the next hardening steps before automated fulfillment, staff alerts, or multi-channel order updates.

Current customer account placeholders are not a server-enforced auth system and must not protect admin, payment, or sensitive customer workflows without backend validation. Private backend users are managed through the `SiteUser` foundation and sign in from `https://portal.stroanesolutions.com/login` with their staff username/password, then continue into protected `/admin/*` portal routes; keep this limited to approved staff accounts for now. The auth credential lives in an HttpOnly cookie and the portal stores profile metadata only. Do not widen the cookie domain or switch to `SameSite=None` without a CSRF/subdomain-risk review.

Shared app-mode helpers (`normal`, `degraded`, `read_only`, `maintenance`) and maintenance/read-only/degraded UI wrappers are available in `@faako/config` and `@faako/ui`, but Stroane has not wired them into runtime behavior yet. Use them only after deciding the public-site maintenance copy, contact fallback, and any backend/API guard requirements.

## Browser QA Notes

Stroane and shared UI styles normalize Safari/iOS native controls for customer and admin forms. Buttons, inputs, selects, textareas, search fields, date fields, dropdowns, and shared action controls inherit the app font, use token-based styling, and avoid unwanted native blue/rounded browser controls. Storefront checkout and portal order/profile controls should use shared `@faako/ui` fields rather than raw native selects/date/time/datalists. Keep future checkout, inquiry, product filter, and admin order controls on these shared patterns unless a browser-specific visual regression is reviewed.

Customer/staff contact forms validate email and phone formats on the frontend for feedback and on the backend as the source of truth. The shared phone rule allows common Ghana/international formatting characters but requires 7-15 digits after punctuation and spacing are stripped.

Mobile-sensitive pages use `100dvh` fallbacks where safe, plus safe-area padding on checkout/admin portal surfaces. Before a public purchasing push, smoke test storefront `/shop`, product detail, `/checkout`, and `/checkout/return`, plus portal `/login`, `/admin`, and reset module placeholders, on real iPhone Safari against the deployed Cloudflare Pages/Railway API pairing.

## Build And Deploy

```bash
pnpm --filter @faako/stroane-web run lint
pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit
pnpm --filter @faako/stroane-web run build
pnpm --filter @faako/stroane-web run db:deploy:prod
pnpm --filter @faako/stroane-web start:api
```

## Cloudflare Pages, Railway API, And Cloudflare DNS

Use Cloudflare Pages for the deployed frontend, Railway for the deployed API/backend service, Railway Postgres for the database, and Cloudflare for DNS/domain routing.

Cloudflare Pages static security headers live in `public/_headers`. The Pages build copies that file into `dist/`, so the deployed frontend can allow the public API origin through the checked-in static header policy.

Cloudflare Pages frontend settings:

- Build command: `pnpm --filter @faako/stroane-web build`
- Output directory: `apps/stroane-web/dist`
- Environment variable: `VITE_API_BASE_URL=https://api.stroanesolutions.com`

Railway API service command from the monorepo root with `RAILWAY_WORKSPACE=@faako/stroane-web`:

- Root build command: `node ./scripts/railway-service.mjs build`
- Root start command: `node ./scripts/railway-service.mjs start`
- Workspace build script: `pnpm --filter @faako/stroane-web exec prisma generate`
- Workspace start script: `pnpm --filter @faako/stroane-web start:api`
- Workspace fallback script: `pnpm --filter @faako/stroane-web server:prod`

Railway API service env must include `DATABASE_URL`, `NODE_ENV=production`, and `APP_ENV=production`. Do not place `DATABASE_URL` or other server-only secrets on the Cloudflare Pages frontend project. Do not place `VITE_API_BASE_URL` on the Railway API service unless a future backend feature explicitly needs it.

Cloudflare DNS should route `stroanesolutions.com` and `www.stroanesolutions.com` to the Cloudflare Pages frontend. The browser-facing API origin is `https://api.stroanesolutions.com`, backed by the Railway API service.

Cloudflare Pages uses `public/_headers`, the public API URL comes from `VITE_API_BASE_URL`, and local development uses the Vite proxy.

If the backend runs behind a trusted reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops, usually `1`, so Express resolves client IPs safely for rate limiting without trusting arbitrary forwarded headers.

Smoke test these API routes after deploy:

- `https://api.stroanesolutions.com/health`
- `https://api.stroanesolutions.com/api/catalogue/products`
- `https://api.stroanesolutions.com/api/catalogue/categories`
- `https://api.stroanesolutions.com/api/catalogue/products/<slug>`
- Legacy aliases: `https://api.stroanesolutions.com/api/products` and `https://api.stroanesolutions.com/api/categories`

For Dev ERP monitoring, keep app-specific URL overrides and activity webhook env values in private operations configuration once the backend is deployed. This enables the optional API checks for `/health`, `/api/catalogue/products`, and `/api/catalogue/categories`, plus backend-only order/payment activity forwarding, without publishing client-specific env names or webhook secrets in the public example file.
