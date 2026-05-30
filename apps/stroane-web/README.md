# Stroane Web

Workspace package: `@faako/stroane-web`

Stroane Web is a full-stack commerce app. It pairs a React 19 + TypeScript frontend with an Express backend and a Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## What Lives Here

- `src/`: React frontend, pages, components, API client, and types
- `backend/`: Express API server, route handlers, and middleware
- `prisma/`: Prisma schema and migrations
- `vite.config.ts`: Vite dev server and build config
- `.env.example`: environment variable reference

## Catalogue And Inquiry Foundation

Stroane product catalogue data now lives in `src/data/stroaneCatalogue.json`, with typed storefront helpers in `src/data/products.ts`. The seed is normalized around categories, products, brands, SKUs, descriptions, features, pricing, availability placeholders, inquiry CTAs, tags, use cases, and source references. It is based on the reviewed thermometer catalogue, thermometer price list, and food safety posters/aprons brochure.

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

Unknown stock should default to `stockQuantity: null` and `isPurchasable: false`. PDF-imported products should not be enabled for online purchasing until Stroane confirms real stock counts and backorder policy.

The current backend foundation exposes:

- `GET /api/catalogue/categories`
- `GET /api/catalogue/products`
- `GET /api/catalogue/products/:slug`
- `POST /api/inquiries`

Catalogue read endpoints prefer persisted `CatalogueCategory` and `CatalogueProduct` rows when the database has been migrated and seeded. If the database is unavailable, empty, or not yet migrated, the endpoints fall back to `src/data/stroaneCatalogue.json` so the public catalogue can keep rendering safely. Legacy aliases remain available at `/api/categories`, `/api/products`, and `/api/products/:slug` during the Railway API rollout.

`POST /api/inquiries` validates basic contact details and persists a minimal `CatalogueInquiry` record when the database migration has been deployed. It does not send email, create orders, take payments, update inventory, or run CRM automation. If storage is unavailable, the endpoint returns a safe error so the frontend can fall back to direct email.

Frontend catalogue pages use the centralized catalogue helpers. `/shop`, `/products`, and product detail routes attempt the API first and fall back to local seed data if the backend is unavailable. The catalogue page includes category browsing, search, sort, local fallback notices, and mobile-friendly product cards. Product pages include product-specific inquiry forms; priced products keep cart quantity controls, while custom-order/price-unavailable products avoid checkout quantity controls.

The frontend normalizes backend responses against local catalogue image metadata for known products. This keeps mapped product images visible even if a backend seed is older than the latest image extraction pass.

The public contact page also submits through the same validated inquiry endpoint when available, with a direct email fallback if the backend is unavailable. Both product and contact inquiry forms keep payloads minimal, include a simple honeypot field, and do not send automated email/SMS/WhatsApp messages yet.

## Commerce And Checkout Foundation

Stroane now has a lightweight commerce foundation, not a full ERP or Shopify-style platform.

- Cart state persists product IDs and quantities only in browser `localStorage`.
- The header/mobile navigation shows a cart count and links to `/checkout`.
- Checkout collects customer contact and delivery details, then asks the customer to review before submitting.
- `POST /api/orders` creates a `PAYMENT_PENDING` order request when the commerce migration has been deployed.
- The backend recalculates product prices from catalogue data; frontend totals are display-only.
- Custom-order, price-unavailable, unavailable, out-of-stock, unconfirmed-stock, and non-purchasable products are blocked from checkout and should use the product inquiry flow.
- Product cards/details show availability before purchase. Inquiry/notify CTAs are fallback paths for out-of-stock, enquiry-only, price-unavailable, or custom-order products.

The commerce order foundation is additive and uses Prisma/Postgres models for `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`. It does not deduct inventory, manage warehouses, create fulfillment tasks, or run CRM automation. Automated customer messaging is currently limited to verified payment-confirmed email when the backend email provider is configured.

The checkout backend validates stock/purchasability before order preparation and payment initialization. The inventory foundation now has additive supplier, inventory item, stock movement, adjustment/restock note, and audit-entry tables. This is still not a full warehouse system: checkout/order integration, automatic stock deduction, and stock reservation are future work.

Paystack is the first payment provider for checkout. The checkout flow creates a pending order, asks the backend to initialize a Paystack transaction, redirects the customer to Paystack, then returns to `/checkout/return` where the frontend asks the backend for a customer-facing status check. The signed Paystack webhook is the trusted source for marking an order paid.

Current payment boundaries:

- `POST /api/orders/:orderId/paystack/initialize` uses the server-side Paystack secret to initialize payment for a validated order.
- `POST /api/paystack/verify` verifies a Paystack reference server-side for the return-page status check. Successful browser-return verification does not finalize paid status until webhook confirmation exists.
- `POST /api/paystack/webhook` verifies `x-paystack-signature`, validates charge events, calls Paystack transaction verification server-side, checks the verified reference/amount/currency against the stored order, and marks an order `PAID` only when those checks pass.
- Amount and currency are checked from the Paystack-verified transaction against the server-side order total.
- Card/MoMo sensitive details are not stored.
- Webhook processing is implemented as the payment confirmation source; callback polling is customer messaging only.

After a successful verified payment, the backend can send a customer-safe payment-confirmed order email through Resend when email env values are configured. The email includes order number, items summary, total, payment status, and customer contact details only. It does not include internal notes, audit metadata, raw database IDs, secrets, Paystack authorization payloads, or card/MoMo details.

Order notification boundaries:

- Email sending is currently limited to payment-confirmed checkout orders after signed Paystack webhook confirmation.
- WhatsApp and SMS formatters exist as helpers only; no WhatsApp Business API or SMS provider is connected.
- Order received, processing, completed, payment pending, and payment failed templates exist for future workflows but are not automated yet.
- Duplicate sends are reduced with `customerNotificationSentAt`, but a full payment event and notification log/audit table is still needed before webhook replay tooling, retries, or multi-channel automation.

## Lightweight Admin Orders

Private order management is available at `/admin/orders`. This route is intentionally not linked from the public navigation. It uses backend `SiteUser` login, not the public frontend-only customer sign-in/sign-up flow.

Admin order capabilities are intentionally small:

- `ADMIN` and `VIEWER` accounts can view order lists/details.
- `ADMIN` accounts can update fulfillment status, delivery method, expected delivery date, delivery notes, and internal notes.
- Payment status cannot be changed manually. Paystack webhook verification remains the source of truth for paid status.
- Fulfillment actions such as processing, ready, out for delivery, and completed are blocked until payment is confirmed.
- Paystack references are masked in admin responses; raw payment metadata, provider payloads, secrets, card details, and MoMo details are not shown.

The admin order fields are additive on `CommerceOrder`: `fulfillmentStatus`, `deliveryMethod`, `expectedDeliveryDate`, `adminDeliveryNotes`, `internalNotes`, `statusUpdatedAt`, and `statusUpdatedById`. This is not a delivery logistics system, CRM, stock deduction workflow, or full ERP.

## Security And Production Readiness

Stroane reuses the shared `@faako/security` API header baseline through `backend/security.js`. The backend also disables `x-powered-by`, uses CORS allowlists, requires explicit trusted proxy hops, limits JSON bodies, and keeps a default write-deny middleware for unknown API write routes.

Route-specific rate limits are layered on top of the global API limiter for:

- auth routes
- inquiry/contact submissions
- checkout order creation
- Paystack payment initialization
- Paystack return-page verification
- Paystack webhooks

These rate limits are in-memory and per Node process. Railway is the chosen production rate-limit layer for deployed checkout/inquiry/payment protection, so configure Railway/provider request controls before high-volume production checkout.

Checkout/payment integrity rules:

- Frontend prices, totals, stock state, and cart state are display/convenience only.
- The backend validates catalogue price, currency, stock status, purchasability, and quantity at order creation and again before Paystack initialization.
- Paystack metadata sent to the provider is minimized to order number/source. Internal raw order IDs and customer phone are not sent as Paystack custom metadata.
- Browser callback verification is not final payment truth; the signed webhook path marks orders paid only after server-side Paystack transaction verification confirms the reference, amount, and currency.
- Railway-level rate limiting, Railway Postgres least-privilege access, payment event logging, and notification log idempotency are still required before fulfillment automation or broader order operations.

Current public sign-in/sign-up pages are intentionally retained. Customer accounts are still frontend-only `localStorage` account/session flows and must not protect admin, order, payment, stock, customer-data, or inquiry-management workflows. The public sign-in page can also route private staff usernames through the backend `SiteUser` login and send valid `ADMIN`/`VIEWER` users to `/admin/orders`; staff accounts still live in the database and are not read from the CSV at runtime.

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

Keep Paystack and email-provider secrets server-side only. Paystack webhook signatures use the backend Paystack signing secret; if `PAYSTACK_WEBHOOK_SECRET` is blank, the backend falls back to `PAYSTACK_SECRET_KEY`. The backend blocks `sk_live_*` keys unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set. A payment event/notification log should be added before relying on webhook replay handling for automated fulfillment, retries, staff alerts, WhatsApp, or SMS updates.

The database foundation is additive and uses Prisma/Postgres models for `CatalogueCategory`, `CatalogueProduct`, `CatalogueInquiry`, `BusinessProfileContent`, `Supplier`, `SupplierContact`, `CatalogueProductSupplier`, `InventoryItem`, `InventoryMovement`, and `InventoryAuditEntry`. Existing environment variables still apply:

- `VITE_API_BASE_URL`: primary frontend API base URL when the backend is hosted separately
- `VITE_BACKEND_BASE_URL`: legacy frontend API base URL fallback for older deployments
- `CORS_ORIGINS`: allowed browser origins for the backend
- `APP_AUTH_SECRET`: backend-only token signing secret for private `SiteUser` admin/viewer auth
- `DATABASE_URL`: Railway Postgres default database URL
- `DATABASE_URL_DEVELOPMENT`: optional development database URL
- `DATABASE_URL_PRODUCTION`: optional production database URL
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_CURRENCY`, `PAYSTACK_ALLOW_LIVE`: server-side Paystack setup values. `PAYSTACK_SECRET_KEY` must never be exposed through `VITE_*`.
- `RESEND_API_KEY`, `ORDER_NOTIFICATION_FROM`, `ORDER_NOTIFICATION_REPLY_TO`: server-side customer order email setup values. `RESEND_API_KEY` must never be exposed through `VITE_*`.

Catalogue import is prepared through:

```bash
pnpm --filter @faako/stroane-web run db:deploy:prod
APP_ENV=production pnpm --filter @faako/stroane-web run db:seed:catalogue
```

Run migrations and the catalogue seed only after the target database has been verified. The catalogue seed upserts catalogue categories/products/business-profile content from `src/data/stroaneCatalogue.json`; it does not touch payments, orders, supplier records, inventory movements, CRM records, or notifications. The catalogue stock metadata, supplier/inventory foundation, commerce, payment metadata, notification metadata, webhook metadata, and admin fulfillment metadata migrations are additive and must be deployed before storefront stock gating, inventory admin/API work, `/api/orders`, Paystack confirmation, customer email metadata, and `/admin/orders` fulfillment notes can persist correctly.

Manual review still needed:

- Full PDF text extraction/OCR for catalogue copy beyond the visual product-image extraction
- Apron variants, sizes, images, and pricing
- Real stock counts, low-stock thresholds, and purchasability/backorder decisions for each product before public online checkout
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

Or run each side separately:

```bash
pnpm --filter @faako/stroane-web run dev:frontend
pnpm --filter @faako/stroane-web run server:dev
```

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
so both prefer `.env.development`. Never place real secrets in `.env.example`.

Only browser-safe values should use the `VITE_*` prefix.

Legacy `VITE_PAYSTACK_PUBLIC_KEY` usage should not be used for production settlement. Current checkout uses backend initialization, browser-return status checks, signed webhook confirmation, and server-side Paystack transaction verification before paid order finalization. Payment event logging plus notification-log idempotency remain the next hardening steps before automated fulfillment, staff alerts, or multi-channel order updates.

Current customer sign-in/sign-up support is front-end-only and stores account/session data in browser localStorage. It is not a server-enforced auth system and must not protect admin, payment, or sensitive customer workflows without backend validation. Private backend users are managed through the `SiteUser` foundation and can sign in from `/signin` with their staff username/password, then continue to `/admin/orders`; keep this limited to one seeded admin and one seeded viewer account for now.

Shared app-mode helpers (`normal`, `degraded`, `read_only`, `maintenance`) and maintenance/read-only/degraded UI wrappers are available in `@faako/config` and `@faako/ui`, but Stroane has not wired them into runtime behavior yet. Use them only after deciding the public-site maintenance copy, contact fallback, and any backend/API guard requirements.

## Browser QA Notes

Stroane and shared UI styles normalize Safari/iOS native controls for customer and admin forms. Buttons, inputs, selects, textareas, search fields, date fields, dropdowns, and shared action controls inherit the app font, use token-based styling, and avoid unwanted native blue/rounded browser controls. Keep future checkout, inquiry, product filter, and admin order controls on these shared patterns unless a browser-specific visual regression is reviewed.

Mobile-sensitive pages use `100dvh` fallbacks where safe, plus safe-area padding on checkout/admin order surfaces. Before a public purchasing push, smoke test `/shop`, product detail, `/checkout`, `/checkout/return`, and `/admin/orders` on real iPhone Safari against the deployed Cloudflare Pages/Railway API pairing.

## Build And Deploy

```bash
pnpm --filter @faako/stroane-web run lint
pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit
pnpm --filter @faako/stroane-web run build
pnpm --filter @faako/stroane-web run db:deploy:prod
pnpm --filter @faako/stroane-web start:api
```

## Cloudflare Pages, Railway API, And Cloudflare DNS

Use Cloudflare Pages for the deployed frontend, Railway for the deployed API/backend service, Railway Postgres for the database, and Cloudflare for DNS/domain routing. Do not rely on Netlify for the current Stroane deployment.

Cloudflare Pages static security headers live in `public/_headers`. The Pages build copies that file into `dist/`, so the deployed frontend can allow the Railway API origin without relying on a Netlify config artifact.

Cloudflare Pages frontend settings:

- Build command: `pnpm --filter @faako/stroane-web build`
- Output directory: `apps/stroane-web/dist`
- Environment variable: `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app`

Railway API service command from the monorepo root:

- Build command: `pnpm --filter @faako/stroane-web exec prisma generate`
- Start command: `pnpm --filter @faako/stroane-web start:api`
- Fallback command: `pnpm --filter @faako/stroane-web server:prod`

Railway API service env must include `DATABASE_URL`, `NODE_ENV=production`, and `APP_ENV=production`. Do not place `DATABASE_URL` or other server-only secrets on the Cloudflare Pages frontend project. Do not place `VITE_API_BASE_URL` on the Railway API service unless a future backend feature explicitly needs it.

Cloudflare DNS should route `stroanesolutions.com` and `www.stroanesolutions.com` to the Cloudflare Pages frontend. The API currently uses `https://stroane-api-production.up.railway.app`; `api.stroanesolutions.com` is optional future cleanup, not a requirement for this phase.

Stroane no longer includes a Netlify config artifact. Cloudflare Pages uses `public/_headers`, the Railway API URL comes from `VITE_API_BASE_URL`, and local development uses the Vite proxy.

If the backend runs behind a trusted reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops, usually `1`, so Express resolves client IPs safely for rate limiting without trusting arbitrary forwarded headers.

Smoke test these API routes after deploy:

- `https://stroane-api-production.up.railway.app/health`
- `https://stroane-api-production.up.railway.app/api/catalogue/products`
- `https://stroane-api-production.up.railway.app/api/catalogue/categories`
- `https://stroane-api-production.up.railway.app/api/catalogue/products/<slug>`
- Legacy aliases: `https://stroane-api-production.up.railway.app/api/products` and `https://stroane-api-production.up.railway.app/api/categories`

For Dev ERP monitoring, keep app-specific URL overrides in private operations configuration once the backend is deployed. This enables the optional API checks for `/health`, `/api/catalogue/products`, and `/api/catalogue/categories` without publishing client-specific env names in the public example file.
