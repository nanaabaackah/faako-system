# Stroane admin modernisation

Date: 2026-08-02

Framework: React/Vite retained

## Completed or verified

- Created an admin-only entry graph and `dist/admin` deployment artifact.
- Lazy-loaded admin workflow routes; the initial admin application chunk is 55.75 kB raw (16.45 kB gzip), down from the pre-split 257.94 kB portal application chunk.
- Applied an admin-specific CSP and `noindex` policy without public analytics or Paystack browser origins.
- Removed the copied public sitemap and portal-specific metadata identifies the artifact as the private Stroane Admin surface.
- Kept HttpOnly staff-cookie authentication and backend permission enforcement.
- Confirmed module/action permissions use `@faako/security` identifiers.
- Piloted `@faako/api-client` in the complete admin inventory API adapter, adding shared request IDs, credentials, parsing, and safe error categories.
- Adopted that shared client in the customer directory and staff session/team adapters while preserving existing response and status semantics.
- Adopted the shared client in the product and order adapters, including Paystack initialization/status refresh, without moving payment secrets into the browser.
- Piloted `@faako/validation` for inventory movements in both the admin form boundary and backend validation boundary.
- Applied shared product validation to create/edit forms and shared order-transition validation to the backend mutation boundary.
- Rejects unsupported order statuses with a user-safe `400 VALIDATION_ERROR` instead of silently ignoring the requested transition.
- Applied shared customer, username, and role validation to the Batch 1 customer/team forms.
- Added unsaved-change protection and explicit confirmation before role deactivation or user disablement.
- Rejects negative stock drafts instead of silently clamping them to zero.
- Verified backend rejection of negative on-hand stock, negative reserved stock, oversubscription, and invalid movement types.
- Verified stock movement history is loaded and displayed independently from current stock.
- Verified inventory item updates and movements create audit records in the same transaction as stock changes.
- Verified destructive product archive/delete-listing actions require confirmation.
- Preserved offline queue, loading, warning, error, retry, and cached-data states.

## Shared architecture adoption

| Concern | Shared source | Stroane adoption |
| --- | --- | --- |
| Catalogue contracts | `@faako/types` | Public product/category base types |
| Validation | `@faako/validation` | Inventory movement, product, order transition, and customer/team forms |
| API behavior | `@faako/api-client` | Inventory, product, order, customer, session, user, and role adapters |
| Permissions | `@faako/security` | Existing backend and frontend identifiers |
| UX states/confirmations | `@faako/ui` | Existing ERP state components and destructive actions |
| Logging | `@faako/logger` | Existing API request logger/redaction path |
| Audit data | Shared audit conventions plus app database | Transactional inventory movement/audit records |

## Batch 2 validation

- Typecheck passed.
- The 87-test Stroane suite passed, including protected order-route permission coverage, negative/oversubscribed stock safeguards, payment tests, and the new supported/unsupported order-transition test.
- Storefront and admin production builds passed independently.

## Incremental follow-up

Receipts and accounting remain deliberately deferred with the finance batch. Resume them one module at a time; do not alter existing API contracts or payment ownership while doing so.
