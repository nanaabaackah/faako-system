# Shared domain types

Date: 2026-07-26

## Decision

Framework-independent business-domain contracts live in
`@faako/types/src/domain.ts` and are exported from `@faako/types`.

They describe API, event, and integration boundaries. They are not a replacement
for Prisma models, database migrations, application validation, or
application-specific response types.

The domain layer has no React, Vite, Astro, Express, or Prisma imports.
React-dependent table and icon-renderer types that previously lived in
`@faako/types` now belong to `@faako/ui`.

## Sources audited

- Faako API Prisma schema and onboarding/subscription handlers.
- Dev ERP Prisma schema, authentication access configuration, audit service,
  booking, invoicing, and project routes.
- REEBS Prisma schema, Express/serverless functions, portal pages, and public
  commerce/booking consumers.
- Stroane Prisma schema and handwritten storefront/admin TypeScript API clients.
- Shared audit, configuration, organization, finance, and security packages.

Generated Prisma clients were treated as generated implementation output and
were not used as shared contract sources.

## Domain inventory

| Domain | Current local definitions | Important differences | Shared contract |
| --- | --- | --- | --- |
| User | Faako API `User`; Dev ERP `User`; REEBS `User`; Stroane `SiteUser`; several session payloads | Faako membership roles are organization-scoped; Dev ERP has one organization/role per user; REEBS uses role strings plus JSON permissions; Stroane supports built-in and custom portal roles | `User` exposes identity, contact, organization/role references, display names, and status; credentials, tokens, lock counters, and ORM relations stay local |
| Organisation | Faako API, Dev ERP, and REEBS `Organization`; app helpers use organization objects | IDs are string or integer; hierarchy exists only in Dev ERP; Faako has slug/status/currency; REEBS currently has a minimal tenant record | `Organisation` uses the repository spelling-neutral concept while retaining existing wire field names through adapters |
| Role | Dev ERP `Role`; Stroane `PortalRole` and `SiteRole`; REEBS role strings | Permissions are module lists, action matrices, or JSON objects depending on application | `Role` describes the definition; `PermissionGrant` describes assignment |
| Permission | Dev ERP `{ modules }`; REEBS JSON permissions; Stroane module/action matrix | A module entitlement is not identical to a resource action | `Permission` is a keyed definition; resource/action are optional; grants retain scope and allow/deny effect |
| Product | REEBS `Product`; Stroane legacy `Product`, `CatalogueProduct`, storefront `Product`, and admin `AdminProduct` | REEBS stores prices in minor units and operational stock on the product; Stroane catalogue uses decimal prices and separate inventory records | `Product` contains stable catalogue identity and an explicit `Money` value; media, variants, publishing, sourcing, and stock projections remain extensions |
| Category | REEBS `SourceCategory` and `SpecificCategory`; Stroane `CatalogueCategory`; storefront `Category = string` | REEBS has source/specific category layers; Stroane supports a parent/group presentation | `Category` supports hierarchy, slug, status, and ordering without fixing a taxonomy model |
| Customer | REEBS `Customer`; Stroane `CustomerAccount`, `CustomerProfile`, checkout snapshots, and `AdminCustomer` | REEBS customer is an organization-owned contact; Stroane customer can authenticate and has invitation/account lifecycle fields | `Customer` excludes authentication material; account/invitation fields remain in Stroane extensions |
| Inventory | REEBS `InventoryVariant` and `StockMovement`; Stroane `InventoryItem`, movement, alert, and UI draft types; REEBS also keeps legacy product stock | Available stock can be stored or calculated; product/variant identity differs | `InventoryItem` and `InventoryMovement` define quantities, status, references, and timestamps; alerts, offline drafts, and calculation flags stay local |
| Order | REEBS `Order`/`OrderItem`; Stroane `CommerceOrder`/item, checkout response, customer order, and admin order | REEBS totals are predominantly minor units; Stroane totals are decimal major units; fulfillment and payment state machines differ | `Order` and `OrderLine` use explicit `Money` objects and open domain-owned statuses |
| Booking | Dev ERP `Booking`; REEBS `Booking`/`BookingItem`; public booking form payloads | Dev ERP bookings are calendar appointments; REEBS bookings are rental/event commitments with products and money | `Booking` holds the common scheduled commitment; `BookingLine` is optional for rental/product bookings |
| Invoice | Dev ERP `Invoice`/line item; REEBS invoicing/accounting response objects; Stroane receipts | A receipt proves a completed transaction and is not an invoice; REEBS invoice views are not one stable persisted model | `Invoice` and `InvoiceLine` cover billing documents; receipts remain a distinct application type |
| Payment | Faako subscription payments; REEBS order payments; Stroane Paystack/order payment fields; rent payments in Dev ERP | Payment ownership, providers, units, and lifecycle states differ | `Payment` requires explicit money unit and leaves provider/method/status application-owned |
| Vendor | REEBS `Vendor`; Stroane `Supplier` and supplier contacts | REEBS vendors are expense/procurement counterparties; Stroane suppliers specifically source catalogue and inventory items | `Vendor` is the common external trading party; supplier-specific product links, lead times, bank data, and contacts remain extensions |
| Employee | REEBS `EmployeeProfile` linked to `User`; Stroane site-user job fields; Dev ERP users can act as staff | Employee profile and application user are separate identities in REEBS but combined elsewhere | `Employee` can reference a user without implying that every employee has application access |
| Application access | Dev ERP role/module access; REEBS role and permissions; Stroane built-in/custom roles and action matrix | Authentication sessions are separate from effective authorization | `ApplicationAccess` contains resolved role IDs, permission keys, module keys, and unrestricted state; it never contains tokens |
| Audit event | Dev ERP and REEBS `AuditLog`; Stroane inventory audit entries and admin audit API types; shared audit constants | A persisted audit log and a pre-persistence event have different lifecycle; field names differ (`target`, `entity`, `subject`) | `AuditEvent` is the portable event with actor, subject, source, status, request ID, metadata, and occurrence time |

## Canonical primitives

### IDs

`DomainId` is `string | number`. The package does not coerce between CUIDs,
UUIDs, integer database IDs, slugs, and external references. An adapter must
preserve the identifier’s meaning.

### Dates

Shared boundaries use ISO date/time strings. Database `DateTime` objects and UI
date objects must be serialized before crossing the boundary.

### Money

`Money` requires:

```ts
{
  amount: number | string;
  currency: string;
  unit: "major" | "minor";
}
```

The unit is mandatory because REEBS commonly stores integer pesewas/cents while
Dev ERP and Stroane also expose decimal major-unit values. A bare number is not a
safe cross-system money contract.

### Statuses

Statuses remain strings at the shared layer. Each bounded context owns its state
machine. For example, an order’s payment status must not be treated as its
fulfillment status, and a customer account status is not a general user status.

### Metadata

Domain metadata is read-only unknown JSON-shaped data. Shared types do not assert
the schema of an application-specific metadata object.

## Concepts that remain distinct

- `User`, `Customer`, and `Employee` may refer to the same person but represent
  application identity, commercial relationship, and employment respectively.
- `Role` is a named access definition; `Permission` is an action/capability;
  `ApplicationAccess` is the resolved effective authorization.
- `Product` describes what is offered; `InventoryItem` describes tracked stock.
- `Order` is a commercial commitment; `Booking` reserves time/resources;
  `Invoice` requests payment; `Payment` records money movement; a receipt proves
  a transaction.
- A persisted audit-log row may implement `AuditEvent`, but ORM fields and
  database relations are not part of the shared event.
- Existing `Organization` schema and wire names are not renamed in this task.
  The shared contract is `Organisation`; adapters map only at typed boundaries.

## Pilot adoption

Stroane’s `CustomerProfile` in `src/api/customerAccount.ts` now extends
`Customer<string>`.

This boundary was selected because:

- it is already TypeScript and already depends on `@faako/types`;
- it is a read/write customer profile contract rather than a payment or webhook
  acknowledgement;
- the shared fields match without changing JSON names or runtime behavior;
- Stroane-specific invitation, delivery, and account lifecycle fields remain
  local.

No API response, database model, validation rule, or deployed payload changed.
`AdminCustomer`, checkout customer snapshots, and REEBS customers remain local
until separate consumer audits confirm their compatibility.

## Adoption pattern

1. Choose one API or event boundary, not a Prisma model.
2. Record its current field names, ID representation, money unit, status values,
   nullability, and all consumers.
3. Extend or compose the smallest shared domain contract.
4. Keep application-only fields in a local interface.
5. Add an adapter when field names or representations differ; do not use type
   assertions to hide differences.
6. Type-check both the shared package and the consuming application.
7. Add runtime validation separately when untrusted payloads cross the boundary.
8. Remove a duplicate local type only after every consumer uses the same meaning.

## Exclusions

- Password hashes, reset tokens, session tokens, CSRF values, and provider
  secrets.
- Prisma relation properties, generated enums, `Decimal`, and generated input or
  payload types.
- React nodes/components, browser APIs, request/response objects, and framework
  contexts.
- Form drafts, table/view models, filters, summaries, and offline-queue records
  unless they become stable integration contracts.
- A repository-wide status enum or automatic database-to-API serialization.

## Recommended next adoption

Adopt `AuditEvent` at the shared audit-service boundary used by Dev ERP and
REEBS. Their persisted `AuditLog` fields are already closely aligned, and an
adapter can map `targetType/targetId` to `subject` without changing either
database schema.

## Validation

Validated on 2026-07-26:

- `@faako/types`, `@faako/ui`, and Stroane focused lint and type-checks passed;
- repository lint passed in all 28 active workspaces with existing non-fatal
  React hook and fast-refresh warnings;
- repository type-check passed in all 13 applicable workspaces;
- all 79 Stroane Node tests passed;
- the Stroane production build passed;
- `@faako/types` contains no React, Vite, Astro, Express, or Prisma imports;
- `git diff --check` passed.
