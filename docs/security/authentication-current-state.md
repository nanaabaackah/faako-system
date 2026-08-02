# Authentication current state

The 2026-07-26 roles, errors, request tracing, and logging standardisation does
not change any authentication provider or session mechanism described here.
See [`roles-and-permissions.md`](./roles-and-permissions.md) for the shared
authorisation target and
[`logging-and-redaction.md`](./logging-and-redaction.md) for diagnostic-data
handling.

Last reviewed: 2026-07-26

## Scope and method

This is a source-code audit of the authentication paths in every application under
`apps/` and the shared authentication helpers under `packages/`. It covers login,
logout, browser storage, cookies, expiry, refresh, route guards, backend middleware,
CORS, CSRF, rate limiting, password reset, and session invalidation.

This audit does not introduce Auth0 or recommend an identity-provider migration.
No Auth0 package, import, or configuration was found in the repository.

Deployment state was not inspected. Controls that depend on environment values,
database roles, proxy topology, or edge configuration must be verified in each
deployed environment.

## Repository-wide summary

| Application | Current authentication state | Session transport | Refresh / expiry | Password recovery |
| --- | --- | --- | --- | --- |
| Bynana Portfolio | No authentication | None | None | None |
| Dev ERP | Production-style user authentication | HttpOnly access and refresh cookies; bearer accepted for compatibility | 15-minute access token, rotating database-backed refresh token, seven-day refresh lifetime | Email link reusing the account-setup token flow |
| Faako API | No general user authentication; public signup and demo-code endpoints | None | Demo challenge: 15 minutes; returned demo access descriptor: seven days | None |
| Faako ERP | Demo access gate, not production authentication | Unsigned demo descriptor in `localStorage` | Browser checks the descriptor's seven-day expiry; no server session validation | None |
| Faako Website | Authentication-looking UI only | React memory only; login does not create a session | None | Recovery-looking UI only; no request is sent |
| REEBS Portal | User authentication plus a separate manager-mobile PIN flow | Primary web flow uses an HttpOnly signed cookie and database session; legacy bearer accepted; manager flow returns a bearer token | Web sessions: 12 hours or six days; no refresh endpoint. Manager token: seven days | Hashed, single-use, 30-minute reset token |
| REEBS Website | Public site with compatibility authentication context | Same REEBS web cookie when running on a portal origin; legacy bearer cleanup remains | No refresh endpoint | Uses the REEBS reset endpoints and UI |
| Stroane Web | Separate staff/admin and customer authentication flows | HttpOnly signed cookies; admin bearer is also accepted | Fixed eight-hour signed tokens; no refresh endpoint or server session record | Customer reset only; staff/admin has no forgot/reset flow |
| System Starter | No authentication | None | None | None |
| TTNGH | Only generated `dist/` output is present; no auditable source auth flow | None observed | None observed | None observed |
| UI Workbench | No authentication | None | None | None |

## Dev ERP

### Login and token issuance

- `POST /api/auth/login` validates the input, performs a database lookup, checks
  active status, role and organisation assignment, verifies the bcrypt password,
  and locks the account for 15 minutes after five failed attempts
  (`apps/dev-erp/backend/auth/auth.controller.js:68-190`).
- The access token contains only the session purpose, user ID, and `tokenVersion`;
  it expires after 15 minutes (`auth.controller.js:40-49`).
- Login creates a CSRF token, sets the access and CSRF cookies, and creates a
  random refresh token whose SHA-256 hash is stored in the database
  (`auth.controller.js:52-63`, `159-171`).
- The login and forgot-password routes have a dedicated rate limiter in addition
  to the general API limiter (`apps/dev-erp/backend/http/app.js:38-46`).

### Storage and cookies

- The access cookie is `HttpOnly`; the CSRF cookie is readable by JavaScript. Both
  use configurable `Secure` and `SameSite` attributes
  (`apps/dev-erp/backend/server.js:1767-1793`).
- The refresh cookie is `HttpOnly` and path-limited to `/api/auth/refresh`
  (`server.js:1795-1811`).
- The browser stores only the display/session user in `localStorage` and the CSRF
  token in `sessionStorage`. Legacy `token` values are actively removed
  (`apps/dev-erp/src/utils/authSession.js:17-55`, `79-85`).
- API calls default to `credentials: "include"` and attach the CSRF token to unsafe
  methods (`apps/dev-erp/src/api/client.ts:122-138`).

### Expiry, refresh, logout, and invalidation

- Refresh tokens are database-backed, expire after seven days, and rotate on use.
  The previous token is revoked before a new token is issued
  (`auth.controller.js:263-299`).
- The client attempts one refresh after an authenticated API request returns 401,
  then replays the original request when it is safe to do so
  (`apps/dev-erp/src/api/client.ts:149-207`).
- Logout increments `tokenVersion`, revokes the presented refresh token, clears
  all auth cookies, and therefore invalidates all existing access tokens for the
  user (`auth.controller.js:222-260`; session validation at
  `apps/dev-erp/backend/server.js:1925-1945`).
- Deactivated users, users without a role, users without an organisation, and
  tokens with an old `tokenVersion` are rejected on every authenticated request
  (`server.js:1925-1945`).
- A password changed through the profile endpoint creates a new cookie but does
  not increment `tokenVersion` or revoke existing refresh tokens
  (`apps/dev-erp/backend/users/users.routes.js:94-147`). Password reset/account
  setup has the same invalidation gap (`auth.controller.js:372-438`).

### CSRF and CORS

- Cookie-authenticated unsafe requests require a matching CSRF cookie and
  `X-CSRF-Token` header, using a timing-safe comparison
  (`apps/dev-erp/backend/security/csrf.js:11-40`).
- Login, logout, refresh, forgot-password, public, and webhook paths are excluded.
  In particular, logout can be triggered without a CSRF token
  (`csrf.js:1-9`).
- Credentialed CORS uses an exact allowlist and fails closed for unlisted origins
  (`apps/dev-erp/backend/http/corsConfig.js:11-46`;
  `apps/dev-erp/backend/server.js:5175-5190`).

### Frontend route guard

The React `PrivateRoute` waits for the server-backed session check and redirects
to `/login` when no user is present. Module navigation is also filtered in the
browser (`apps/dev-erp/src/App.jsx:95-101`, `474-492`). These controls improve the
experience; backend auth, capability, and organisation middleware are the actual
security boundary.

## REEBS Portal and REEBS Website

### Primary web login and session

- `POST /api/login` checks same-site browser context, normalizes the identifier,
  verifies the password, implements five-attempt account lockout, creates a
  database session, and returns an HttpOnly cookie
  (`apps/reebs-portal/backend/functions/login.js:46-199`).
- Session records include the user, organisation, random session-token ID, expiry,
  IP, user agent, last-seen time, and revocation time. Persistent sessions last six
  days; session-only login lasts 12 hours
  (`apps/reebs-portal/backend/functions/_shared/userSessions.js:3-30`, `54-89`;
  `login.js:17`, `67-71`).
- The signed cookie is `HttpOnly`, `SameSite=Lax`, optionally `Secure`, and may use
  a configured domain (`apps/reebs-portal/backend/functions/_shared/userAuth.js:45-69`,
  `146-190`).
- `remember: false` shortens the lifetime to 12 hours, but the response still sets
  `Max-Age`; it is therefore a shorter persistent cookie rather than a
  browser-session cookie (`login.js:17`, `67-71`; `userAuth.js:163-166`).
- Each authenticated request verifies the signature and expiry, then joins the
  token's user, organisation, and session-token ID to an active database session
  (`userAuth.js:193-252`).
- `GET /api/authSession` revalidates the database session and current user record.
  It also converts a supported legacy bearer session to a cookie
  (`apps/reebs-portal/backend/functions/authSession.js:16-81`).

### Browser storage

- Current login responses omit tokens, and the portal sanitizes token/password
  fields before persisting the non-secret user profile
  (`apps/reebs-portal/src/components/AuthContext/authResponse.js:1-14`;
  `AuthContext.jsx:128-149`).
- The profile shell is persisted in `localStorage` or `sessionStorage`, then checked
  against `/api/authSession` on startup (`AuthContext.jsx:23-65`, `75-121`).
- Shared compatibility code still reads historical bearer tokens from both Web
  Storage locations and from old user objects, even though `setAuthToken` removes
  those persisted token keys (`packages/core/src/organization.ts:210-249`).
- The public REEBS Website retains additional legacy-token migration logic and
  only attempts auth when it identifies itself as a portal origin
  (`apps/reebs-website/src/components/AuthContext/AuthContext.jsx:84-145`).

### Logout, expiry, and invalidation

- Logout revokes the current database session and clears the cookie
  (`apps/reebs-portal/backend/functions/logout.js:15-68`).
- There is no refresh endpoint. Users sign in again after the fixed session
  expires.
- Password reset revokes every database session for the affected user and
  organisation (`apps/reebs-portal/backend/functions/resetPassword.js:58-95`).
- An administrator changing a user's password through `users.js` does not revoke
  that user's existing sessions (`apps/reebs-portal/backend/functions/users.js:246-265`).

### Password reset

- Raw reset tokens are random, only their SHA-256 hashes are stored, new requests
  invalidate older unused tokens, tokens expire after 30 minutes, and consumption
  is atomic (`apps/reebs-portal/backend/functions/_shared/passwordReset.js:3-15`,
  `129-192`).
- The public forgot-password flow is scoped to the configured public organisation
  (`apps/reebs-portal/backend/functions/forgotPassword.js:271-305`).
- The flow returns different responses for usernames with no personal email,
  discloses whether a staff phone is on file, and can attach a personal email after
  a phone-number match (`forgotPassword.js:307-359`). No request-rate limiter is
  applied in this handler.

### CORS and CSRF

- Response CORS headers use an exact configured allowlist and credentials
  (`apps/reebs-portal/backend/functions/_shared/http.js:8-18`, `37-58`, `79-118`;
  `packages/security/src/index.js:109-146`).
- Authenticated handlers generally reject requests only when
  `Sec-Fetch-Site: cross-site` is present. There is no synchronizer or double-submit
  CSRF token in the current REEBS web session flow
  (`apps/reebs-portal/backend/functions/_shared/http.js:74-77`).
- `SameSite=Lax`, JSON requests, and CORS preflight reduce browser CSRF exposure,
  but protection is inconsistent with Dev ERP and depends on browser headers,
  cookie-domain configuration, and endpoint content types.

### Rate limiting

- Account lockout exists for named REEBS users, but the primary login handler does
  not apply the shared database-backed request limiter. Unknown usernames can
  therefore generate unbounded password verification work per instance.
- The shared database-backed limiter exists and is used by selected endpoints
  such as manager login, contact, bookings, and water workflows
  (`apps/reebs-portal/backend/functions/_shared/requestRateLimit.js:57-119`).
- The forgot-password handler does not use it.

### Separate manager-mobile login

- `managerLogin` authenticates a single configured six-digit PIN and returns a
  signed bearer token with manager scopes and a seven-day expiry
  (`apps/reebs-portal/backend/functions/managerLogin.js:32-104`;
  `apps/reebs-portal/backend/functions/_shared/managerAuth.js:69-104`).
- The request-rate check occurs only after the PIN has already been verified and
  the handler has returned for an invalid PIN (`managerLogin.js:47-60`, `67-85`).
  It therefore does not rate-limit failed PIN guesses.
- Manager tokens are stateless. There is no manager refresh, logout, token
  revocation, device-session record, or per-token invalidation mechanism in the
  audited code.

## Stroane Web

### Staff/admin authentication

- Staff login verifies a username and scrypt password, uses a dummy hash for
  missing users, verifies active status, and issues an eight-hour signed token in
  an HttpOnly cookie (`apps/stroane-web/backend/src/routes/auth.js:357-400`;
  `apps/stroane-web/backend/src/auth.js:3-51`, `70-89`).
- The backend accepts either the cookie or an `Authorization: Bearer` token
  (`auth.js:112-126`).
- Authenticated middleware verifies the token, reloads the user and custom role
  from the database, and rejects inactive users
  (`apps/stroane-web/backend/src/adminAuth.js:122-167`).
- The browser stores only a sanitized profile shell in `sessionStorage`; token
  fields are removed (`apps/stroane-web/src/portal/api/adminSession.ts:235-287`).
- Logout clears the cookie but cannot revoke an already copied token
  (`apps/stroane-web/backend/src/routes/auth.js:402-405`).
- Staff/admin has no forgot-password or reset-password route.

### Customer authentication

- Customer signup and login use the same signed-token primitive in a separate
  HttpOnly cookie with an audience claim
  (`apps/stroane-web/backend/src/customerAccounts/routes.js:185-216`, `471-518`).
- The customer profile shell, but not the token, is stored in `sessionStorage` and
  revalidated once at startup (`apps/stroane-web/src/context/AuthContext.tsx:40-99`).
- Customer reset tokens are random, stored only as hashes, single-use, and expire
  after one hour (`apps/stroane-web/backend/src/customerAccounts/routes.js:164-172`,
  `520-607`).
- Reset immediately signs the user in, but it does not invalidate customer tokens
  previously issued for the same account. Customer and staff tokens are stateless,
  so password changes and logout do not provide server-side revocation before the
  eight-hour expiry.

### CORS, CSRF, and rate limiting

- Credentialed CORS uses exact configured origins and only adds localhost defaults
  in development/test (`apps/stroane-web/backend/security.js:17-57`).
- Customer unsafe requests require `X-Stroane-Client: storefront`, which is not a
  secret but forces a cross-origin browser request to preflight
  (`apps/stroane-web/backend/src/customerAccounts/routes.js:125-131`;
  `apps/stroane-web/src/api/customerAccount.ts:83-91`).
- Staff/admin unsafe requests have no equivalent custom header, Origin check, or
  CSRF token. Default `SameSite=Lax` mitigates ordinary cross-site POSTs, but the
  cookie can be configured to `SameSite=None`
  (`apps/stroane-web/backend/src/auth.js:57-89`).
- API and auth rate limits are applied, but the limiter is an in-process `Map`.
  Limits reset on restart and are not shared across replicas
  (`apps/stroane-web/backend/security.js:69-109`;
  `apps/stroane-web/backend/server.js:198-234`, `533-543`).

## Faako API and Faako ERP demo access

- The API has no general auth mode and exposes public signup and demo-access
  endpoints (`apps/faako-api/appSystem.js:13`; `apps/faako-api/src/server.js:31-54`).
- Demo access sends a six-digit email code, stores a server-side in-memory
  challenge, limits email/IP requests, limits verification attempts, and expires
  challenges after 15 minutes (`apps/faako-api/src/demoAccess.js:11-21`, `194-338`).
- A successful verification returns an unsigned `{email, grantedAt, expiresAt}`
  descriptor. It is not a server-verifiable session or credential
  (`demoAccess.js:327-338`).
- Faako ERP stores that descriptor in `localStorage` and trusts its future
  `expiresAt` value (`apps/faako-erp/src/utils/demoAccessSession.js:6-34`, `36-84`).
  A visitor can fabricate it in browser developer tools. This is acceptable only
  as a convenience gate over non-sensitive, client-bundled demo data.
- Demo challenges and rate limits are process-local, so they do not survive a
  restart and are not shared across replicas.
- Faako API CORS permits configured exact origins and any HTTPS `*.pages.dev`
  preview origin (`apps/faako-api/src/security/securityHeaders.js:27-39`). The
  current endpoints do not use cookies, so CSRF is not applicable to them.

## Faako Website

- `AuthContext` holds only an in-memory `user`; no login, logout, token, cookie,
  expiry, refresh, or session-validation implementation exists
  (`apps/faako-website/src/contexts/AuthContext.jsx:1-25`).
- The login form performs only browser field validation and sends no request
  (`apps/faako-website/src/pages/Login.jsx:51-75`).
- The forgot-password form also performs only browser field validation and sends
  no request (`apps/faako-website/src/pages/ForgotPassword.jsx:23-41`).
- Copy stating that sign-in is secure, sessions are encrypted, reset links expire,
  and reset requests are tracked is not backed by the current implementation
  (`Login.jsx:85-105`; `ForgotPassword.jsx:51-67`).

## Shared packages and metadata

- `@faako/api-client` supplies framework-independent login/logout/session/reset
  request wrappers, but it does not own authentication state, token storage, CSRF,
  or authorization (`packages/api-client/src/auth.ts:1-54`).
- `@faako/core` contains REEBS-specific legacy token and organisation request
  behavior, including historical Web Storage token reads
  (`packages/core/src/organization.ts:12-14`, `224-249`).
- Application security metadata does not always describe runtime reality:
  Faako ERP declares cookie auth although its demo gate uses `localStorage`
  (`apps/faako-erp/appSystem.js:75-83`), while Stroane declares no auth despite
  staff and customer cookie sessions (`apps/stroane-web/appSystem.js:73-82`).

## Controls requiring deployment verification

1. Cookie `Secure`, `SameSite`, and domain values for Dev ERP, REEBS, and Stroane.
2. Exact production CORS allowlists and trusted proxy configuration.
3. Whether REEBS uses a restricted database role subject to its RLS policies.
4. Whether multiple API replicas make in-memory rate limits ineffective.
5. Whether legacy REEBS bearer clients or the manager-mobile client are still active.
6. Whether edge/CDN rules add CSRF, rate limiting, or session controls not visible
   in this repository.
