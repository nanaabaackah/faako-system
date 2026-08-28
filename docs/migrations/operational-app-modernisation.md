# Operational Application Modernisation Status

Date: 2026-08-04

## Programme decision

Operational applications remain React/Vite. Batch 1 (identity/master data) and Batch 2 (commercial operations) are complete where authoritative workflows exist. Batches 3 and 4 are deliberately deferred so the final whole-system audit can proceed without disguising partial finance or people/operations work as complete.

| Application | Batch 1 | Batch 2 | Notes |
| --- | --- | --- | --- |
| Dev ERP | Implemented/verified | Implemented/verified for the real booking integration | It has no product, inventory, order, or delivery workflow. Booking already uses the app API client with loading, error, retry, save locks, and disconnect confirmation. |
| Faako ERP | Assessed exception | Assessed exception | Customer, vendor, product, inventory, order, and booking screens are scenario fixtures rather than authoritative mutations. |
| REEBS Portal | Implemented | Implemented | Shared validation and compatibility API-client adoption cover the authoritative master-data and commercial workflows. |
| Stroane admin | Implemented | Implemented | Inventory, product, and order boundaries use shared validation/client conventions; backend permissions and stock/payment ownership remain authoritative. |

## Deliberately deferred scope

- Batch 3: invoicing, payments, expenses, and accounting across operational apps.
- Batch 4: HR, timesheets, maintenance, scheduler, documents, marketing, water, and settings.

These deferrals preserve current behavior. They must resume as separate batches with focused permission, validation, audit, API, and transition tests. The final security/quality phase may fix a clear Critical or High issue in a deferred module, but must not use that exception to perform an uncontrolled module rewrite.

## Batch 2 safeguards confirmed

- Backend permissions remain the source of truth.
- Tenant/organisation scope was not broadened.
- Existing API response shapes remain compatible.
- Shared commercial schemas do not expose actor identity, payment secrets, or server-managed state.
- Unsafe requests are not automatically retried.
- REEBS order idempotency, offline review queues, stock transaction behavior, and audit events remain intact.
- Stroane negative-stock, oversubscription, Paystack, protected-route, and audit behavior remain covered by tests.

## Validation evidence

Targeted validation completed before final-phase work:

- `@faako/validation`: 14 tests passed; typecheck passed.
- REEBS Portal: 99 tests passed; lint passed with existing warnings; build passed.
- Stroane: typecheck passed; 87 tests passed; independent storefront/admin builds passed.
