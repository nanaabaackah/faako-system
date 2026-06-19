# Stroane Portal Architecture

## Purpose

Keep the customer-facing Stroane storefront, customer account area, and private staff operations portal structurally separate at both route and hostname level.

## Production Hosts

- `https://stroanesolutions.com`: public storefront only.
- `https://www.stroanesolutions.com`: public storefront alias.
- `https://portal.stroanesolutions.com`: private operational portal only.
- `https://api.stroanesolutions.com`: public API origin for both browser surfaces, backed by the Railway API service.

## Route Areas

### Public storefront

- `/`
- `/catalogue`
- `/shop`
- `/products`
- `/products/:slug`
- public informational pages
- `/signin`
- `/signup`

The storefront uses the public website layout. Customer sign-in/profile actions stay on the storefront account surfaces. Apex-domain `/login` and `/admin/*` requests hand off to the portal hostname.

### Customer account area

- `/account`
- `/orders`
- `/quotes`

These use the storefront layout and a separate customer account auth flow. The customer session is backed by a distinct HttpOnly cookie and customer-token audience; it never grants access to the ERP portal. Customer profile and order-history reads must remain server-filtered to the authenticated customer.

### Private operations portal

- `/login`
- `/admin`
- `/admin/inventory`
- `/admin/suppliers`
- `/admin/products`
- `/admin/crm`
- `/admin/directory`
- `/admin/operations`
- `/admin/orders` compatibility alias
- `/admin/reports`
- `/admin/settings`

The old `/admin/signin` path redirects to `/login` for bookmark compatibility. The portal login page reuses the public Stroane site header and footer so staff retain a clear storefront handoff; its header, footer, search, cart, and informational links point back to `https://stroanesolutions.com`. Protected `/admin/*` routes render inside the shared `@faako/ui` ERP shell with a portal sidebar, topbar, and mobile bottom navigation, without storefront chrome. Active modules currently include the dashboard, inventory, orders, receipts, accounting, and CRM/directory. Other module routes remain reset placeholders for the next rebuild.

## Frontend Surface Split

The same Vite workspace can build two Cloudflare Pages surfaces:

- `VITE_APP_SURFACE=storefront`: loads public storefront providers and routes. Portal modules are lazy chunks and are not fetched by storefront browsers.
- `VITE_APP_SURFACE=portal`: loads portal providers and protected routes without mounting storefront cart/customer providers.
- Localhost with `VITE_APP_SURFACE` blank: exposes a combined compatibility mode for local development and Playwright tests.

## Auth Boundaries

- Staff auth calls backend `POST /api/auth/login`, stores only staff profile metadata in `sessionStorage`, and relies on an HttpOnly staff cookie for protected admin APIs. Legacy bearer headers remain accepted only for transition tooling/tests.
- Customer auth calls `/api/customer/*`, stores only a non-secret profile shell in `sessionStorage`, and relies on a separate HttpOnly customer cookie for private customer APIs.
- Keep both staff and customer cookies host/scope limited. Introduce a parent-domain cookie or `SameSite=None` only after a dedicated CSRF and subdomain-risk review.
- Frontend `RequireAdminAuth`, `RequirePortalAccess`, and customer account UI guards improve navigation only. Backend admin/customer authorization remains the security enforcement point.
- `ADMIN` and `VIEWER` portal roles may read operational screens. Backend APIs continue to enforce admin-only writes.

## Shared Shell

Stroane reuses `ErpShellFrame`, `ErpPageContent`, `ErpNavSidebar`, `ErpShellTopbar`, `ErpBottomNav`, and `useSidebarCollapsedState` from `@faako/ui`.

The pattern is structurally aligned with REEBS Portal while keeping Stroane-specific navigation and business modules separate.

The `/admin` entry screen is a restrained operational dashboard rather than a marketing-style or full-ERP analytics surface. It uses existing protected APIs to present:

- KPI tiles for catalogue products, tracked inventory, available units, reserved units, low-stock items, out-of-stock items, draft products, and active suppliers
- catalogue-readiness indicators for publication, stock tracking, and supplier-link coverage
- low-stock, out-of-stock, and reorder attention items
- recent inventory movements
- module links for inventory, orders, receipts, accounting, CRM, suppliers, products, and operations routes

Each data source degrades independently. If one protected API is temporarily unavailable, the portal keeps the remaining operational context visible and shows a safe partial-data notice.

## Future Work

- Add deeper CRM detail editing/audit history once customer-account workflows are accepted in development.
- Add token expiry handling and a server-backed session strategy before expanding staff account management.
- Keep catalogue persistence, supplier operations, inventory transitions, alert cooldowns, and portal auth app-owned. Reuse shared packages for pure sanitizers, security baselines, and ERP presentation primitives only.
