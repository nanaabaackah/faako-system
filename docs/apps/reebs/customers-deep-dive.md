# REEBS Customers architecture

## Scope and ownership

Customers owns shared identity and relationship data: individual or organization identity, primary contact person, normalized phone/email, primary address, GhanaPost GPS, contact preference, staff-only notes, archive state, and a stable `CUS-######` reference.

Bookings, Orders, Payments, Delivery, Documents, Contact Requests, and Water remain authoritative for their own transactions. Customer views read bounded summaries from those domains; they do not create replacement transaction ledgers.

## Current architecture

- Staff UI: `src/pages/AdminCustomers` is the primary Customer workspace at `/admin/crm` (with `/admin/customers` as a legacy redirect).
- Internal API adapter: `backend/functions/customers.js` authenticates and scopes requests.
- Domain modules: `backend/modules/customers/customerIdentity.js`, `customerPolicy.js`, and `customerRepository.js` own normalization, validation, commercial scope, query boundaries, and persistence.
- Data: the `customer` table stores identity. Orders, Bookings, Order Payments, Water Sales, Contact Requests, and Customer Activity reference the Customer id.
- Storefront: `/customer-login` is currently a booking-continuation form, not an authenticated customer account. It must not be represented as self-service transaction access until a dedicated customer-session model exists.

## Core and Water boundary

Water is a standalone business domain. Core Customer requests default to `scope=core` and aggregate only REEBS Core Orders and Bookings. Water screens must request `scope=water`; those responses expose explicitly named `water_sales`, `water_revenue`, `waterSales`, and `waterTotals` fields and never fold them into Core `total_spent`, rental, or profitability values.

Water-role users may use the scoped compact identity selector. They do not gain Customer write access or Core commercial history through that selector.

Core invoice history includes only documents linked to a verified Core Order or Booking. Manual/unclassified documents are excluded because they do not currently carry a reliable business-unit field; they must not be assumed to be Core or combined with Water.

## API contracts

- `GET /api/customers?format=page&page=1&pageSize=25&q=...` returns `{ items, pagination, scope }` for the Customer workspace.
- `GET /api/customers?compact=1&limit=200` returns bounded identity summaries for internal selectors.
- `GET /api/customers?id=...` returns identity plus bounded Core history. Order payments are included only with `financials:read`; linked Core invoices/receipts are included only with `invoices:read`.
- `GET /api/customers?id=...&scope=water` returns identity plus bounded Water history to `water:read` users.
- POST/PUT explicitly map supported identity fields. Exact phone/email duplicates return the existing identity without changing it. Likely organization duplicates require explicit confirmation.
- DELETE archives the identity and preserves linked transaction history.

## Ghana identity handling

`0244123456`, `233244123456`, and `+233244123456` normalize to `+233244123456`. Valid international E.164-like inputs remain supported. Email is lowercase-normalized. The UI supports all 16 Ghana regions, landmark/directions fields, and GhanaPost GPS.

## Security and privacy

- Every staff/customer API request is authenticated and organization-scoped.
- Core read, Water read, and Customer write permissions are separate.
- Staff-only notes are omitted from read-only DTOs.
- Mutation audit events contain stable references and changed field names, not full Customer records.
- The data-quality command returns counts only and does not print customer PII.

## Deferred deliberately

- Authenticated customer self-service and customer-specific sessions.
- Multiple organization contacts (one primary contact is currently sufficient).
- Customer merge UI/service. No records are silently merged.
- Customer document links, because the current Document model has no Customer relationship.
- Full activity pagination endpoints beyond the bounded recent-history response.
- Unified booking-payment balances, manual-invoice business-unit classification, and marketing automation.

The next Payments phase should consume Customer id/reference only, keep transaction ownership in Payments, and expose customer balance by an explicit Core or Water scope.

## Verification notes

- Customer repository/identity/policy tests cover Ghana phone normalization, scoped lookup, pagination, atomic references, and the Core/Water list boundary.
- Browser tests cover 320, 375, 390, 430, 768, 1024, and 1440 pixel widths; mobile organization creation; permission-gated Core payments/invoices; driver read-only access; keyboard dialog operation; and Axe accessibility.
- `customers:audit:dev` and `customers:audit:prod` are read-only, count-only checks. Run them only after the Customer identity migration is deployed; production additionally requires `REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true`.
