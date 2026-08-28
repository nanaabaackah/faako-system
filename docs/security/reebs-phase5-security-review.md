# REEBS Phase 5 security and data-integrity review

Status: implementation review complete; the Phase 5 migration has been created but was not applied to any database.

Last reviewed: 2026-08-15

## Security architecture discovered

REEBS Portal and the website share the function handlers under
`apps/reebs-portal/backend/functions`. The Express adapter converts requests into
the handler event shape and applies shared request IDs. Browser staff sessions use
an HMAC-signed `reebs_user_session` HttpOnly cookie whose payload identifies a
database-backed `userSession`. The server reloads the user, organisation and role
for each request. Manager mobile access is a separate bearer-token boundary.

The server-side trusted identity fields are the authenticated user ID,
organisation ID, role, database session-token ID and system-administrator email.
Request bodies, query strings and `X-Organization-Id` are selectors only and are
not proof of identity or organisation ownership.

The public website has guest catalogue, customer-resolution, booking and contact
flows. It does not currently have a separate authenticated customer principal.
Consequently, there is no customer-owned order/invoice history API to authorize;
guest APIs must return only checkout-required data. A future account area must add
a customer session and derive its customer ID server-side before exposing history.

## Access matrix

| Principal | Authentication | Allowed boundary | Explicitly denied boundary |
| --- | --- | --- | --- |
| Public | None | Public catalogue/availability, guest contact, constrained customer resolution, guest booking | Staff lists, finance, documents, audit, Water administration |
| Customer | Not implemented as a server principal | No protected customer-history API exists | Staff/admin and other-customer records |
| Staff | Database-backed user session and role capability | Assigned core operational capabilities | Accounting/admin/Water unless the role explicitly grants them |
| Admin | Database-backed user session | Broad organisation administration | Cross-organisation access unless system-admin/explicit assignment rules allow it |
| Water | Database-backed user session with `water:read`/`water:write` | Water-only dashboard and mutations | Core orders, bookings, customers, inventory and finance |
| Platform/system | Configured system-admin identity or signed service secret | Explicit cross-org/service workflow only | Browser role inference or client-supplied scope |

Owner/admin remain deliberate wildcard business-administrator roles. Manager is a
core role and no longer inherits Water. Consolidated reporting is not currently
implemented; no missing scope implies consolidation.

## Confirmed findings and disposition

### REEBS-P5-001 — High — revocation-bypassing legacy user bearer tokens — fixed

`_shared/userAuth.js` previously accepted signed user tokens without a
`sessionTokenId` and fell back to a user-row lookup. Such tokens could not be
revoked by logout or password reset. Cookie selection also occurred after bearer
selection. The browser now selects the cookie first and every accepted user token,
including bearer compatibility tokens, must resolve to an active database session.
Manager-mobile bearer tokens remain a separate required consumer.

Impact before fix: a copied historical user token could remain usable until its
signature expiry despite a session revocation. Mitigation if rollback is required:
rotate `USER_APP_SECRET`, which signs out all user sessions.

### REEBS-P5-002 — High — manager inherited Water access — fixed

The core manager role appeared in both `ROLE_PERMISSIONS` Water grants and the
Water route/navigation role lists. Manager no longer receives `water:read` or
`water:write`; Water handlers require both an allowed Water role and the Water
permission. Water users do not inherit core permissions.

Impact before fix: a core manager could view Water revenue, expenses, payments and
profitability without an explicit Water assignment.

### REEBS-P5-003 — High — public customer creation could overwrite customer data — fixed

The unauthenticated customer-create compatibility flow used an upsert that changed
an existing customer's name and phone. Guest checkout now receives only `id` and
`name`, and an email conflict leaves the existing record unchanged. Authenticated
staff updates retain their existing behavior and require `customers:write`.

Impact before fix: an attacker knowing a customer email could alter contact data.

### REEBS-P5-004 — High — privileged role creation — fixed

Organisation admins with `users:write` could create Owner, Admin, Manager or Water
accounts. Only the configured system administrator may now assign privileged or
Water roles and custom permission payloads. Standard admins may create Staff,
Warehouse and Driver users. Role, permission and password changes revoke the
target user's active sessions and emit an access audit event.

### REEBS-P5-005 — High — duplicate manual payment posting on retry — fixed pending migration

Payment writes had no persisted command key. Repeating a timed-out request could
create another payment, receipt, journal effect and potentially another downstream
event. `orderPayment` now has an organisation-scoped idempotency key. Payment
clients send `Idempotency-Key`; the server locks the order, rejects reuse for a
different order/amount, and returns the original payment/receipt on replay.

The required migration is
`apps/reebs-portal/prisma/migrations/20260815090000_phase5_payment_webhook_integrity/migration.sql`.
It must be deployed before the matching application code.

### REEBS-P5-006 — High — Water webhook replay/status regression — fixed pending migration

The Water MoMo handler used a shared header secret and amount comparison but did
not persist webhook delivery identity and allowed a paid sale to return to pending
or unpaid. It now validates JSON/body size, validates GHS when currency is
provided, requires a settled amount for a paid notification, locks the Water sale,
persists a SHA-256 delivery fingerprint in the same transaction, and prevents
paid-state downgrades. Replays return a successful no-op.

Provider-native signature verification cannot be claimed: the currently
integrated contract supplies `X-Water-Webhook-Secret`, not a documented provider
signature. Confirm the production provider's exact signature/raw-body contract
before enabling a new provider.

### REEBS-P5-007 — Medium — cookie mutation CSRF depended only on Fetch Metadata — fixed

Central authenticated mutation authorization now requires an allowed `Origin` or
same-origin/same-site Fetch Metadata for cookie requests and fails closed when both
are absent. A request carrying both cookie and Bearer credentials remains cookie-
authenticated and cannot use the Bearer header to bypass this check. Session-bound
non-browser bearer clients remain supported. Logout uses
the same origin rule. `SameSite=Lax`, HttpOnly cookies and exact credentialed CORS
remain defense-in-depth.

### REEBS-P5-008 — Medium — production CORS included localhost defaults — fixed

Localhost origins are defaults only outside production. Production accepts the
REEBS origins plus explicitly configured deployment origins. An explicit bad
production environment value can still weaken this boundary and must be checked
at deployment.

### REEBS-P5-009 — Medium — upload size/type and legacy tenant fail-open — fixed

The document handler trusted a client-reported size and declared MIME type, and it
could issue unscoped queries if `document.organizationId` was absent. It now uses
decoded byte length, checks file signatures for supported binary formats, rejects
NUL-containing text, strips path components from filenames and fails closed when
the tenant column is unavailable. The existing 10 MB limit remains unchanged.
Malware scanning/quarantine is not present and remains a production risk.

### REEBS-P5-010 — Medium — login lacked an IP request limiter — fixed

Account lockout existed, but unknown identifiers could generate unbounded login
work. Login now uses the existing database-backed fixed-window limiter before the
account lookup. Public customer resolution/creation also has a database-backed IP
limit. Manager login, forgot password, contact, bookings and Water already use
their established limits.

### REEBS-P5-011 — Medium — arbitrary order status regression — fixed

Order metadata updates normalized unknown states back to the current state and
allowed direct regressions. A server transition matrix now permits same-state or
forward operational changes only. Cancellation remains its existing explicit
flow, and paid/completed states still require the trusted server balance.

### REEBS-P5-012 — Medium — Railway webhook secret/log disclosure patterns — fixed

The Railway webhook no longer accepts a secret in the query string, uses a
timing-safe comparison, enforces a 256 KB body limit and returns a safe server
error. Existing `auditLog.externalRef` uniqueness provides persistent replay
de-duplication.

### REEBS-P5-013 — High — vulnerable REEBS development-tool dependencies — fixed

The dependency advisory scan identified high-severity issues in the portal's Vite
development server and transitive lodash, brace-expansion and js-yaml tooling.
Portal Vite is pinned to the patched 6.4.3 line and narrow package overrides select
the patched transitives without a major framework upgrade. These packages are
development/build/test dependencies rather than deployed API request handlers, but
the vulnerable Vite server could expose local files during development.

The repository-wide audit decreased from 26 to 14 high findings. No remaining high
advisory has a REEBS Portal or REEBS Website dependency path; the remaining paths
belong to Dev ERP, Faako ERP, Stroane, byNana Portfolio or root TypeScript tooling
and must be remediated in those owners' scopes.

## Preserved integrity controls

- Order pricing loads products and variants server-side and calculates cents on
  the server. The order total is not taken from the browser.
- Shop order creation and payment posting run in transactions. Product/variant
  rows use `FOR UPDATE`, stock movement references prevent duplicate stock commits,
  and order idempotency is organisation-scoped.
- Booking creation revalidates products, maintenance state and same-date
  availability inside the final transaction. Variants use row locks; standard
  products use transaction advisory locks keyed by product and date.
- Invoice and document lookups include organisation ID. Accounting, invoices,
  expenses, audit and analytics use server permissions and organisation context.
- Core analytics reads core `order`, `booking`, `product`, `stockMovement` and
  `customer` tables. Water analytics reads the dedicated Water tables and returns
  an explicit Water scope. No combined endpoint exists.
- Water stock derives only from Water restock, sale and adjustment records. Core
  booking/order stock paths do not write those tables.

## Public endpoint and rate-limit inventory

Public reads include catalogue/inventory projections, inventory counts, booking
availability, website content and public statistics. Public interactive routes
include contact, constrained customer lookup/create, guest booking, login,
password recovery and manager login. Webhooks are public transport endpoints but
require their service secret.

Public catalogue DTOs exclude purchase cost, internal notes, audit data and
session data. Customer lookup returns only checkout-required identity. Customer
mutation bodies are limited to 16 KB and name/email/phone lengths and email shape
are validated server-side. The shared
database limiter is safe across application instances, but invalid webhook
requests that are rejected before a database connection still depend on platform
edge rate limiting. Configure Cloudflare/Railway request limits for login,
password reset, customer resolution, contact, booking and webhook routes.

## IDOR review

Representative order, payment, booking, customer, invoice, document, inventory,
expense, journal, audit and Water identifier queries were inspected. Protected
queries use the authenticated organisation ID and return a safe 404 when the
record is outside that organisation. Public customer ID detail and unfiltered
lists return 401. Water IDs are queried only in Water tables and include the
authenticated organisation; core IDs do not alias Water IDs.

There is no authenticated customer-resource API on which to run User A/User B
ownership tests. Adding such a route without a customer principal is prohibited.

## Database least privilege and RLS readiness

`apps/reebs-portal/migrations/rls_tenant_isolation.sql` is preparation, not proof
of production enforcement. It creates a restricted `reebs_app` role, organisation
context helpers and forced tenant policies. Do not apply it directly to production.
First test two organisations in staging, including authentication queries that run
before organisation context is set, background jobs, public-org reads and pooled
connection cleanup.

Runtime handlers still execute `CREATE TABLE`/`ALTER TABLE IF NOT EXISTS` for
legacy compatibility. That prevents an immediate switch to a truly least-
privileged runtime role. Move those DDL checks into reviewed migrations, then
grant the application role only required DML, sequence use and approved function
execution. The migration/deployment role must remain separate from the runtime
role. Verify that the deployed `DATABASE_URL` user is not a superuser, table owner,
`BYPASSRLS`, database creator or role creator.

## Migration deployment runbook

1. Back up and verify restore procedures for the target environment.
2. Run migration status with the environment-specific deployment role.
3. Apply `20260815090000_phase5_payment_webhook_integrity` before application code.
4. Verify the order-payment unique index and Water webhook event table exist.
5. Deploy the API and portal together so payment clients send idempotency keys.
6. Replay one non-production payment command and one Water webhook; verify one
   payment, one receipt, one stock effect and a no-op replay.
7. Monitor safe request IDs, 409 responses and webhook errors. Roll back the
   application first if necessary; retain the additive schema.

## Verification completed

- Portal Node suite: 122 tests passed, including negative organisation scope,
  capability, role escalation, cookie/Bearer selection, payment replay, Water
  state transition, file signature and core-versus-Water analytics tests.
- Website Node suite: 10 tests passed. Static audit: 1,125 HTML routes, 22 rental
  detail pages, 1,045 shop detail pages and 18 linked assets passed.
- Website Playwright smoke: passed against local built output with external calls
  blocked and API fixtures; covered core routes, all rental details, cart, mobile
  navigation, status pages, hydration and horizontal overflow.
- Portal and website production builds passed. Website Astro typecheck reported
  125 files with zero errors, warnings or hints.
- Website lint passed. Portal lint passed with zero errors and 11 pre-existing
  React Hook/Fast Refresh warnings outside the Phase 5 changes.
- Prisma schema validation, repository security scan and security gate passed.
- Dependency advisory scan remains non-zero repository-wide: 62 total findings
  (8 low, 40 moderate, 14 high), with no high path owned by either REEBS app.

## Phase 5 file inventory

- Authentication, request and capability boundaries: `_shared/http.js`,
  `_shared/userAuth.js`, `_shared/accessControl.js`, `login.js`, `staffProfile.js`,
  `users.js`, `bookings.js`, `inventory.js`, `userStats.js`, `water.js`.
- Payments, webhooks and public/file handlers: `_shared/shopOrders.js`,
  `_shared/auditLog.js`, `orderPayments.js`, `orders.js`, `customers.js`,
  `documents.js`, `water-momo-webhook.js`, `railwayEvents.js`.
- Portal consumers: `src/pages/Orders/hooks/useOrderPayments.js`,
  `src/pages/OrdersList/OrdersList.jsx`, `src/utils/adminAccess.js`, and
  `src/config/adminNavigation.js`.
- Tests: `_shared/http.test.js`, `_shared/accessControl.test.js`,
  `_shared/userAuth.security.test.js`, `_shared/shopOrders.test.js`,
  `documents.security.test.js`, `users.authorization.test.js`, and
  `water-momo-webhook.security.test.js`.
- Schema/dependencies: `prisma/schema.prisma`, the Phase 5 migration,
  `apps/reebs-portal/package.json`, root `package.json`, and `pnpm-lock.yaml`.
- Documentation: this review, `reebs-water-domain.md`,
  `reebs-payment-data.md`, `authentication-current-state.md`, and
  `authorisation-current-state.md`.

## Manual and production verification required

- Validate login, logout and session revocation through each production hostname.
- Confirm every production allowed origin and cookie domain; ensure no localhost
  or preview origin is configured unintentionally.
- Confirm manager-mobile is the only approved non-browser bearer consumer.
- Exercise admin user creation rules and Water route denial with real roles.
- Exercise guest checkout with a new and an existing email and verify the existing
  customer's contact data cannot change.
- Validate payment replay, receipt/journal/stock counts and Water webhook replay in
  an isolated staging database after the migration.
- Verify provider webhook secret/signature and currency semantics against current
  provider documentation.
- Validate RLS and runtime database grants with two staging organisations.
- Configure edge request/body limits and secret rotation/incident procedures.

## Remaining risks and Phase 6 candidates

- Authenticated REEBS customer accounts and customer-owned order/invoice APIs do
  not exist. Design them separately with a customer session and ownership tests.
- Runtime DDL blocks full database least privilege and makes RLS activation unsafe
  without a staged migration programme.
- Water currently links an optional generic customer row for sale context. A
  dedicated Water customer persistence boundary needs an approved data migration
  before changing existing behavior.
- The Water webhook uses a configured shared secret rather than a proven
  provider-native signature. Upgrade only against an approved provider contract.
- Upload malware scanning/quarantine and private object storage are absent.
- Some legacy tables retain compatibility checks for missing organisation columns.
  Remove those fallbacks after schema inventory and migration verification.
- Guest checkout can still resolve a minimal numeric customer ID and name from a
  known identifier. No protected data is reachable through that ID, but a future
  checkout-token design would reduce enumeration further.
- Fine-grained stored UI permission booleans are not the server capability model;
  role capabilities remain authoritative. Unify only through an approved migration.
- Persistent public limits need platform-edge counterparts and operational
  dashboards. Do not introduce Redis solely for this phase.
- CSV/spreadsheet formula neutralization must be enforced in any future export
  endpoint; no new general export implementation was added here.
- Production secret age, database role attributes, edge configuration, provider
  settings and applied migrations cannot be proven from source inspection.
