# Stroane Web System Status

## App purpose

Stroane Web is a full-stack commerce app for the first paying client project. It pairs a React and TypeScript frontend with an Express backend and Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## Current status

Client-sensitive active project. Treat public frontend, purchasing, backend API, database, deployment, and DNS/CORS changes as high visibility.

## Stable modules/features

- React storefront structure, pages, components, API client, and types.
- Express backend route and middleware structure.
- Prisma schema and migration workflow.
- Netlify frontend deployment pattern.
- Public marketing pages: Home, About, Services, Resources, Contact, Shop, Product Detail.
- Catalogue seed foundation in `src/data/stroaneCatalogue.json` with typed helpers in `src/data/products.ts`.
- Additive Prisma/Postgres catalogue persistence foundation for `CatalogueCategory`, `CatalogueProduct`, `CatalogueInquiry`, and `BusinessProfileContent`.
- Read-only catalogue API foundation: `GET /api/categories`, `GET /api/products`, and `GET /api/products/:slug` prefer persisted `CatalogueCategory`/`CatalogueProduct` rows when available and fall back to the local JSON seed when the database is unavailable or not yet migrated.
- API-first catalogue frontend foundation: `/shop`, `/products`, and product detail routes try the backend catalogue APIs first and fall back to the local JSON seed with user-visible fallback notices.
- Catalogue browsing UX: category overview, category tabs, search, sort, result counts, responsive product cards, mapped product images, product-detail specifications/use cases, and product-specific inquiry CTAs.
- Inquiry endpoint: `POST /api/inquiries` validates and persists minimal product/contact requests when the database migration is deployed, without email sending, orders, payments, inventory updates, or CRM automation.
- Product detail and Contact inquiry forms submit to the validated inquiry endpoint when available, include minimal honeypot fields, and keep direct email fallback options.
- Lightweight commerce foundation: cart state persists product IDs/quantities locally, public header/mobile nav shows cart count, checkout collects customer/contact/delivery details, and `POST /api/orders` can create server-priced `PAYMENT_PENDING` order records when the commerce migration is deployed.
- Storefront stock availability foundation: catalogue products support `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`. Product cards/details show availability, cart controls block unavailable additions, and checkout/order creation reject unavailable, quote-only, or unconfirmed-stock items before Paystack initialization.
- Additive commerce order persistence foundation for `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`.
- Paystack checkout MVP: `POST /api/orders/:orderId/paystack/initialize` initializes Paystack server-side for validated orders, `/checkout/return` displays customer payment status, and `POST /api/paystack/verify` acts as a browser-return status check without finalizing successful payments.
- Paystack webhook confirmation: `POST /api/paystack/webhook` verifies `x-paystack-signature`, validates charge events, checks reference/amount/currency against the stored order, and is the trusted path for marking an order paid.
- Lightweight admin order management: unlinked `/admin/orders` uses private backend `SiteUser` auth for order search/list/detail, masked payment references, and admin-only fulfillment/status/note updates.
- Security hardening foundation: Stroane backend now reuses shared `@faako/security` API headers, keeps CORS allowlist/trusted proxy controls, applies route-specific rate limits for auth/inquiry/checkout/Paystack routes, revalidates stock/pricing before payment initialization, and minimizes Paystack provider metadata.
- Commerce stabilization/Safari UI QA: shared and Stroane form controls now normalize unwanted Safari/iOS native button/input/select/search/date styling while preserving focus states and token-based theming. Checkout, admin orders, auth, error, services, shared app screens, dropdowns, and maintenance pages use `100dvh` fallbacks where safe for mobile browser toolbar behavior.
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
- Netlify `/api/*` proxy entry. The frontend should use `VITE_BACKEND_BASE_URL` when the backend is hosted separately.

## In-progress modules/features

- Product browsing, inquiry conversion, pending-order checkout, and Paystack test-mode checkout refinement; product pages now support backend-backed catalogue reads, seed fallback, mapped imagery, product-specific inquiry forms, and checkout can prepare pending orders plus initialize/verify Paystack payments.
- Real stock count entry for online purchasing. Current PDF-imported catalogue products default to non-purchasable until Stroane confirms quantities, thresholds, and backorder policy.
- Full catalogue import/manual review from PDF sources. Current seed covers confirmed first-page thermometer price-list items plus brochure-derived poster/signage and apron placeholders where details need review.
- Inquiry routing decision. The current API can persist minimal inquiry records, but should not be treated as a CRM or lead-management system yet.
- Production backend/database deployment on Railway with Railway Postgres.
- Client deployment readiness and operational polish.
- Final guide / service hero imagery — placeholders reuse existing images for services 7 and 8 and for the featured guide.
- Contact/product inquiry delivery — the frontend can submit through `/api/inquiries` when the backend/database is available and falls back to direct email if unavailable.
- Order/payment operations after pending order creation. Checkout can prepare a pending order, initialize Paystack, process signed Paystack webhooks, verify Paystack transactions server-side before final paid status, verify Paystack return references for customer messaging only, send payment-confirmed customer email when Resend is configured, and provide a private lightweight admin order screen for fulfillment status/notes. Fulfillment automation, staff notifications, and broader operational order management remain future backend work.
- Front-end-only customer sign-in/sign-up pages have been added and pass core checks, but are not server-enforced customer account flows yet.
- `/signin` can also submit private backend `SiteUser` staff credentials and route valid admin/viewer users to `/admin/orders`. Private backend access should remain seeded as one admin and one viewer account until a broader admin account model is approved.

## Experimental modules/features

- Any new purchasing, checkout, inventory, payment, or account features until validated with the client.
- Product admin/category admin/inquiry lead views until scope and access control are approved. The current admin surface is limited to protected order review and lightweight fulfillment status/notes.
- Inquiry notifications, staff order alerts, WhatsApp/SMS order messages, and non-payment-confirmed order emails until provider secrets, consent, retry rules, idempotency, and data retention are approved.
- New integrations or backend hosting changes until proven in a production-like environment.
- Strict webhook/notification idempotency. Current MVP uses signed webhook verification plus an order-level sent timestamp, but a full payment event log and notification audit trail are still pending.
- Railway/provider-level rate limiting, Railway Postgres least-privilege access, backend-enforced admin auth, and centralized redacted logging are still pending production-hardening items.
- Device/browser acceptance testing against the deployed Netlify/Railway pairing is still pending after the Safari/native-control CSS cleanup. Local build, lint, type, Prisma, backend tests, and security gates pass.

## High-risk areas

- Purchasing, checkout, order capture, payment-adjacent, and customer-facing flows.
- Product pricing accuracy, especially quote-only poster/apron items and any PDF content not fully extracted.
- Product stock accuracy. Online purchasing should stay disabled for products with unknown stock; backend validation must remain in place until a lightweight stock editor/admin flow exists.
- Inquiry handling because it persists customer contact details once the migration is deployed.
- Front-end-only account/session state in localStorage; it must not protect sensitive workflows without backend validation.
- In-memory API rate limiting; configure Railway/provider-level rate controls before public high-volume checkout.
- Railway Postgres least-privilege database policy is not implemented in app code yet. Orders, order items, inquiries, users, payment/event logs, notification logs, and future admin data require strict production access controls.
- Payment-adjacent order status changes; Paystack webhook processing must verify signatures and Paystack transactions server-side before any automated fulfillment or confirmation email.
- Database migrations and production product/order/customer data.
- API authentication, rate limiting, CORS, and trusted proxy configuration.
- DNS, Netlify, backend hosting, and environment-variable configuration.

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
