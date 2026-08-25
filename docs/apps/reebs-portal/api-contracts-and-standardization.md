# REEBS API contracts and standardization

Date: 2026-08-14

## Boundary and current architecture

The REEBS API remains an Express adapter over function handlers. The adapter resolves
`/api/:functionName`, creates the existing serverless-style event, supplies request
context, limits concurrency, and retries only failed GET requests. Authentication,
tenant resolution, permissions, validation, and business rules remain authoritative in
the handler and its shared backend helpers.

Framework-neutral transport contracts live in `@faako/api-contracts`; source types in
`@faako/types`; Zod boundary schemas in `@faako/validation`; and transport behavior in
`@faako/api-client`. `@faako/api-client/reebs` is a thin route layer and does not put
REEBS business rules into the generic transport.

No Axios usage was found in Portal or Website. Native provider, data-URL, map, upload,
download, service-worker, and Astro build-time calls are not browser API-client drift.

## Safe route inventory

The complete source inventory is the set of handler files under
`apps/reebs-portal/backend/functions`. The matrix below records the stable and major
business surfaces without publishing secrets, webhook verification material, or
permission internals. `Legacy` means the current path remains supported.

| Method | Path | Audience | Authentication / permission | Request contract | Response contract | Pagination | Scope | Consumers / compatibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | PUBLIC | cookie issued after credential and lockout checks | `reebsLoginInputSchema` | `ReebsSessionUserDto` plus session timing; no token | n/a | SHARED | Portal + Website; alias of legacy `/api/login` |
| GET | `/api/v1/auth/session` | CUSTOMER / ADMIN | cookie-first; temporary bearer compatibility | none | safe session user | n/a | SHARED | Portal + Website; alias of `/api/authSession` |
| POST | `/api/v1/auth/logout` | CUSTOMER / ADMIN | current session if present | none | legacy acknowledgement | n/a | SHARED | alias of `/api/logout` |
| POST | `/api/v1/auth/forgot-password` | PUBLIC | enumeration-safe recovery checks | bounded identifier/recovery fields | safe generic status | n/a | SHARED | alias of `/api/forgotPassword` |
| POST | `/api/v1/auth/reset-password` | PUBLIC | signed, expiring reset token | reset schema | safe status | n/a | SHARED | alias of `/api/resetPassword` |
| GET | `/api/v1/catalogue`, `/api/v1/catalogue/products` | PUBLIC | configured public organisation | allowlisted catalogue query | `ReebsPublicProductDto` target | legacy/unpaged | REEBS_CORE | Website; aliases of `/api/inventory` |
| GET | `/api/v1/bookings/availability` | PUBLIC | public organisation + request controls | date/product query | booking availability | n/a | REEBS_CORE | Website; alias of `/api/bookingAvailability` |
| GET, POST, PUT | `/api/v1/bookings` | PUBLIC / ADMIN | public POST controls; internal reads/writes require tenant user | public POST uses `reebsBookingCreateInputSchema`; admin compatibility remains handler validated | booking summary/detail legacy DTO | legacy/unpaged | REEBS_CORE | Website + Portal; alias of `/api/bookings` |
| GET, POST, PUT | `/api/v1/customers` | PUBLIC / ADMIN | public lookup/create controls; admin tenant permissions | existing bounded handler validation | self/admin DTO split target | legacy/unpaged | REEBS_CORE | booking + checkout + Portal; alias of `/api/customers` |
| POST | `/api/v1/checkout/orders` | PUBLIC | configured public organisation, server-authoritative totals | existing checkout order validation | safe order result | n/a | REEBS_CORE | Website; adapter to canonical `orders` via legacy `createOrder` shim |
| GET, POST, PUT | `/api/orders`, `/api/orderEvents`, `/api/orderPayments`, `/api/orderReceipts` | ADMIN | tenant user + route permission | handler-specific schemas/checks | order/payment/receipt DTOs | orders use legacy page fields | REEBS_CORE | Portal; legacy retained |
| GET, POST | `/api/inventory`, `/api/inventoryCounts`, `/api/inventoryVariants`, `/api/stock`, `/api/stockActivity` | PUBLIC / ADMIN | minimum public catalogue projection or tenant permission | operation-specific bounded fields | public/admin inventory projections | mixed legacy | REEBS_CORE | Website + Portal; legacy retained |
| GET, POST, PUT | `/api/deliveries`, `/api/managerBookings`, `/api/managerOrders` | ADMIN | tenant/manager session and permission | handler validation | operational DTOs | legacy | REEBS_CORE | Portal operations; legacy retained |
| GET, POST, PUT | `/api/invoice-documents`, `/api/invoice-document-email`, `/api/generateInvoice`, `/api/getInvoiceDetails` | ADMIN | tenant finance/document permissions | explicit document metadata/financial checks | invoice summary/detail/document | mixed legacy | REEBS_CORE | Portal; PDF/download response modes retained |
| GET, POST | `/api/accounting-coa`, `/api/accounting-config`, `/api/accounting-history`, `/api/accounting-import`, `/api/accounting-journals`, `/api/accounting-trial-balance`, `/api/accounting-seed` | ADMIN | accounting permissions + tenant scope | handler-specific accounting contracts | accounting/admin DTOs | mixed legacy | REEBS_CORE | Portal only; not versioned publicly |
| GET, POST | `/api/expenses`, `/api/financials`, `/api/reports`, `/api/advancedAnalytics` | ADMIN | finance/report permissions | allowlisted filters in handlers | financial/report DTOs; advanced analytics echoes core scope | mixed legacy | REEBS_CORE | Portal; no Water inclusion |
| GET, POST | `/api/water` | ADMIN | tenant plus explicit Water read/write permission | dedicated bounded Water actions | dedicated Water dashboard/ledger DTO, `scope=water`, `businessUnit=WATER` | unpaged ledgers | WATER | Portal Water Business only; deliberately absent from public v1 aliases |
| POST | `/api/water-momo-webhook` | WEBHOOK | provider secret/signature and replay checks | provider-specific Water payment event | safe acknowledgement | n/a | WATER | provider only; never exposed by frontend client |
| POST | `/api/webhooks/railway`, `/api/webhook/railway` | WEBHOOK | provider verification | provider event schema | safe acknowledgement | n/a | SYSTEM | provider only; aliases preserved |
| GET, POST | `/api/documents`, `/api/contact`, `/api/contactRequests`, `/api/websiteContent` | PUBLIC / ADMIN | public rate limits or tenant permissions by action | content/contact/document metadata contracts | audience-specific projections | legacy | SHARED / REEBS_CORE | Website + Portal; upload/download exceptions retained |
| GET, POST | `/api/auditLogs`, `/api/hr`, `/api/maintenance`, `/api/marketing`, `/api/sourceCategories`, `/api/specificCategories`, `/api/staffProfile`, `/api/timesheets`, `/api/users`, `/api/userStats`, `/api/vendors` | ADMIN | tenant and module permission | handler-specific bounded data | admin-only DTOs | mixed legacy | REEBS_CORE | Portal only; legacy retained |
| GET | `/api/bouncy_castles`, `/api/indoor_games`, `/api/machines`, `/api/publicStats` | PUBLIC | configured public organisation | bounded query | legacy public projection | unpaged | REEBS_CORE | Website legacy rental catalogue; migration deferred until one canonical product projection is proven |
| POST | `/api/geocode`, `/api/testEmail` | ADMIN / SYSTEM | permission/environment controls | provider-specific bounded request | safe provider result | n/a | SHARED | intentional special integration |

All errors are transported through the shared HTTP helper where migrated. Existing
`{ error: string }` consumers remain valid while compatible responses add `apiError`
and request metadata. New domain codes include `AUTH_REQUIRED`,
`PERMISSION_DENIED`, `VALIDATION_FAILED`, `BOOKING_CONFLICT`,
`INVENTORY_UNAVAILABLE`, payment conflict/failure codes, customer not-found codes,
Water not-found codes, and `RATE_LIMITED`.

## Contracts and DTOs

- Public product and customer-self DTOs are allowlists. Procurement cost, margin,
  supplier-only data, lockout fields, password material, session tokens, and internal
  notes are excluded.
- Admin customer DTOs add only operational fields and do not reuse a database row as a
  public response.
- Booking inputs model lines, date-only event dates, venue/time fields, payment
  preference, and compatibility fields. Availability, conflict decisions, reservation,
  totals, and status authority stay on the server.
- Rental periods and statuses are separate from ordinary order DTOs. Water does not
  inherit either contract.
- Inventory read DTOs distinguish available, reserved, in-use, maintenance, damaged,
  and unavailable quantities; mutation DTOs require an operation context.
- Delivery uses an address DTO independent of map-provider internals.
- Invoice and accounting types use explicit minor-unit fields and currency. Existing
  server calculations remain authoritative.
- Water has separate customer, product, order-line, order, inventory, payment,
  financial-summary, and dashboard types.

## Query, date, money, and status conventions

New page-based lists use `page` and `pageSize` (1–100) and return `page`, `pageSize`,
`total`, and `totalPages` under pagination metadata. Existing cursor or legacy page
fields remain until their consumers migrate. Common filters are allowlisted names such
as `status`, `search`, `dateFrom`, `dateTo`, `customerId`, `categoryId`, `sort`, and
`direction`; arbitrary database column names are not accepted.

Timestamps are ISO-8601 UTC; business date-only values remain `YYYY-MM-DD`. Money uses
the endpoint's existing minor-unit convention, explicit currency where needed, and
server-side rounding. Statuses remain domain-specific: booking, order, payment,
inventory, invoice, and Water statuses are not collapsed into one enum.

## Versioning and compatibility

`/api/v1` is the stable external/customer direction. V1 paths are aliases to proven
handlers, so old and new clients execute the same authorization, organization scoping,
and business logic. Legacy endpoints are supported, not yet deprecated, because usage
telemetry and a sunset date do not exist. No response envelope was imposed globally.

The Website now uses the shared response-compatible bridge for auth, customer lookup
and creation, booking, and checkout. The Portal uses the same transport for auth,
advanced analytics, and Water. Successful legacy shapes and existing UI parsing remain
unchanged. Request IDs, cookies, abort signals, and normalized failures come from the
shared transport. There are no automatic client retries; the backend adapter retries
GET failures only and never replays writes.

Retained direct fetches fall into four groups:

1. provider or map calls with a provider-specific contract;
2. Blob/data-URL, PDF, upload, download, and service-worker operations that require a
   native `Request`/`Response`;
3. Astro build-time catalogue/sitemap refreshes where browser credentials do not apply;
4. legacy Portal admin pages and rental-category endpoints awaiting focused migration.

## Payments and webhooks

`reebsPaymentInitializationSchema` requires an idempotency key and order reference and
deliberately rejects a browser-supplied amount. The server must resolve ownership,
currency, and payable amount. Safe response types expose a payment reference,
authorization URL where applicable, and status—not provider secrets or raw provider
payloads. This is contract preparation only; payment processing is unchanged.

Provider webhooks remain separate from browser contracts and are never exported by the
REEBS frontend client. Signature/secret verification remains in their dedicated
handlers.

## Deferred work

- Migrate remaining large admin pages behind domain APIs one module at a time.
- Add canonical response envelopes only on new versioned routes or after consumer proof.
- Apply runtime response validation selectively to payment, catalogue, and customer
  account boundaries after measuring cost.
- Normalize legacy list pagination and filters without breaking callers.
- Add customer-account-specific endpoints instead of widening `/api/customers`.
- Phase 5 owns deeper authorization review, payment hardening, persistent rate limits,
  RLS/runtime roles, monitoring, and webhook replay hardening.
