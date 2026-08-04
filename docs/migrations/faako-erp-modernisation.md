# Faako ERP Modernisation

## Decision and scope

Faako ERP remains React 18 with Vite. It is currently a scenario-driven demonstration application rather than an authoritative operational client: `Customers` and `Vendors` render records from `src/data/demoScenarios.js`, their actions do not submit mutations, and the application has no user or role administration routes.

The shared Dev ERP infrastructure must not be copied into this application until Faako ERP has a real backend workflow. Its existing demo-access boundary already uses `@faako/api-client` and compatible API contracts.

## Batch status

| Batch | Status | Current decision |
| --- | --- | --- |
| 1 — Identity and master data | Complete as an assessed exception | Preserve customer/vendor demonstrations; do not present non-functional buttons as production CRUD or add artificial loading/errors around synchronous fixtures. Users, roles, and directory are not implemented here. |
| 2 — Commercial operations | Complete as an assessed exception | Product, inventory, order, and booking screens remain synchronous scenario fixtures; no authoritative mutation is available to migrate. Delivery is not implemented. |
| 3 — Finance | Deliberately deferred | No finance mutation is approved in this programme yet. |
| 4 — People and operations | Deliberately deferred | No people/operations mutation is approved in this programme yet. |

## Batch 1 findings

- Customer and vendor domain data is local display content, not an API response.
- There is no session-expiry or permission-denied state attached to those pages because no protected request occurs.
- There are no customer/vendor forms to migrate to `@faako/validation`.
- Adding shared `User`, `Role`, `Customer`, or `Vendor` imports solely to type JavaScript fixtures would not improve an operational boundary.
- Current primary/secondary customer and vendor buttons are demonstration controls and should not be described as complete production workflows.

## Application-specific exception

The common operational modernisation pattern begins when a workflow becomes data-driven. Before customer or vendor CRUD is enabled, the implementation must define an authoritative API, permission identifiers, tenant rules, validation, request/error handling, audit events, and tests together. Dev ERP or REEBS application-owned APIs may be reused through contracts; their persistence logic must not be copied into Faako ERP.

The same exception applies to Batch 2. Adding loading, retry, permission, API-client, or mutation validation behavior to static product/order/inventory/booking scenarios would imply an operational backend that does not exist. The fixtures were reviewed and left unchanged; they must not be described as production stock, order, booking, or delivery workflows.

## Required future pilot

When Faako ERP receives its first real master-data workflow, pilot a single customer directory end to end with:

1. shared `Customer` types and customer validation;
2. an app-local adapter over `@faako/api-client`;
3. backend-enforced read/write permission identifiers;
4. loading, empty, error/retry, permission-denied, and session-expired states;
5. duplicate-submit and unsaved-change protection; and
6. focused contract and permission tests.

Do not remove the demo scenarios until route and visual parity has been approved separately.
