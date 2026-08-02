# Shared API client

Date: 2026-07-26

## Decision

`@faako/api-client` is the shared, framework-independent transport foundation
for browser and server HTTP calls. It standardises native Fetch behavior
without replacing existing API payloads, endpoint paths, authentication
protocols, or application-specific response types.

The package depends on `@faako/api-contracts` for error normalization. Raw
successful JSON is returned unchanged by default. Canonical or compatible
Faako response envelopes are unwrapped only when a caller explicitly selects
`responseMode: "data"`.

No request is retried automatically. This guarantees that POST, PUT, PATCH, and
DELETE operations are never replayed by the shared client.

## Direct-fetch audit

The baseline scan found 295 production-source `fetch` or `window.fetch`
invocations across 96 files. Tests, generated output, dependencies, virtual
environments, and coverage output were excluded. The Faako ERP pilot removes
one direct call and one direct-fetch file, leaving 294 invocations across 95
files outside the shared transport.

| Owner | Baseline files | Baseline calls | Main usage |
| --- | ---: | ---: | --- |
| REEBS Portal | 46 | 176 | Page-level CRUD, auth, inventory, bookings, customers, orders, invoices, documents, analytics, and provider integrations |
| Stroane | 18 | 66 | Typed storefront/portal API modules, provider calls, notification delivery, Paystack, webhooks, and service worker |
| REEBS Website | 15 | 27 | Auth, catalogue/rentals, checkout, booking, contact, currency, cache, and sitemap refresh |
| Dev ERP | 8 | 15 | Central browser client, direct public/setup/invoice/proposal calls, currency helper, backend providers, and service worker |
| Faako API | 2 | 3 | Resend and activity/webhook delivery |
| Faako Website | 2 | 2 | Signup and client-setup submissions |
| Portfolio | 2 | 2 | Contact submission and trust statistics |
| Shared core | 1 | 2 | Website-template content reads/writes |
| Shared UI | 1 | 1 | Application update check |
| Faako ERP | 1 | 1 | Demo access; migrated by the pilot |

### Complete ownership inventory

The baseline files are grouped below. This is the migration inventory, not an
instruction to replace every call.

- Portfolio: `src/views/Contact.jsx`, `src/views/Home.jsx`.
- Dev ERP: `backend/server.js`, `public/sw.js`, `src/api/client.ts`,
  `src/pages/InvoiceView/InvoiceView.jsx`,
  `src/pages/Proposals/ProposalClientView.jsx`,
  `src/pages/PublicBooking/PublicBooking.jsx`,
  `src/pages/SetupAccount/SetupAccount.jsx`,
  `src/utils/displayCurrency.js`.
- Faako API: `src/demoAccess.js`, `src/signup.cjs`.
- Faako ERP: `src/components/DemoAccessGate.jsx` before the pilot.
- Faako Website: `src/pages/ClientSetup.jsx`, `src/pages/Signup.jsx`.
- REEBS Portal backend: `backend/functions/advancedAnalytics.js` and the
  `_shared/auditLog.js`, `_shared/email.js`, `_shared/managerPush.js`, and
  `_shared/whatsapp.js` provider modules.
- REEBS Portal components/utilities: Auth, Cart, Contact, Currency, Instagram,
  and Portal Sidebar components; `inventoryCache.js` and
  `invoiceDocumentCache.js`.
- REEBS Portal pages: Admin, Accounting, Audit Logs, Bookings, Customers,
  Delivery, Directory, Documents, Expenses, HR, Inventory Products, Inventory
  Templates, Invoicing, Maintenance, Marketing, Rentals, Reports, Roles,
  Scheduler, Settings, Timesheets, Vendors, Water, Workspace, Login,
  Order Builder, Orders hooks/components, Orders List, Reset Password, and
  Store Mode.
- REEBS Website: the Auth, Cart, Contact, Currency, Instagram, and Portal
  Sidebar components; About, Book, Checkout, Login, Rental Item, Rentals, and
  Reset Password pages; `inventoryCache.js`; and
  `scripts/refreshSitemapRentals.mjs`.
- Stroane browser: storefront `customerAccount.ts`, `orders.ts`, and
  `products.ts`; portal Accounting, Audit Logs, Customers, Inventory, Orders,
  Products, Receipts, and Session API modules.
- Stroane server/runtime: `backend/server.js`, customer-account, order,
  inventory-alert and receipt notification modules, Paystack integration, and
  `public/stroane-portal-sw.js`.
- Shared packages: `packages/core/src/templateConfig.tsx` and
  `packages/ui/src/components/AppUpdateNotice.tsx`.

## Existing patterns

### Dev ERP

`src/api/client.ts` is the strongest existing browser client. It adds
credentialed requests, CSRF tokens, session refresh/replay, HTML-response
detection, and session-expiry behavior. Several Dev ERP pages bypass it.

The shared package does not replace the CSRF or refresh state machine. A future
Dev ERP adoption should compose those hooks around the shared transport and
prove that a replay is safe before removing the local interceptor.

### Stroane

Stroane has typed domain modules, but JSON parsing, credentials, fallback
messages, auth headers, and error extraction are repeated in most files. These
modules are good migration candidates because their public method signatures
can remain unchanged while their internal transport is replaced.

### REEBS

REEBS owns the largest direct-fetch surface. Calls are distributed through
large page components and duplicated public/portal contexts. Some requests use
AbortController, while many do not. Error payloads and credentials are handled
inconsistently. REEBS should first introduce app-local API modules; directly
rewriting hundreds of page calls would create an unreviewable migration.

### Server integrations and service workers

Resend, Brevo, WhatsApp, Expo, analytics, webhook, currency, Google/Maps, and
Paystack requests have provider-specific authentication and response rules.
Service-worker fetch handlers also operate on `Request` and cached `Response`
objects rather than ordinary JSON APIs. These calls remain native until a
provider or service-worker adapter is explicitly designed.

## Package layout

```text
packages/api-client/src/
  request.ts
  errors.ts
  browser.ts
  server.ts
  auth.ts
  users.ts
  organisations.ts
  products.ts
  inventory.ts
  customers.ts
  bookings.ts
  orders.ts
  invoices.ts
  payments.ts
  resource.ts
  index.ts
```

The root export is browser-safe and does not export `server.ts`.
Server consumers must use the explicit `@faako/api-client/server` subpath.
Neither entry point reads environment variables. Applications resolve their
own environment values and pass a base URL, token provider, or default headers
to the factory.

## Transport contract

### URLs and credentials

- `baseUrl` is optional and normalized without changing endpoint paths.
- Browser clients explicitly default to `credentials: "same-origin"`.
- Cookie-authenticated clients opt into `credentials: "include"`.
- Server clients use `credentials: "omit"`.
- Credentials can be overridden per request when an existing endpoint requires
  different behavior.

### Headers and JSON

- `Accept: application/json` is added unless a caller supplies another value.
- `Content-Type: application/json` is added only for the `json` option.
- Caller headers override client defaults case-insensitively.
- JSON bodies are serialized once. Serialization failures become structured
  client errors.
- Empty successful bodies resolve to `null`.
- Invalid JSON on a successful JSON request becomes `invalid_response`.
- Text, Blob, ArrayBuffer, and Response modes are explicit.

### Errors

`ApiClientError` includes:

- message and normalized error code;
- HTTP status and status text;
- method and resolved URL;
- original error payload when available;
- validation issues and details;
- request ID;
- retry-after seconds;
- original cause for local network, abort, parsing, or serialization failures.

Legacy `{ error: "..." }`, canonical `apiError`, structured `error`, FastAPI
detail arrays, and status-derived errors are normalized through
`@faako/api-contracts`.

### Cancellation and request IDs

- Every request accepts `AbortSignal`.
- Aborted requests use `request_aborted`; other transport failures use
  `network_error`.
- Callers can provide `requestId`, a default `X-Request-Id` header, or a
  `requestIdFactory`.
- `requestDetailed` returns the response request ID while keeping the parsed
  data contract unchanged.
- HTTP errors capture `X-Request-Id`, payload metadata, and `Retry-After`.

### Domain clients

Auth and resource clients are optional thin wrappers. Resource paths are
configurable because applications currently use variants such as
`/api/invoices`, `/api/invoice-documents`, `/api/payments`, and
`/api/orderPayments`. The wrappers return raw endpoint payloads by default;
they do not invent a universal list/detail shape.

## Pilot

Faako ERP demo access is the first adoption:

- `DemoAccessGate.jsx` no longer calls `fetch` directly;
- `src/api/demoAccess.js` owns its existing endpoint and local-mode guard;
- POST method, JSON body, same-origin credentials, endpoint configuration,
  canonical response data, legacy success compatibility, displayed error
  message, rate-limit context, and request IDs are preserved;
- the existing response adapter remains available for backward compatibility;
- four new pilot tests cover the request and both response generations.

## Non-goals

- No API endpoint or response envelope was changed.
- No app-wide Fetch monkey patch was added.
- No query cache, React hook library, offline queue, or state manager was
  introduced.
- No automatic retry, refresh, deduplication, or mutation replay was added.
- No service worker, provider webhook, upload/download, data URL, or streaming
  call was migrated.
