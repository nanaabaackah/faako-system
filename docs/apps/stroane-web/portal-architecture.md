# Stroane Portal Architecture

## Purpose

Keep the customer-facing Stroane storefront, future customer account area, and private staff operations portal structurally separate at both route and hostname level.

## Production Hosts

- `https://stroanesolutions.com`: public storefront only.
- `https://www.stroanesolutions.com`: public storefront alias.
- `https://portal.stroanesolutions.com`: private operational portal only.
- `https://stroane-api-production.up.railway.app`: Railway API for both browser surfaces.

## Route Areas

### Public storefront

- `/`
- `/catalogue`
- `/shop`
- `/products`
- `/products/:slug`
- public informational pages
- `/signup`

The storefront uses the public website layout. Public sign-in actions and the legacy `/signin` route redirect to `https://portal.stroanesolutions.com/login`. Apex-domain `/admin/*` requests also hand off to the portal hostname.

### Future customer account area

- `/account`
- `/orders`
- `/quotes`

These remain safe storefront placeholders only. They do not render the ERP shell, expose backend order data, or provide a server-enforced customer session yet.

### Private operations portal

- `/login`
- `/admin`
- `/admin/inventory`
- `/admin/suppliers`
- `/admin/products`
- `/admin/operations`
- `/admin/orders` compatibility alias
- `/admin/reports`
- `/admin/settings`

The old `/admin/signin` path redirects to `/login` for bookmark compatibility. Protected `/admin/*` routes render inside the shared `@faako/ui` ERP shell with a portal sidebar, topbar, and mobile bottom navigation.

## Frontend Surface Split

The same Vite workspace can build two Cloudflare Pages surfaces:

- `VITE_APP_SURFACE=storefront`: loads public storefront providers and routes. Portal modules are lazy chunks and are not fetched by storefront browsers.
- `VITE_APP_SURFACE=portal`: loads portal providers and protected routes without mounting storefront cart/customer providers.
- Localhost with `VITE_APP_SURFACE` blank: exposes a combined compatibility mode for local development and Playwright tests.

## Auth Boundaries

- Staff auth calls backend `POST /api/auth/login`, stores the short-lived portal token in `sessionStorage`, and sends it as a bearer token to protected admin APIs.
- Because `sessionStorage` is origin-scoped, the token remains on `portal.stroanesolutions.com` and is not shared with the public storefront.
- Stroane staff auth does not currently use cookies, so no `.stroanesolutions.com` parent-domain cookie is required.
- If cookie sessions replace bearer tokens later, prefer secure, HTTP-only, host-only cookies. Introduce a parent-domain cookie only after a dedicated CSRF and subdomain-risk review.
- Frontend `RequireAdminAuth` and `RequirePortalAccess` guards improve navigation only. Backend bearer authorization remains the security enforcement point.
- `ADMIN` and `VIEWER` portal roles may read operational screens. Backend APIs continue to enforce admin-only writes.

## Shared Shell

Stroane reuses `ErpShellFrame`, `ErpPageContent`, `ErpNavSidebar`, `ErpShellTopbar`, `ErpBottomNav`, and `useSidebarCollapsedState` from `@faako/ui`.

The pattern is structurally aligned with REEBS Portal while keeping Stroane-specific navigation and business modules separate.

## Future Work

- Replace frontend-only customer placeholders with server-backed account auth before exposing customer records.
- Add token expiry handling and a server-backed session strategy before expanding staff account management.
- Keep catalogue persistence, supplier operations, inventory transitions, alert cooldowns, and portal auth app-owned. Reuse shared packages for pure sanitizers, security baselines, and ERP presentation primitives only.
