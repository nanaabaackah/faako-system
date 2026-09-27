# REEBS public commerce pause and table controls

## Release policy

Public Shop purchases and Rental submissions are paused. Catalogue pages, public
URLs, galleries, search and contact navigation remain available. This is not a
stock-level change and does not mark inventory out of stock.

`packages/config/src/publicCommerce/reebsPublicCommerce.js` is the shared,
code-reviewed policy. Both flags default to false. There is no environment,
query-string, local-storage or client-body override. Reopening needs an approved
code change and the retained enabled-commerce regression tests.

- `createOrder` and `checkoutQuote` reject public POSTs with HTTP 403 and
  `PUBLIC_COMMERCE_DISABLED` before database/provider work.
- Anonymous `bookings` POSTs are rejected before database work. Supplying a
  credential is not enough: the existing session verification, `bookings:write`
  permission, organization scoping and CSRF controls remain authoritative for
  internal staff requests.
- Versioned checkout/bookings routes resolve to these same handlers. OPTIONS
  remains available. Internal `orders`/POS and Water sales are not disabled.
- Checkout and Book render the paused state without mounting transaction forms.
  Add-to-cart controls and context writes are disabled; saved carts are retained
  but cannot submit. Product structured data omits online offers while paused.

These are **local code changes, not a claim about deployed state**. The API must
be released before, or together with, the storefront. An old cached storefront
must still be rejected by the new API. No deploy or database change is performed
by this implementation. Verify both legacy and versioned POST paths in isolated
staging before promoting; do not use an old API behind the new disabled buttons.

## Table behavior

The local `src/components/TableControls` helpers reuse Faako table classes,
theme variables and Iconsax. They do not replace navigation, cards or branding.

- Numeric amounts/counts and date timestamps sort as values, not formatted text.
- Sorts are stable, missing values stay last, and full client datasets are sorted
  before pagination. Server-paginated datasets must be sorted by the API.
- Reports reuse `@faako/ui` DataTable with opt-in pagination and the existing
  Portal pagination controls. Other DataTable consumers retain their current
  unpaginated behavior; providing a size without controls never hides rows.
- Shared SelectField initial/return focus preserves document scroll so a menu
  opened after navigating a long table stays anchored to its trigger. The mobile
  Reports range picker has a viewport regression check; branding is unchanged.
- Active header state uses `aria-sort`, labeled keyboard-operable buttons and a
  visible focus outline. Action/selection columns are not data sort keys.
- Page selection uses native checkbox indeterminate state and does not open a
  row's detail dialog. Filter changes exclude hidden selections.
- Rental catalogue retains its wide table inside a keyboard-focusable horizontal
  scroll region. Only that inner region scrolls; pagination and bulk actions stay
  in the page width. Mobile pagination uses separate page-label and action rows.
- Bulk archive stops at the first failure without automatic retries. Confirmed
  successes update the UI; failed/unattempted rows remain selectable. After an
  ambiguous network failure, refresh before manually retrying.

### Archive policy confirmed by the owner

Posted payments, issued invoices, accounting entries and audit/history records
remain protected from bulk archive. No cancellation, payment reversal, stock undo,
role deactivation or deletion is relabeled as archive.

Inventory and Rental **catalogue items** use the existing owner/admin-only
inventory archive API and can be restored from Inventory's archived view. Existing
bookings, invoices and posted financial records are not archived by this action.
Existing per-record actions remain subject to their current backend policies.
Water remains a standalone business domain; Water ledger sorting/pagination does
not change its metrics, pricing, cost visibility or purchase-cost permissions.

## Implementation checkpoint

| Register | Current work | Bulk archive |
| --- | --- | --- |
| Inventory | Existing sortable register/selection retained; partial-failure handling repaired | Existing reversible owner/admin action |
| Rental catalogue | Sort all data columns; existing pagination; page checkboxes and mixed state | Existing inventory archive endpoint, owner/admin only |
| Orders | Sort all data columns before pagination; existing toolbar sort retained | None; cancellation is not archive |
| Bookings | Sort all data columns before pagination; show actual booking ID | None; reservations/lifecycle protected |
| Payments | API allowlisted ORDER BY in legacy and universal registers, stable ties, stale response guard | None |
| Invoicing | Sort all list data columns, including actual paid/balance amounts | No bulk action on issued/source financial documents |
| Water orders, stock movement, expenses | Sortable data headers and standard pagination; full-filter summaries retained | None added |
| Expenses | Sort all data columns before existing pagination | None |
| Maintenance | Sort all data columns before existing pagination | None; resolving maintenance is not archive |
| Marketing | Sort data columns and add standard pagination | None; campaign pause is not archive |
| Roles | Sort data columns and add standard pagination | None; account/session lifecycle protected |
| Directory — Users and Vendors | Sort all data columns before existing pagination; stable one-based row numbers | None; account actions are not archive |
| Reports — activity trend and latest audit snapshot | Existing Faako DataTable sorting retained; independent 10-row pagination and reset on sort/range change | None; history protected |

## Remaining work — not certified complete

- CRM: existing server pagination and page-local computed segments/sorting need a
  coherent server-side contract. Do not add misleading current-page sort buttons
  or silently change segmentation rules. Reversible customer bulk archive remains
  to be implemented against its existing authorized endpoint.
- Directory's legacy customer endpoint returns at most 100 records without a
  pagination contract. Its customer tab still needs the same server-side contract
  work as CRM; the Users and Vendors work does not certify that tab.
- Accounting's multiple subregisters and nested variant/detail tables still need
  integration/verification. Editable invoice
  line forms and fixed-order financial statements must not be treated as
  archivable records.
- Existing mobile card layouts hide some table headers. Provide sorting through
  the approved mobile filter pattern where headers are not visible; do not change
  the established table/card layout without approval.
- This checkpoint is not an end-to-end database/provider certification. Real
  PostgreSQL archive rollback, concurrent updates and live release state require
  isolated-environment verification.
- RI-012 linked invoice settlement and RI-018 combined-cart delivery distance
  remain open in the process-integrity audit. Pausing public commerce is not a
  repair to either financial contract.

Verification results are recorded in the dated addendum to
`roadmap-process-integrity-audit.md`.
