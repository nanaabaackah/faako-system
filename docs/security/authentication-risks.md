# Authentication and authorisation risks

Last reviewed: 2026-07-26

## Executive summary

The repository has three materially different production auth systems rather than
one shared implementation:

- Dev ERP: short-lived cookie access tokens, CSRF protection, and rotating
  database-backed refresh tokens.
- REEBS: fixed-lifetime signed cookie plus database session records, with a
  separate stateless manager PIN/bearer-token system.
- Stroane: fixed-lifetime stateless signed cookies for staff and customers.

The most urgent issues are not identity-provider problems. They are missing or
over-broad server authorization checks in REEBS and Stroane. Introducing Auth0
would not fix them and is explicitly out of scope.

## Remediation status update

As of the authorisation/error/logging standardisation change:

- `SEC-AUTH-001` is remediated: REEBS `POST`/`PUT` user operations require
  `users:write`, with negative role tests.
- `SEC-AUTH-002` is remediated at the application helper: Owner/Admin names no
  longer provide cross-tenant access; explicit assignments or the configured
  system administrator are required. Production RLS/database-role verification
  remains separate defense-in-depth work.
- `SEC-AUTH-003` is partially remediated: Stroane order list/detail reads now
  enforce `orders.view`; customer, accounting, and receipt read routes remain.

No authentication provider, token format, cookie, login, refresh, or session
implementation changed.

## Priority findings

### SEC-AUTH-001 — Any REEBS user can create an Owner or Admin account

- Severity: Critical
- Affected component: `apps/reebs-portal/backend/functions/users.js`
- Evidence: the handler requires only a valid user session at lines 113-120, then
  accepts `owner` and `admin` roles and caller-provided permissions at lines
  121-156.
- Impact: a staff, warehouse, driver, water, or other low-privileged user can
  create a new elevated account in the same organisation and gain administrative
  access.
- Current mitigating control: the account is restricted to the caller's current
  organisation.
- Recommended action: require the central `users:write` permission or owner/admin
  role on create, enforce an allowed role-assignment ceiling, and add negative
  tests for every lower role.

### SEC-AUTH-002 — REEBS tenant owners/admins can select any organisation

- Severity: Critical
- Affected component:
  `apps/reebs-portal/backend/functions/_shared/organization.js` and
  `_shared/accessControl.js`
- Evidence: `resolveAuthorizedOrganizationId` allows any role in
  `["owner", "admin"]` to replace its session organisation with any existing ID
  (`organization.js:107-152`); that list is the central helper's default and no
  endpoint override was found (`accessControl.js:142-195`).
- Impact: a tenant owner/admin can read or mutate another tenant's data through
  endpoints using the shared access helper.
- Current mitigating control: the requested organisation must exist. That is not
  an authorization check.
- Deployment caveat: an RLS script exists, but deployment and restricted-role use
  are unverified, and request context is applied after authentication queries.
- Recommended action: deny cross-organisation selection by default; allow it only
  for a server-owned platform-admin principal with explicit memberships or grants;
  add two-tenant integration tests and verify RLS under the actual pooled database
  role.

### SEC-AUTH-003 — Stroane custom-role view permissions are frontend-only on sensitive APIs

- Severity: High
- Affected components: admin order, customer, accounting, and receipt routers
- Evidence:
  - order GET routes require only one of the portal role names
    (`apps/stroane-web/backend/src/ordersAdmin/routes.js:183-215`);
  - customer list/detail behaves the same
    (`backend/src/customerAccounts/routes.js:671-719`);
  - accounting overview/expense reads behave the same
    (`backend/src/accounting/routes.js:646-703`);
  - receipt list/detail/download behaves the same
    (`backend/src/receipts/routes.js:232-269`, `306-326`).
- Impact: a `CUSTOM` role with the relevant `view` permission set to false can
  bypass React route guards and directly retrieve operational, customer, finance,
  or receipt data.
- Current mitigating control: the caller must be an active Stroane site user.
- Recommended action: mount `requireAdminRole(prisma, module, "view")` on every
  sensitive GET route and add route tests for custom roles with denied view
  permissions.

### SEC-AUTH-004 — REEBS manager PIN failed attempts are not rate-limited

- Severity: High
- Affected component: `apps/reebs-portal/backend/functions/managerLogin.js`
- Evidence: invalid PIN returns at lines 47-60; the database-backed rate check is
  reached only after successful verification at lines 67-85.
- Impact: an attacker can make unlimited guesses against a shared six-digit PIN
  and cause repeated expensive password-hash verification.
- Compounding factors: a successful login returns a seven-day stateless bearer
  token; no logout, revocation, or device-session registry exists for this flow.
- Recommended action: rate-limit by trusted client IP and a stable global/organisation
  key before password verification, use per-manager credentials instead of a
  shared PIN, shorten token lifetime, and add revocable device sessions.

### SEC-AUTH-005 — REEBS forgot-password flow is enumerable and unthrottled

- Severity: High
- Affected component: `apps/reebs-portal/backend/functions/forgotPassword.js`
- Evidence: lines 307-359 return different states for existing usernames, disclose
  whether a phone is on file, accept a phone match, and attach a supplied personal
  email; the handler does not call the shared request limiter.
- Impact: account and recovery-state enumeration, automated phone guessing, reset
  email abuse, and potential account takeover if staff phone data is discoverable
  or weakly controlled.
- Current mitigating controls: the flow is restricted to the configured public
  organisation; reset tokens are strong, hashed, single-use, and expire in 30
  minutes.
- Recommended action: apply pre-lookup IP and identifier limits, return a uniform
  public response, move first-time personal-email enrollment behind an
  administrator or a stronger verified channel, and audit all recovery changes.

### SEC-AUTH-006 — Password changes do not consistently invalidate sessions

- Severity: High
- Affected components: Dev ERP, Stroane, and REEBS administrative password changes
- Evidence:
  - Dev ERP profile password change updates the hash and creates a new cookie but
    does not increment `tokenVersion` or revoke refresh tokens
    (`apps/dev-erp/backend/users/users.routes.js:94-147`);
  - Dev ERP reset/account setup similarly updates only the password/status
    (`apps/dev-erp/backend/auth/auth.controller.js:372-438`);
  - Stroane tokens are stateless for eight hours; logout only clears a cookie
    (`apps/stroane-web/backend/src/auth.js:46-51`,
    `backend/src/routes/auth.js:402-405`);
  - Stroane customer reset issues a new cookie without invalidating old tokens
    (`backend/src/customerAccounts/routes.js:564-605`);
  - REEBS reset correctly revokes all sessions, but an administrator changing a
    password through `users.js` does not (`apps/reebs-portal/backend/functions/users.js:246-265`).
- Impact: a stolen token or session can remain usable after a user believes a
  password change secured the account.
- Recommended action: define a consistent policy: increment a session version or
  revoke all sessions on recovery and administrator-initiated password changes;
  offer an explicit “keep this device” choice only where justified.

### SEC-AUTH-007 — CSRF controls differ and are configuration-sensitive

- Severity: Medium
- Affected components: REEBS and Stroane cookie-authenticated routes; Dev ERP logout
- Evidence:
  - Dev ERP has a double-submit CSRF control but excludes logout
    (`apps/dev-erp/backend/security/csrf.js:1-9`, `24-37`);
  - REEBS relies on `SameSite=Lax` and rejects only
    `Sec-Fetch-Site: cross-site`, with no CSRF token
    (`apps/reebs-portal/backend/functions/_shared/http.js:74-77`;
    `_shared/userAuth.js:146-168`);
  - Stroane customers use a preflight-forcing custom header, but staff/admin
    mutations do not; cookies can be configured to `SameSite=None`
    (`apps/stroane-web/backend/src/customerAccounts/routes.js:125-131`;
    `backend/src/auth.js:57-89`).
- Impact: logout CSRF is possible in some flows; unsafe operations may become
  exposed if cookie domains or SameSite values change, or if same-site sibling
  origins are compromised.
- Recommended action: standardize Origin/Referer validation plus a CSRF token or
  preflight-forcing header for every cookie-authenticated unsafe route, including
  logout. Add tests for cross-site, same-site sibling, missing fetch metadata, and
  `SameSite=None` deployments.

### SEC-AUTH-008 — Rate limits are inconsistent and often process-local

- Severity: Medium
- Affected components: Faako API demo/signup, Stroane API, Dev ERP API, REEBS login
- Evidence:
  - Faako demo challenges and limits use module-level `Map` instances
    (`apps/faako-api/src/demoAccess.js:20-21`, `96-112`);
  - Stroane's limiter uses an in-process `Map`
    (`apps/stroane-web/backend/security.js:73-109`);
  - REEBS has a database-backed limiter, but primary login and forgot-password do
    not use it;
  - Dev ERP rate limiting is process-local in the main Express process.
- Impact: limits reset on restart, differ across replicas, and leave selected
  credential/recovery endpoints insufficiently protected.
- Recommended action: use a shared atomic store or edge rate limit for production
  credential endpoints, define per-identity and per-IP limits, and retain account
  lockout only as a secondary control to avoid account-lockout denial of service.

### SEC-AUTH-009 — Legacy REEBS Web Storage bearer support remains

- Severity: Medium
- Affected component: `packages/core/src/organization.ts`
- Evidence: `getAuthToken` reads `reebs_auth_token` from `localStorage` and
  `sessionStorage`, and also reads a token nested in the stored user object
  (`organization.ts:224-249`).
- Impact: if a legacy client still persists a bearer token, any successful XSS can
  exfiltrate it. The compatibility path also makes it harder to prove the web
  session is cookie-only.
- Current mitigating controls: current REEBS login responses omit tokens; portal
  sanitization strips token fields; `setAuthToken` removes persisted token keys
  (`organization.ts:210-222`).
- Recommended action: inventory active legacy clients, migrate them deliberately,
  remove browser Web Storage reads after a time-bounded compatibility window, and
  keep non-browser bearer authentication in a separate client entry point.

### SEC-AUTH-010 — Faako authentication-looking pages are non-functional

- Severity: Medium
- Affected component: Faako Website
- Evidence: login and forgot-password handlers validate fields but make no API
  request (`apps/faako-website/src/pages/Login.jsx:51-75`;
  `src/pages/ForgotPassword.jsx:23-41`), while the UI claims secure encrypted
  sessions, expiring reset links, and tracked recovery (`Login.jsx:85-105`;
  `ForgotPassword.jsx:51-67`).
- Impact: visitors can be misled into believing credentials or recovery services
  are operational. Future developers may also mistake the in-memory context for a
  security boundary.
- Recommended action: remove/label the placeholder routes until a real backend
  exists, or implement them as a separately scoped project with server-side auth,
  recovery, audit, and abuse controls.

### SEC-AUTH-011 — Faako ERP demo access is forgeable browser state

- Severity: Low
- Affected component: Faako ERP demo
- Evidence: successful verification returns an unsigned descriptor
  (`apps/faako-api/src/demoAccess.js:327-338`); the browser accepts any descriptor
  with an email and future date from `localStorage`
  (`apps/faako-erp/src/utils/demoAccessSession.js:16-33`, `36-84`).
- Impact: anyone can bypass the overlay. This becomes serious only if sensitive
  data or privileged APIs are later placed behind the demo gate.
- Recommended action: explicitly document the demo as public, avoid sensitive
  bundled data, and replace the descriptor with a server-validated session before
  adding protected APIs.

### SEC-AUTH-012 — Security metadata does not match runtime behavior

- Severity: Low
- Affected components: `appSystem.js` metadata
- Evidence: Faako ERP declares cookie auth while using a browser demo descriptor
  (`apps/faako-erp/appSystem.js:75-83`); Stroane declares no auth despite two
  cookie-authenticated systems (`apps/stroane-web/appSystem.js:73-82`).
- Impact: architecture tooling, headers, deployment reviews, and future engineers
  can make incorrect security assumptions.
- Recommended action: define precise metadata values for `none`, `demo-gate`,
  `cookie-session`, and mixed public/authenticated applications, then validate
  metadata against runtime routes in CI.

### SEC-AUTH-013 — REEBS “do not remember” still creates a persistent cookie

- Severity: Low
- Affected components: REEBS login and user-cookie helpers
- Evidence: `remember: false` selects a 12-hour TTL
  (`apps/reebs-portal/backend/functions/login.js:17`, `67-71`), and every positive
  TTL becomes a cookie `Max-Age`
  (`apps/reebs-portal/backend/functions/_shared/userAuth.js:163-166`).
- Impact: a user who declines persistence may reasonably expect the session to
  end when the browser closes, but it can survive browser restart for 12 hours.
- Recommended action: omit `Max-Age`/`Expires` for non-remembered sessions while
  retaining the server-side 12-hour maximum, and add a cookie-attribute test.

## Insecure token storage assessment

No current Dev ERP, REEBS Portal, or Stroane browser login response stores its
privileged session token in `localStorage` or `sessionStorage`. Those flows use
HttpOnly cookies and persist only a profile shell.

The remaining exceptions and risks are:

1. REEBS shared compatibility code can still rehydrate old bearer tokens from Web
   Storage (`SEC-AUTH-009`).
2. The REEBS manager endpoint returns a bearer token; storage in the external
   manager client was not present in this repository and could not be assessed.
3. Faako ERP stores an unsigned demo descriptor in `localStorage`; it is forgeable
   but is not currently a privileged backend credential.
4. Dev ERP stores the CSRF token in `sessionStorage`; this is intentionally
   JavaScript-readable and is not an authentication token.

## Inconsistent implementation inventory

| Concern | Dev ERP | REEBS web | REEBS manager | Stroane | Faako |
| --- | --- | --- | --- | --- | --- |
| Primary session | Access JWT + DB refresh | Signed cookie + DB session | Signed bearer | Signed stateless cookie | None / demo descriptor |
| Server revocation | `tokenVersion` + refresh revocation | Session row revocation | None | None before expiry | None |
| Refresh | Rotating | None | None | None | None |
| CSRF | Double-submit | SameSite + fetch metadata | Not cookie-based | Customer header; admin SameSite/CORS | Not applicable |
| Login abuse | IP/API limit + account lock | Account lock only | Broken failed-attempt limit | In-memory IP limit | In-memory email/IP limit |
| Password reset | Account-setup JWT | Hashed DB token | None | Customer hashed DB token | Placeholder only |
| Tenant boundary | Server organisation helpers | Client selector + over-broad server override | Fixed configured organisation | No tenant model | None |

## Recommended remediation order

1. Fix `SEC-AUTH-001` and add server-side privilege-escalation tests.
2. Fix `SEC-AUTH-002`; add two-tenant integration tests and verify the deployed
   database role/RLS behavior.
3. Fix `SEC-AUTH-003` by enforcing every Stroane view permission on the server.
4. Fix the manager PIN flow and REEBS recovery throttling
   (`SEC-AUTH-004`, `SEC-AUTH-005`).
5. Standardize password-change session invalidation (`SEC-AUTH-006`).
6. Standardize CSRF and production rate limiting (`SEC-AUTH-007`,
   `SEC-AUTH-008`).
7. Retire legacy token storage compatibility and correct placeholder/metadata
   behavior (`SEC-AUTH-009` through `SEC-AUTH-013`).

## Verification tests to add

- A staff/driver/water REEBS session cannot create or promote users.
- A tenant owner/admin cannot read or mutate another organisation by query,
  header, or body ID.
- REEBS RLS denies cross-tenant rows under the actual production app role and
  pooled connection behavior.
- Invalid manager PIN attempts return 429 after the configured threshold.
- Forgot-password returns uniform responses and enforces IP/identifier limits.
- A Stroane custom role with every module permission false receives 403 from every
  admin read and mutation route.
- Password reset invalidates prior tokens/sessions according to the documented
  policy.
- Every cookie-authenticated unsafe route rejects hostile Origin, same-site
  sibling Origin where appropriate, and missing/invalid CSRF proof.
