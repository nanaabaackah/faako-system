# REEBS Portal Modernisation

## Architecture guardrail

REEBS Portal remains React/Vite and owns authenticated POS, master-data, inventory, ordering, finance, and administration workflows. It remains separate from the public REEBS Astro website. Public catalogue code and database ownership must not be reintroduced here or moved into the public app as part of this programme.

## Batch plan

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Users, roles, customers, vendors, directory | Implemented and validated |
| 2 | Products, inventory, orders, bookings, delivery | Implemented and validated |
| 3 | Invoicing, payments, expenses, accounting | Deliberately deferred |
| 4 | HR, timesheets, maintenance, scheduler, documents, marketing, water, settings | Deliberately deferred |

The programme must stop after each batch until targeted and repository checks are explained and healthy.

## Batch 1 implementation

### Shared API boundary

`src/api/client.js` is the compatibility seam for existing REEBS response consumers. It delegates requests to `@faako/api-client`, adding request IDs, standard credentials, JSON parsing, cancellation support, and shared API error classification. It then reconstructs the legacy `Response` surface so existing pages can continue their current `response.ok`, `response.status`, and `response.json()` handling.

The client resolves `globalThis.fetch` at request time. This preserves the installed REEBS auth/organisation interceptor from `@faako/core`, including its existing session-expiry behavior. This is an incremental adapter, not a competing auth implementation.

Adopted Batch 1 pages:

- `AdminCustomers`
- `AdminDirectory`
- `AdminRoles`
- `AdminVendors`

Their direct native fetch calls were removed only after the compatibility seam was established.

### Shared validation

- Customer create/edit paths use the compatibility `customerMasterDataFormSchema`, which intentionally preserves name-only directory records.
- User creation paths use `userAccessFormSchema`.
- Role inputs use `roleFormSchema` where the page owns a role form.
- Vendor inputs use `vendorFormSchema`.
- Validation errors remain user-safe and are displayed through existing form notices.

### UX behavior

- Existing initial-loading, empty, error/retry, success, and submission-loading states were retained.
- Existing duplicate-submit disabling was retained.
- Customer archive continues to use the shared confirmation dialog.
- Master-data forms now register unsaved-change warnings while edited.
- `401` and `403` responses crossing the new seam use session-expired and permission-denied messages instead of raw backend text.

### Permission consistency

- Users continue to use shared `users:read` and `users:write` identifiers, including the established driver-read compatibility path.
- Vendor reads/writes now use `vendors:read` and `vendors:write` through backend enforcement. Tests prove parity for owner, admin, manager, and previously denied roles.
- The customer endpoint remains a documented mixed boundary: authenticated directory CRUD and restricted public lookup/creation share one handler. Its public behavior supports ordering and enquiry flows, so permission refactoring is deferred until those routes can be separated without changing accepted public inputs.
- Frontend checks remain UX only; backend enforcement remains authoritative.

### Known functional gap retained

The current REEBS users endpoint does not expose a persisted activation/deactivation operation. UI labels or placeholder menu items must not be treated as implemented deactivation. Adding status persistence, session invalidation, and last-owner/admin safeguards requires a separate, tested backend change.

## Batch 1 validation

| Check | Result |
| --- | --- |
| Shared validation tests | Passed, 13 tests |
| REEBS API compatibility seam and permission tests | Passed within the 99-test portal suite |
| REEBS Portal lint | Passed with 11 pre-existing warnings and no errors |
| REEBS Portal build | Passed |
| Repository lint | Passed, 28 workspaces; existing warnings only |
| Repository typecheck | Passed, 15 workspaces |
| Repository test | Passed, 20 workspaces |
| Repository build | Passed, 10 buildable applications |
| Aggregate `pnpm check` | Passed |

## Batch 2 implementation

### Commercial API boundary

The following operational screens now use the existing `reebsApiResponse` compatibility seam instead of direct native fetch calls:

- product and inventory administration, including categories, templates, archive/restore, stock adjustments, and rentals;
- order builder, order list/detail data, fulfillment, payments, receipts, and Store Mode/POS;
- booking administration, including the existing offline status queue; and
- delivery planning and updates.

The adapter continues to return a `Response`, so no endpoint contract was changed. It adds request IDs, consistent cookie credentials, normalized network/error behavior, and the existing session interceptor. Abort signals and idempotency keys are preserved. Unsafe mutations are not retried automatically.

### Validation and mutation safeguards

- `orderCreateInputSchema` validates the manual order boundary while stripping actor fields from the shared model. Existing actor attribution is appended only after validation.
- Order lines accept any non-negative set price, preserving the approved frontend set-price behavior.
- `bookingStatusTransitionSchema` prevents unsupported booking status actions before online or offline submission.
- `deliveryUpdateSchema` validates supported delivery states and public-safe notes.
- Existing server-side stock reservations, transaction boundaries, tenant checks, audit events, duplicate-submit locks, optimistic rollback, offline conflict review, and destructive confirmations were preserved.
- Order creation retains its idempotency key; stock is updated locally only when the API confirms `stockCommitted`.
- Order Builder now warns before abandoning a meaningful draft and clears the customer and discount after successful creation.

### Application boundaries

The portal remains the authenticated owner of these workflows. The public REEBS Astro website is not coupled to portal persistence, admin authentication, or database code. Shared validation contains only framework-independent request fields and no user, payment, or server-managed secrets.

## Batch 2 validation

| Check | Result |
| --- | --- |
| Shared validation tests | Passed, 14 tests including commercial operation cases |
| REEBS Portal tests | Passed, 99 tests |
| REEBS Portal lint | Passed with 11 existing warnings and no errors |
| REEBS Portal production build | Passed |

## Deferred batches

Batches 3 and 4 are deliberately deferred. They are not prerequisites for the final whole-system audit because their current behavior remains unchanged, their gaps are explicitly tracked, and no partial finance/people migration has been represented as complete. Each must be resumed as its own reviewed batch with targeted tests before shared-adapter adoption continues.

## Rollback

Pages can return individually to their original fetch calls because response shapes were not changed. The permission rollback is a return to the previous owner/admin/manager vendor role list; the parity tests demonstrate that the shared permissions currently grant the same access. Batch 2 schema checks can be removed independently without changing backend contracts, but that would also remove the new early feedback and should require a regression reason.
