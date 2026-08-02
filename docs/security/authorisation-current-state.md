# Authorisation current state

Last reviewed: 2026-07-26

## 2026-07-26 standardisation update

The shared target model is now defined in
[`roles-and-permissions.md`](./roles-and-permissions.md). The authentication
implementations described below remain unchanged.

- REEBS user creation/update now requires the existing `users:write`
  permission. Driver read compatibility is retained.
- REEBS role names no longer grant arbitrary cross-organisation selection;
  explicit server-owned assignments or the configured system administrator are
  required.
- Stroane order list/detail reads now enforce the existing `orders.view`
  permission on the backend. Other sensitive read modules identified below
  remain migration work.
- Dev ERP and Stroane frontend/backend code now share their module/action
  identifier lists through `@faako/security`.

Historical findings below remain useful evidence. Where they conflict with this
update, the update describes the current implementation.

## Security boundary

React route guards, hidden navigation, disabled buttons, and browser-stored roles
are presentation controls. They are not an authorisation boundary. A protected
operation is secure only when its backend independently verifies the authenticated
principal, role or permission, resource ownership, and organisation scope.

## Application summary

| Application | Frontend controls | Backend controls | Organisation boundary | Current assessment |
| --- | --- | --- | --- | --- |
| Dev ERP | Auth and module route guards | Session middleware, admin/global-admin checks, capability middleware, organisation read/write scope helpers | User organisation by default; explicit global-admin exception | Broadly layered; password/session invalidation gap remains |
| REEBS Portal | Auth, role, and route matrices | Database session, static role-permission map, endpoint helpers | Session organisation plus explicit assignment/system-admin exception | User-mutation and role-only cross-tenant bypasses remediated; RLS/deployment verification remains |
| REEBS Website | Mostly public; compatibility auth state changes UI | Public endpoints plus shared REEBS backend | Configured public organisation | Public/private ownership remains mixed |
| Stroane staff portal | Auth, role, module, and action guards | Active-user lookup and permission middleware on mutations and order reads | Single business dataset; no tenant dimension | Order reads remediated; other sensitive reads still need matching view checks |
| Stroane customer account | Customer route UI | Customer cookie and customer-ID-scoped queries | Per-customer ownership | Server ownership checks are present |
| Faako ERP | Demo overlay only | Code-verification endpoint does not protect ERP data routes | None | Frontend-only demo gate |
| Faako Website | No protected routes found | No auth backend | None | Authentication-looking UI is not a security feature |
| Portfolio, Faako API, System Starter, UI Workbench, TTNGH | No application authorisation | No protected application API found | None | Public/reference/generated-output scope |

## Dev ERP

### Backend enforcement

- `createAuthMiddleware` accepts a bearer token or access cookie, verifies it, and
  attaches the current database-backed session user
  (`apps/dev-erp/backend/auth/auth.middleware.js:14-47`).
- Session validation reloads the active user, role, organisation, and module
  permissions on each request and checks `tokenVersion`
  (`apps/dev-erp/backend/server.js:1915-1945`).
- Admin routes use `requireAdmin`; explicitly global operations use
  `requireGlobalAdmin` (`apps/dev-erp/backend/auth/auth.middleware.js:76-81`;
  `apps/dev-erp/backend/server.js:5021-5027`).
- Capability middleware maps API paths to allowed modules and rejects a
  non-admin user without the required capability
  (`apps/dev-erp/backend/auth/capabilities.js:32-88`).
- Organisation read scope defaults to the authenticated organisation. Only the
  configured global admin can select all or another organisation
  (`apps/dev-erp/backend/organizations/scope.js:96-154`).
- Organisation write scope similarly rejects a different organisation unless the
  principal is a global admin (`scope.js:156-197`).

### Frontend-only checks

- `PrivateRoute` redirects unauthenticated users
  (`apps/dev-erp/src/App.jsx:95-101`).
- `ModuleScopeRoute` redirects users away from browser routes outside their module
  list (`App.jsx:474-492`).
- Page-level checks such as `storedUser.role.name === "Admin"` affect UI behavior
  only. Backend middleware must remain authoritative.

### Residual risks

- The capability middleware returns `next()` when a mapped endpoint is requested
  without an authenticated payload (`capabilities.js:57-60`). This is safe only
  where the endpoint itself also mounts `authMiddleware`; the two middleware
  registrations must remain paired.
- Global-admin status is email-configured and role-gated
  (`apps/dev-erp/backend/organizations/scope.js:47-54`). Production configuration
  and administrative email-change controls are part of the trust boundary.

## REEBS

### Server role and permission model

- The shared model maps `owner`, `admin`, `manager`, `warehouse`, `staff`,
  `driver`, and `water` to permission strings. Owner/admin and the configured
  system-admin email receive broad access
  (`apps/reebs-portal/backend/functions/_shared/accessControl.js:9-105`).
- `requireInternalUser`, `requireAdmin`, `requireManager`, and
  `requirePermission` authenticate the session, check the role/permission, resolve
  an organisation, and attempt to apply database organisation context
  (`accessControl.js:142-237`).
- Many operational functions use these helpers, including orders, inventory,
  finance, documents, invoices, reports, and audit logs.

### Critical privilege escalation

`apps/reebs-portal/backend/functions/users.js` authenticates the caller but does
not require an admin role or `users:write` permission before `POST`:

- any authenticated user reaches the create branch (`users.js:87-121`);
- the request may choose any accepted role, including `Owner` or `Admin`, and
  provide arbitrary permissions (`users.js:121-156`);
- the new account is created in the attacker's organisation.

Although existing-user role changes are limited to the hard-coded system admin
(`users.js:168-203`), that does not prevent a lower-privileged user from creating a
new elevated account. This is a server-side privilege escalation, not merely a
frontend-guard issue.

### Tenant isolation

- Authenticated sessions bind a user ID and organisation ID to a database session
  (`apps/reebs-portal/backend/functions/_shared/userAuth.js:193-228`).
- The client automatically sends an organisation ID from its stored user or even
  the URL query string (`packages/core/src/organization.ts:251-259`, `305-343`).
  Client-supplied organisation identifiers must therefore be treated as
  untrusted selectors.
- `resolveAuthorizedOrganizationId` permits any `owner` or `admin`, not just the
  system administrator, to replace the authenticated organisation with any
  existing organisation ID
  (`apps/reebs-portal/backend/functions/_shared/organization.js:107-152`).
- That permissive owner/admin list is also the default in the central access
  helper, and no endpoint overrides were found
  (`apps/reebs-portal/backend/functions/_shared/accessControl.js:142-153`,
  `184-195`).

Consequently, a tenant owner/admin who knows or guesses another organisation ID
can cause shared internal endpoints to execute in that organisation. This is the
primary tenant-isolation blocker.

### RLS status

The repository includes an RLS script that enables and forces organisation
policies (`apps/reebs-portal/migrations/rls_tenant_isolation.sql:65-163`), but:

- the script explicitly requires an out-of-band restricted database role and a
  `DATABASE_URL` change (`rls_tenant_isolation.sql:6-33`);
- repository inspection cannot prove it was applied;
- normal session authentication queries run before
  `applyRequestOrganizationContext`, so activating fail-closed RLS requires
  careful connection/transaction sequencing
  (`userAuth.js:193-228`; `accessControl.js:165-192`).

RLS must therefore be treated as unverified defense-in-depth, not the current
authoritative tenant boundary.

### Frontend-only checks

- The portal has `RequireAuth`, `RequireRole`, and `RequirePortalAccess` wrappers
  (`apps/reebs-portal/src/App.jsx:98-142`).
- The browser role matrix decides which pages and navigation entries are visible
  (`apps/reebs-portal/src/utils/adminAccess.js:12-16`, `70-145`).
- Individual pages also compute booleans such as `canManageBookings` and
  `canAccessInvoicing`.

These checks are useful UX only. They did not prevent the `users.js` privilege
escalation and cannot constrain direct API requests.

### Other server-side inconsistencies

- Any authenticated user can list organisation users, permissions, session
  counts, last-seen timestamps, IP addresses, and user agents; only drivers receive
  a reduced record (`apps/reebs-portal/backend/functions/users.js:286-374`).
- Some older functions use bespoke `requireUser` checks rather than the central
  permission helpers, increasing the chance of inconsistent role behavior.
- Public and authenticated behavior coexist in functions such as customers,
  bookings, and website content. Public requests are scoped to a configured
  organisation, while authenticated requests use the session organisation
  (`apps/reebs-portal/backend/functions/customers.js:71-131`).

## Stroane

### Server role and permission model

- System roles are `ADMIN`, `OWNER`, `VIEWER`, and `CUSTOM`. Admin/owner receive
  all permissions, viewer receives selected read permissions, and custom roles
  use a stored module/action matrix
  (`apps/stroane-web/backend/src/adminAuth.js:11-27`, `55-114`).
- `requireSiteUser` verifies the token, reloads the active user and role, and
  attaches normalized access (`adminAuth.js:122-167`).
- `requireAdminRole` applies a specific module/action permission and is used by
  product, inventory, alert, and many mutation routes
  (`adminAuth.js:169-181`).
- Frontend route guards mirror the role and module/action model
  (`apps/stroane-web/src/portal/components/RequireAdminAuth.tsx:6-25`;
  `RequirePortalAccess.tsx:27-59`).

### Permission checks missing from sensitive reads

Several admin routers authenticate every allowed portal role, including `CUSTOM`,
but do not apply the corresponding `view` permission to their GET routes:

- orders list/detail
  (`apps/stroane-web/backend/src/ordersAdmin/routes.js:183-215`);
- customer list/detail, including linked orders and spend
  (`apps/stroane-web/backend/src/customerAccounts/routes.js:671-719`);
- accounting overview and expenses
  (`apps/stroane-web/backend/src/accounting/routes.js:646-703`);
- receipt list/detail/download
  (`apps/stroane-web/backend/src/receipts/routes.js:232-269`, `306-326`).

The React portal may redirect a custom role without the view permission, but a
direct request succeeds because the server checks only that the role name is one
of the portal roles. This is a frontend-only permission boundary for those reads.
By comparison, product and inventory GET routes correctly call
`requireAdminRole(..., "view")`
(`apps/stroane-web/backend/src/products/routes.js:10-16`;
`apps/stroane-web/backend/src/inventory/routes.js:10-36`).

### Customer ownership

- Customer API middleware derives the current customer solely from the signed
  customer cookie and reloads the account from the database
  (`apps/stroane-web/backend/src/customerAccounts/routes.js:185-206`).
- Profile routes use `req.customer.id`, and order history filters by that customer
  ID or the authenticated customer's email
  (`customerAccounts/routes.js:614-665`).

No client-supplied customer ID is used to select another customer's account in
the audited customer routes.

### Tenant model

Stroane currently operates as a single business dataset. Site users, products,
orders, receipts, and customers do not carry an organisation boundary in the
audited access layer. If Stroane becomes multi-tenant, tenant ownership must be
added as a new server and database invariant; the current role model alone is not
a tenant-isolation control.

## Faako public and demo applications

### Faako ERP

`DemoAccessGate` conditionally hides the React UI based on a browser-stored,
unsigned descriptor (`apps/faako-erp/src/components/DemoAccessGate.jsx:32-92`;
`apps/faako-erp/src/utils/demoAccessSession.js:16-33`). There is no protected ERP
API behind the gate. All demo data and code delivered to the browser must be
treated as public. The gate must not be reused for customer, employee, finance, or
other sensitive data.

### Faako Website

The current login and recovery pages do not call a backend, and no protected route
uses the in-memory `AuthContext`. Claims of role-based access are therefore
aspirational UI copy, not implemented authorisation
(`apps/faako-website/src/pages/Login.jsx:51-105`;
`apps/faako-website/src/contexts/AuthContext.jsx:1-25`).

### Faako API

The API declares `authMode: "none"` and exposes public intake/demo endpoints
(`apps/faako-api/appSystem.js:13`). It must not add administrative read or mutation
routes without a separate authenticated, server-enforced access design.

## Explicit frontend-only security checks

1. Faako ERP demo access overlay and browser expiry.
2. Faako Website login/recovery validation and all current auth copy.
3. Dev ERP React private/module route redirects (backed by server controls for API
   access, but not security controls by themselves).
4. REEBS Portal route/role/navigation matrix.
5. REEBS page-level edit/manage booleans.
6. Stroane `RequireAdminAuth` and `RequirePortalAccess`.
7. Stroane custom-role read restrictions for orders, customers, accounting, and
   receipts, because equivalent server view checks are missing.

## Authorisation invariants for future work

1. Never accept an organisation ID because it came from a stored user, query
   string, header, or request body. Resolve it against server-owned memberships.
2. Only a deliberately scoped platform/system administrator may cross tenants.
3. Every sensitive endpoint must state its required role or module/action
   permission in backend routing code.
4. Every object lookup must include the authenticated owner/organisation scope.
5. Browser route guards must mirror server policy but never substitute for it.
6. Password or privilege changes must invalidate affected sessions where the
   threat model requires it.
7. RLS is defense-in-depth only after its deployment, database role, context
   lifetime, pooling, and failure behavior have been tested.
