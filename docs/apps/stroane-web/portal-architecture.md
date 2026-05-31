# Stroane Portal Architecture

## Purpose

Keep the customer-facing Stroane storefront, future customer account area, and private staff operations portal structurally separate.

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

These routes use the public website layout. `/signin` and `/signup` are customer-only placeholders and do not attempt backend staff authentication.

### Future customer account area

- `/account`
- `/orders`
- `/quotes`

These routes are safe placeholders only. They do not render the ERP shell, expose backend order data, or provide a server-enforced customer session yet.

### Private operations portal

- `/admin/signin`
- `/admin`
- `/admin/inventory`
- `/admin/suppliers`
- `/admin/products`
- `/admin/operations`
- `/admin/orders` compatibility alias
- `/admin/reports`
- `/admin/settings`

`/admin/signin` is the dedicated staff entrypoint. Protected `/admin/*` routes render inside the shared `@faako/ui` ERP shell with a portal sidebar, topbar, and mobile bottom navigation.

## Auth Boundaries

- Customer placeholder auth remains frontend-only browser state and must never protect private data or operational actions.
- Staff auth calls backend `POST /api/auth/login`, stores the existing short-lived portal token in `sessionStorage`, and sends it as a bearer token to protected admin APIs.
- Frontend `RequireAdminAuth` and `RequirePortalAccess` guards improve navigation and route separation only. Backend bearer authorization remains the security enforcement point.
- `ADMIN` and `VIEWER` portal roles may read operational screens. Backend APIs continue to enforce admin-only writes.

## Shared Shell

Stroane reuses `ErpShellFrame`, `ErpPageContent`, `ErpNavSidebar`, `ErpShellTopbar`, `ErpBottomNav`, and `useSidebarCollapsedState` from `@faako/ui`.

The pattern is structurally aligned with REEBS Portal while keeping Stroane-specific navigation and business modules separate.

## Future Work

- Replace frontend-only customer placeholders with server-backed account auth before exposing customer records.
- Add token expiry handling and a server-backed session strategy before expanding staff account management.
- Add product setup and settings workflows only when their protected API contracts are approved.
- Keep catalogue persistence, supplier operations, inventory transitions, alert cooldowns, and portal auth app-owned. Reuse shared packages for pure sanitizers, security baselines, and ERP presentation primitives only.
