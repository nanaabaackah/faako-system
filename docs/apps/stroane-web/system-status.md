# Stroane Web System Status

## App purpose

Stroane Web is a full-stack commerce app for the first paying client project. It pairs a React and TypeScript frontend with an Express backend and Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## Current status

Client-sensitive active project. Treat public frontend, purchasing, backend API, database, deployment, and DNS/CORS changes as high visibility.

## Stable modules/features

- React storefront structure, pages, components, API client, and types.
- Express backend route and middleware structure.
- Railway API `/health` endpoint returns `{ ok: true, service: "stroane-api" }` without requiring database access.
- Railway API CORS now allows the live Cloudflare Pages storefront and portal origins by default: `https://stroanesolutions.com`, `https://www.stroanesolutions.com`, `https://portal.stroanesolutions.com`, and Cloudflare Pages preview origins ending in `.pages.dev`. Keep `CORS_ORIGINS` explicit in Railway for clarity.
- Prisma schema and migration workflow.
- Cloudflare Pages frontend deployment pattern with Railway API/backend and Railway Postgres.
- Cloudflare Pages static response headers are defined in `public/_headers` for frontend security headers and SPA deployment.
- Public marketing pages: Home, About, Services, Resources, Contact, Shop, Product Detail.
- Public browser fallback in `src/data/stroaneCatalogue.json`, server-side import seed in `prisma/data/stroaneCatalogueSeed.json`, and typed storefront helpers in `src/data/products.ts`.
- Normalized catalogue architecture: parent category groups, leaf storefront categories, standalone thermometer products, apron variant-parent products, structured media entries, structured specifications, variant image metadata, and manual-review inventory placeholders.
- Additive Prisma/Postgres catalogue persistence foundation for `CatalogueCategory`, `CatalogueProduct`, `CatalogueInquiry`, and `BusinessProfileContent`.
- Read-only catalogue API foundation: `GET /api/catalogue/categories`, `GET /api/catalogue/products`, and `GET /api/catalogue/products/:slug` prefer persisted `CatalogueCategory`/`CatalogueProduct` rows when available and fall back to the local JSON seed when the database is unavailable or not yet migrated. Persisted categories are returned only when persisted published products also exist so partially seeded databases do not mix stale database categories with seed products. Legacy `/api/categories` and `/api/products` aliases remain available during rollout.
- API-first catalogue frontend foundation: `/shop`, `/products`, and product detail routes try the backend catalogue APIs first and fall back to the local JSON seed with user-visible fallback notices.
- Catalogue API diagnostics log the public `VITE_API_BASE_URL`, requested endpoint, HTTP status when available, and safe error messages when the browser falls back to local catalogue data. No secrets or database values are logged.
- Catalogue browsing UX: category overview, category tabs, search, sort, result counts, responsive product cards, mapped product images, product-detail specifications/use cases, and product-specific inquiry CTAs.
- Product detail galleries support normalized media, thumbnail switching, and variant image switching while keeping cart behavior product-level until variant checkout is explicitly designed.
- Inquiry endpoint: `POST /api/inquiries` validates and persists minimal product/contact requests when the database migration is deployed, without email sending, orders, payments, inventory updates, or CRM automation.
- Product detail and Contact inquiry forms submit to the validated inquiry endpoint when available, include minimal honeypot fields, and keep direct email fallback options.
- Lightweight commerce foundation: cart state persists product IDs/quantities locally, public header/mobile nav shows cart count, checkout collects customer/contact details plus delivery or pickup fulfillment details, and `POST /api/orders` can create server-priced `PAYMENT_PENDING` order records when the commerce migration is deployed.
- Checkout fulfillment capture: delivery orders use the backend-proxied `/api/location/search` flow so customers search/select a GPS/geocoded delivery address instead of choosing from a predefined list. Pickup orders capture a selected pickup spot plus pickup date and time. The backend stores the customer order type in `CommerceOrder.deliveryMethod`, the pickup/delivery date in `CommerceOrder.expectedDeliveryDate`, and optional selected delivery-location metadata for staff map review.
- Storefront stock availability foundation: catalogue products support `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`. Product cards/details show availability. The current storefront commerce surface is price-led: priced products can be added to cart unless an explicit zero-quantity, `out_of_stock`, preorder-without-backorder, or known-insufficient-quantity blocker exists.
- Operational inventory foundation: catalogue products now support optional `availableQuantity`, `reservedQuantity`, and `reorderThreshold`, with additive Prisma models for suppliers, supplier contacts, product-supplier links, inventory items, stock movements, adjustment/restock notes, and inventory audit entries.
- Production-safe catalogue reconciliation and inventory bootstrap commands are available. They archive stale catalogue rows without deleting them and create missing operational inventory records without inventing stock quantities or overwriting existing counts.
- Additive commerce order persistence foundation for `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`.
- Additive customer account/CRM foundation for `CustomerAccount`, customer account status, and optional `CommerceOrder.customerId` links.
- Paystack checkout MVP: `POST /api/orders/:orderId/paystack/initialize` initializes Paystack server-side for validated orders, `/checkout/return` displays customer payment status, and `POST /api/paystack/verify` acts as a browser-return status check without finalizing successful payments.
- Paystack webhook confirmation: `POST /api/paystack/webhook` verifies `x-paystack-signature`, validates charge events, checks reference/amount/currency against the stored order, and is the trusted path for marking an order paid.
- Server-backed customer accounts: `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/orders`, and `/quotes` use customer-cookie APIs for customer signup/login, password reset, profile editing, and customer-scoped order history. Direct customer signup is allowed; checkout references and staff-generated invites are optional linking context.
- Lightweight internal operations portal: `https://portal.stroanesolutions.com` is the dedicated Cloudflare Pages operational surface. Staff authenticate at `/login` with backend `SiteUser` credentials and an HttpOnly admin cookie, then protected portal routes render inside the shared `@faako/ui` ERP shell.
- Active portal modules: `/admin` dashboard, `/admin/inventory`, `/admin/orders`, `/admin/crm`, `/admin/directory`, and `/admin/profile`. The dashboard includes order/stock business analytics and drilldown modals. Inventory includes stock value, KPI drilldowns, full-width admin table pagination, product creation, product lightbox editing, product autosave, row numbers, row selection, and bulk product publishing/archive/delete-listing actions. Orders includes storefront/manual order review, manual order creation, numbered/selectable rows, order-modal previous/next navigation, autosaved fulfillment edits, delivery-location maps, fulfillment notes, and Paystack initialize/status-refresh actions. CRM/directory includes customer KPIs, search/status filters, numbered/selectable rows, customer creation, account status, and one-time invite link creation. Profile uses shared ERP fields/actions for personal details and appearance preference.
- Placeholder portal modules: `/admin/suppliers`, `/admin/products`, `/admin/operations`, `/admin/reports`, and `/admin/settings` remain reset placeholders until rebuilt.
- Protected product, supplier, inventory, movement, and alert API reads remain available to the `/admin` dashboard so product fetches and stock signals continue to work. Public catalogue APIs return active rows only and omit supplier, cost, and import-review internals, including during server-side seed fallback.
- Operational inventory owner alerts: backend scans detect low-stock, out-of-stock, reorder-threshold, and restocked states for published tracked products only. Durable cooldown claims prevent duplicate sends; grouped Resend email summaries are supported when configured; WhatsApp summaries are prepared through a provider-neutral abstraction without automated sending. The protected inventory portal shows active owner-alert counts and restock recommendations.
- Security hardening foundation: Stroane backend now reuses shared `@faako/security` API headers, keeps CORS allowlist/trusted proxy controls, applies route-specific rate limits for auth/inquiry/checkout/Paystack routes, revalidates stock/pricing before payment initialization, and minimizes Paystack provider metadata.
- Commerce stabilization/Safari UI QA: shared and Stroane form controls now normalize unwanted Safari/iOS native button/input/select/search/date styling while preserving focus states and token-based theming. Storefront checkout and portal order/profile forms use shared select/date/time/text controls rather than raw native widgets. Checkout, admin orders, auth, error, services, shared app screens, dropdowns, and maintenance pages use `100dvh` fallbacks where safe for mobile browser toolbar behavior.
- Contact data validation baseline: checkout, contact enquiries, manual portal orders, portal profile updates, order preparation, catalogue enquiries, profile APIs, and inventory supplier/contact writes validate email and phone formats before accepting customer/staff contact details.
- Order notification foundation: after successful webhook-confirmed payment, the backend can send a customer-safe payment-confirmed email through Resend when configured. Shared templates also exist for future order received, processing, completed, payment pending/failed, WhatsApp, and SMS updates.
- Footer-linked policy pages: Terms, Privacy, Cookies, Sitemap (all rendering through the shared `LegalLayout` component where applicable).
- Error page with 404 / 500 variants and shared helpful-link grid.
- Sitewide scroll-to-top button (mounted in `Layout`).
- Shared catalogue source-of-truth in `src/data/products.ts` and reusable basket state via `CartContext` (wrapped in `main.tsx`).
- Reusable `QuantityControls` component (add → +/qty/+/trash) shared between Shop cards and Product Detail.
- Route-aware header: hero routes stay transparent until scrolled; non-hero routes get the solid variant from load and skip the entry animation. Hamburger menu now correctly hidden on desktop.
- Public-site posture (2026-05-14 onward): no auth gate, no `/users` admin page. The site is open to anyone.

## Removed / decommissioned

- Preview-access auth gate (`AuthContext`, `AuthProvider`, `AuthGate`).
- Admin user-management page (`/users`, `UserManagement.tsx`).
- Provider-specific `/api/*` proxy entries. The frontend should use `VITE_API_BASE_URL` for the browser-facing API origin (`https://api.stroanesolutions.com` in production); Cloudflare Pages is the current frontend host. `VITE_BACKEND_BASE_URL` is only a legacy fallback.

## In-progress modules/features

- Product browsing, inquiry conversion, pending-order checkout, fulfillment selection, and Paystack test-mode checkout refinement; product pages now support backend-backed catalogue reads, seed fallback, mapped imagery, product-specific inquiry forms, and checkout can prepare pending delivery/pickup orders plus initialize/verify Paystack payments.
- Real stock count entry for accurate online purchasing. Current storefront testing allows priced products with unknown quantities, but Stroane still needs confirmed quantities, thresholds, and backorder policy before broad public promotion.
- Supplier, standalone product, operations, report, and settings module pages are reset placeholders. Product creation/editing/bulk publishing now happens inside `/admin/inventory`; the `/admin` dashboard reads protected product, supplier, inventory, movement, alert, and order APIs for overview signals. The one-time inventory bootstrap remains an explicit CLI operation.
- Inventory owner alerts now run after committed stock mutations and through protected manual or scheduler triggers. Railway still needs intentional `STROANE_ALERT_*` configuration and a cron/scheduler call before recurring production scans are active.
- Full catalogue import/manual review from PDF/image sources. Current seed covers normalized thermometer products, poster/signage products, and apron variant parents with manual-review flags where prices, exact models, sizes, supplier details, and stock counts need confirmation.
- Inquiry routing decision. The current API can persist minimal inquiry records, but inquiries are not yet linked into the CRM/directory workflow.
- Production backend/database deployment on Railway with Railway Postgres.
- Cloudflare Pages environment changes require a redeploy because `VITE_*` values are baked into the built frontend bundle.
- Client deployment readiness and operational polish.
- Final guide / service hero imagery — placeholders reuse existing images for services 7 and 8 and for the featured guide.
- Contact/product inquiry delivery — the frontend can submit through `/api/inquiries` when the backend/database is available and falls back to direct email if unavailable.
- Order/payment operations after pending order creation. Checkout can prepare a pending order, initialize Paystack, process signed Paystack webhooks, verify Paystack transactions server-side before final paid status, verify Paystack return references for customer messaging only, and send payment-confirmed customer email when Resend is configured. The private order module can list orders, create manual orders, update fulfillment metadata, initialize Paystack, and refresh Paystack payment status.
- Customer account flow needs development-database migration and browser smoke: direct signup, forgot/reset password email delivery, Paystack return profile linking, staff invite creation/copying, customer login/profile save, and customer order-history scoping should be verified before broad public promotion.
- Public customer sign-in actions stay on the storefront customer-account surfaces. Private backend `SiteUser` staff credentials route valid staff users into protected `/admin/*` operations through an HttpOnly admin cookie. Private backend access should remain limited to approved staff accounts until broader staff-management workflows are approved.

## Experimental modules/features

- Any new purchasing, checkout, inventory, payment, or account features until validated with the client.
- Standalone product admin, category admin, supplier admin, report, settings, inquiry lead views, advanced order automation, hard product deletion, and inventory-to-fulfillment automation until scope and access control are approved.
- Inquiry notifications, staff order alerts, WhatsApp/SMS order messages, and non-payment-confirmed order emails until provider secrets, consent, retry rules, idempotency, and data retention are approved.
- New integrations or backend hosting changes until proven in a production-like environment.
- Strict webhook/notification idempotency. Current MVP uses signed webhook verification plus an order-level sent timestamp, but a full payment event log and notification audit trail are still pending.
- Railway/provider-level rate limiting, Railway Postgres least-privilege access, production `SiteUser` bootstrap/auth deployment verification, and centralized redacted logging are still pending production-hardening items.
- Device/browser acceptance testing against the deployed Cloudflare Pages/Railway API pairing is still pending after the Safari/native-control CSS cleanup. Run local build, lint, type, Prisma, backend, security, hosting-readiness, and dashboard product-fetch checks before promotion.

## High-risk areas

- Purchasing, checkout, order capture, payment-adjacent, and customer-facing flows.
- Product pricing accuracy, especially quote-only poster/apron items and any PDF content not fully extracted.
- Product stock accuracy. Unknown quantities no longer block checkout by themselves for priced products, so backend validation for explicit stock blockers and known quantity limits must remain in place while confirmed counts are entered through the protected inventory setup API and audited movement screen.
- Product variant stock accuracy. Apron colour/style variants now have variant-level stock placeholders, but checkout remains product-level until a safe variant checkout/admin stock workflow is approved.
- Inquiry handling because it persists customer contact details once the migration is deployed.
- Customer profile/order privacy. Storefront `sessionStorage` may contain only a non-secret customer profile shell; private customer reads must remain backend-filtered by customer cookie context.
- In-memory API rate limiting; configure Railway/provider-level rate controls before public high-volume checkout.
- Railway Postgres least-privilege database policy is not implemented in app code yet. Orders, order items, inquiries, users, payment/event logs, notification logs, and future admin data require strict production access controls.
- Payment-adjacent order status changes; Paystack webhook processing must verify signatures and Paystack transactions server-side before any automated fulfillment or confirmation email.
- Database migrations and production product/order/customer data.
- API authentication, rate limiting, CORS, and trusted proxy configuration.
- DNS/custom domain, Cloudflare Pages frontend hosting, Railway API/backend hosting, and environment-variable configuration.

## Production sensitivity

High for client-facing changes. Stroane is the first paying client project, so regressions can affect client trust, public customer experience, and transaction readiness.

## Before-every-deploy questions

- Does this change affect the client-visible storefront, product data, purchasing flow, or API behavior?
- If catalogue data changed, was the source document reviewed and are manual-review placeholders clearly marked?
- If inquiry handling changed, does it still avoid exposing secrets and unnecessary customer data?
- Does this change require a migration or production data update?
- Are CORS origins, backend URLs, DNS, and proxy settings correct for the target environment?
- Are secrets kept out of `VITE_*` values?
- Has the affected flow been checked on the deployed frontend/backend pairing?
- Is the rollback plan clear for both frontend and backend changes?
- Are checkout/auth/payment changes clearly marked pending/foundation-only unless backend validation and payment verification are active?
- Has `db:deploy:prod` been run against the intended Railway Postgres database before enabling inquiry persistence?
- Are inquiry records being stored only in the intended production database, with no secrets in browser-visible env values?
