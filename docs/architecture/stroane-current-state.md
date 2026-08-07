# Stroane current state

Date: 2026-08-02

## Executive map

Stroane is one workspace with four runtime concerns:

1. a public React/Vite storefront;
2. a customer-session and checkout surface within that storefront;
3. a protected React/Vite operations portal;
4. an Express/Prisma API deployed separately from the browser artifacts.

Before this task, `VITE_APP_SURFACE` selected the storefront or portal at runtime, but both lazy application trees were emitted by one Vite build. The source folders were reasonably distinct; the build, package, environment, service-worker, and deployment boundaries were not.

## Browser routes

### Public and customer storefront

| Route | Responsibility | Data/auth/interactivity |
| --- | --- | --- |
| `/` | Public homepage | Static content, public catalogue highlights |
| `/about` | Company and trust content | Static content |
| `/services` | Food-safety services | Static content and structured data |
| `/catalogue`, `/shop` | Catalogue, category filter, search, cart | Live catalogue API with checked-in public fallback |
| `/products` | Product listing | Live catalogue API with fallback |
| `/products/:id` | Product detail and enquiry | Catalogue API, cart, enquiry form |
| `/resources` | Food-safety resources and FAQ | Static content and FAQ structured data |
| `/contact` | General enquiry | `POST /api/inquiries` with direct-contact fallback |
| `/search` | Cross-site public search | Client-side search |
| `/checkout` | Order preparation and Paystack redirect | Cart, location API, order API, customer input |
| `/checkout/return` | Customer payment-status view | Server-side Paystack verification status |
| `/sign`, `/signup`, `/forgot-password`, `/reset-password` | Customer identity | HttpOnly customer session API |
| `/account`, `/orders`, `/quotes` | Customer-area placeholders | Customer session; no operational/admin data |
| `/terms`, `/privacy`, `/cookies`, `/sitemap` | Public policy/navigation | Static content |
| `/login`, `/admin/*` | Portal hand-off | External redirect to the portal origin |

### Authenticated operations portal

| Route | Responsibility | Backend authority |
| --- | --- | --- |
| `/login` | Staff login | `/api/auth/*`, HttpOnly admin cookie |
| `/admin` | Operations dashboard | Protected admin APIs |
| `/admin/inventory` | Stock, suppliers, movements, product publishing | Protected inventory/product APIs |
| `/admin/orders` | Order and payment operations | Protected order APIs |
| `/admin/receipts` | Receipt operations | Protected receipt APIs |
| `/admin/accounting`, `/admin/expenses` | Accounting and expense workflows | Protected accounting APIs |
| `/admin/crm`, `/admin/directory` | Customer directory | Protected customer APIs |
| `/admin/profile` | Staff profile | Protected auth API |
| `/admin/team` | Staff and roles | Owner/Admin routes and backend enforcement |
| `/admin/audit-logs` | Read-only audit console | Admin-only audit API |
| `/admin/products`, `/admin/suppliers`, `/admin/operations`, `/admin/reports`, `/admin/settings` | Placeholders or hand-offs | Must remain protected as implemented |

## Data ownership

| Concern | Authoritative owner | Browser responsibility |
| --- | --- | --- |
| Catalogue publishing | Express API and PostgreSQL `CatalogueProduct`/`CatalogueCategory` | Read and normalize public-safe fields |
| Public outage catalogue | `src/data/stroaneCatalogue.json` | Read-only fallback; never a mutation target |
| Inventory | API/Prisma inventory services | Display, validation feedback, protected mutation requests |
| Orders | API/Prisma commerce services | Collect customer input and display server-calculated outcomes |
| Payment status | Paystack webhook plus server verification | Redirect and customer-safe status polling only |
| Staff access | API database roles/permissions | UX guards only |
| Customer sessions | API HttpOnly cookies | Non-sensitive profile cache in session storage |

## Catalogue and shared contracts

The storefront previously defined rich product/category contracts only in `src/data/products.ts`; admin inventory defined overlapping product and stock summaries in `src/portal/api`. The framework-independent base is now `PublicCatalogueProduct` and `PublicCatalogueCategory` in `@faako/types`. Stroane retains app-specific media, variant, copy, and presentation extensions locally.

The public API supports categories, product lists, product details, and enquiries. It falls back to the checked-in public catalogue if persisted catalogue reads are unavailable. Inventory writes never use the public fallback.

## Authentication and permissions

- Customer auth is used only by storefront customer routes and uses a separate customer cookie/API.
- Staff auth is used only by the portal and uses an HttpOnly admin cookie.
- Portal route guards are UX controls; `requireSiteUser` and `requireAdminRole` enforce access on the API.
- Module/action identifiers already come from `@faako/security`.
- Inventory view/edit permissions are checked independently.

## Search, forms, checkout, and payments

- Catalogue/search filtering is client-side over live-or-fallback public data.
- Contact and product enquiries use the validated inquiry endpoint and a honeypot.
- Checkout creates a pending order through the API; the API recalculates price and validates stock.
- Paystack secrets, signature verification, amount/currency checks, and paid-state mutation stay server-side.
- Card and MoMo credentials are neither stored nor logged by the browser.

## Build and deployment before separation

- Framework/build: React 19, React Router 7, Vite 6.
- One `index.html`, one `src/main.tsx`, and one combined production output.
- Runtime surface selection: `VITE_APP_SURFACE`.
- Cloudflare Pages hosts browser output; Railway hosts Express and PostgreSQL.
- The old build ran Prisma generation before Vite, coupling a static browser build to backend tooling.
- The old combined output emitted both `StorefrontApp` and `PortalApp` chunks.

## Environment variables

Names only:

### Browser/build

- `STROANE_BUILD_SURFACE`
- `VITE_ADMIN_PORTAL_URL`
- `VITE_API_BASE_URL`
- `VITE_APP_SURFACE`
- `VITE_BACKEND_BASE_URL`
- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_ENABLE_GA_IN_DEV`
- `VITE_GA_ID`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_PAYSTACK_PUBLIC_KEY`
- `VITE_PORTAL_BASE_URL`
- `VITE_PUBLIC_WEBSITE_URL`
- `VITE_STOREFRONT_BASE_URL`

### API/runtime and operational scripts

- `APP_ACTIVITY_WEBHOOK_SECRET`
- `APP_ACTIVITY_WEBHOOK_URL`
- `APP_AUTH_SECRET`
- `APP_ENV`
- `CF_PAGES`
- `CORS_ORIGINS`
- `CUSTOMER_ACCOUNT_EMAIL_FROM`
- `CUSTOMER_ACCOUNT_EMAIL_REPLY_TO`
- `DATABASE_URL`
- `DATABASE_URL_DEVELOPMENT`
- `DATABASE_URL_PRODUCTION`
- `DEV_API_BASE_URL`
- `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`
- `DEV_ERP_ACTIVITY_WEBHOOK_URL`
- `DEV_ERP_API_BASE_URL`
- `EMAIL_FORCE_TO`
- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `NODE_ENV`
- `ORDER_NOTIFICATION_FROM`
- `ORDER_NOTIFICATION_REPLY_TO`
- `PAYSTACK_ALLOW_LIVE`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_CURRENCY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `PORT`
- `PUBLIC_STOREFRONT_URL`
- `RECEIPT_EMAIL_FROM`
- `RECEIPT_EMAIL_REPLY_TO`
- `RESEND_API_KEY`
- `STOREFRONT_BASE_URL`
- `STROANE_ADMIN_AUTH_COOKIE_NAME`
- `STROANE_ALERT_COOLDOWN_MINUTES`
- `STROANE_ALERT_CRON_SECRET`
- `STROANE_ALERT_EMAILS`
- `STROANE_ALERT_FROM`
- `STROANE_ALERT_REPLY_TO`
- `STROANE_ALERT_WHATSAPP_NUMBERS`
- `STROANE_AUTH_SECRET`
- `STROANE_CATALOGUE_ARCHIVE_STALE`
- `STROANE_CATALOGUE_SEED_DRY_RUN`
- `STROANE_CUSTOMER_AUTH_COOKIE_NAME`
- `STROANE_GOOGLE_AUTOCOMPLETE_FIELD_MASK`
- `STROANE_GOOGLE_MAPS_API_KEY`
- `STROANE_GOOGLE_PLACES_AUTOCOMPLETE_URL`
- `STROANE_GOOGLE_PLACE_DETAILS_FIELD_MASK`
- `STROANE_GOOGLE_PLACE_DETAILS_URL`
- `STROANE_INVENTORY_BOOTSTRAP_APPLY`
- `STROANE_LOCATION_COUNTRY_CODES`
- `STROANE_LOCATION_REGION_CODE`
- `STROANE_LOCATION_SEARCH_ENABLED`
- `STROANE_LOCATION_SEARCH_PROVIDER`
- `STROANE_LOCATION_SEARCH_URL`
- `STROANE_LOCATION_SEARCH_USER_AGENT`
- `STROANE_STOREFRONT_BASE_URL`
- `TRUST_PROXY_HOPS`

## Risks found

1. A combined build could regress public/admin bundle separation without an output test.
2. Vite remains client-rendered; route-shell metadata improves discovery but is not server-rendered body content.
3. The workspace still physically contains browser, API, and Prisma sources; scripts and deployment contracts must keep artifacts separate.
4. Some non-inventory API modules still use local native-fetch adapters and should migrate incrementally.
5. The public outage snapshot requires publishing discipline so archived products are not redeployed accidentally.
6. Real stock counts and Paystack production readiness remain business launch gates, not framework concerns.
