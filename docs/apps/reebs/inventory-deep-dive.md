# REEBS Inventory deep dive

Status: completed implementation pass (2026-09-02)

## Outcome and boundary

REEBS Core Inventory now has an explicit adjustment domain boundary, transactional stock mutations, idempotency support, clearer operational quantities and a read-only reconciliation tool. The work preserves the existing Faako portal design and stops short of rewriting the large Inventory page or every legacy stock-writing integration.

Water remains a standalone business domain. Core Inventory excludes active Water-linked products and `WATER` source products from its list, activity, public counts and analytics. It does not combine Water stock, sales, costs, revenue or profit with rental/event or shop data.

## Current architecture discovered

The route `/admin/inventory` renders the Inventory area within the shared portal shell. Most frontend behavior still lives in `src/pages/Admin/Admin.jsx`, with styles split under `src/pages/Admin/styles`. Product and variant summaries come from `/api/inventory`; variants use `/api/inventoryVariants`; stock mutations use `/api/stock`; maintenance uses `/api/maintenance`; and item movement history uses `/api/stockActivity`.

The persisted model is:

- `product.stock`: physical on-hand quantity for standard products; owned capacity for rental products; aggregate active variant stock for variant parents.
- `inventoryVariant.stockQty`: physical quantity of a variant.
- `inventoryVariant.reservedQty`: operational committed quantity for the variant. Booking records remain the authoritative date-specific rental reservation source.
- `stockMovement`: append-only Core stock-change evidence.
- `booking` and `bookingItem`: authoritative rental commitment and date-window availability records.
- `order` and `orderItem`: authoritative shop-sale transaction records; order stock mutations remain transactional in the Orders domain.
- `maintenanceLog`: whole-product maintenance state. This pass does not introduce per-unit asset tracking.
- Water tables: independent Water product, restock, sale and adjustment ledgers. A generic product link is identity context only.

The representative backend pattern is now `inventoryDomain` → `inventoryService` → `inventoryRepository`. The HTTP stock handler performs authentication/authorization and input normalization, then delegates the transaction. This proves the target module pattern without rewriting all Inventory, Orders or Bookings functions.

## Stock-state model

Before this pass, manual adjustments were transactional but stock could also be edited through the generic product endpoint, offline requests did not transmit their idempotency key, Water-linked products could appear in Core inventory, and movement history lacked stable request/source/balance fields.

After this pass:

- Existing stock is changed only through an audited stock action or an owning domain transaction. Generic product edits reject a changed stock value with `INVALID_STOCK_ADJUSTMENT`.
- Opening stock is recorded in the same transaction as product creation.
- Adjustment quantity must be a positive whole number and the resulting quantity cannot be negative.
- Product and variant rows are locked before mutation. Conditional updates prevent final-stock races from overselling.
- A unique organisation-scoped idempotency key makes retrying the same adjustment safe.
- Movement records can store source, source identifier, previous balance and resulting balance.
- Variant parents derive stock from active variants. Direct parent-stock adjustment is rejected.
- Rental stock is capacity, not sale inventory. Removing rental capacity requires `CAPACITY_CORRECTION` and cannot reduce capacity below the peak quantity already booked on any active date.
- Rental availability remains date-specific and is not represented as a universal “available now” number.

### Stock invariant matrix

| Inventory type | Invariant | Verified | Remaining issue |
|---|---|---:|---|
| Standard/shop product | `stock >= 0`; availability is on-hand stock | Yes, service/tests/schema check | Historic movements may not reconstruct opening stock |
| Variant product | Parent stock equals sum of active variant `stockQty` | Service/reconciliation | Some legacy direct variant edits remain supported but audited |
| Variant availability | `max(stockQty - reservedQty, 0)` | View model/repository | One shared reservation service is deferred |
| Rental product | `stock` is owned capacity; availability is evaluated for booking dates | Service/query/docs | Inventory detail does not yet list related booking windows |
| Maintenance item | Any open maintenance record keeps the product unavailable | Handler/reconciliation | Per-unit maintenance is not modelled |
| Water product | Water ledger is authoritative and excluded from Core Inventory | API filters/service/tests | Linked generic product remains for identity context |

## Workflows and integration

Receive Stock and Remove Stock both use `/api/stock`. The request includes a stable idempotency key, product/variant, whole quantity, reason code and optional human-readable reference/notes. The actor is taken from the authenticated server session; client-supplied actor fields are ignored. Failed offline submissions are queued locally, but no authoritative quantity is changed until the server accepts the request.

Bookings own rental reservation and release behavior. Inventory exposes date-based status and derived reserved/in-use summaries, but does not create an alternative booking calendar calculation. Orders retain their existing transactionally locked stock mutation path. This pass does not force both mature domains through a new API in one risky rewrite; consolidating their lower-level availability contract is deferred.

Returns are supported where the owning Orders/Bookings workflow already implements them. Rental return does not add capacity because rental checkout does not remove owned capacity. Damage, loss and disposal are accepted audited reason codes, but a complete per-unit damage/loss workflow is not present; those capabilities are `PARTIAL`, not fabricated as complete.

Maintenance create/update is organisation-scoped and excludes Water. Resolving one record reactivates a product only when no other open maintenance record exists and the product is not archived/deleted. Inventory database clients now use the shared connection-error listener, preventing an emitted `pg` error from crashing the process unhandled.

## API, permissions and errors

- Read: server permission `inventory:read`.
- Stock mutation/variant mutation: server permission `inventory:write`, with owner/admin/manager role protection on the current routes.
- Maintenance: `maintenance:read` and `maintenance:write`.
- Water: rejected at the Core boundary with `INVENTORY_SCOPE_CONFLICT`.
- Other machine-readable stock errors: `INVENTORY_NOT_FOUND`, `INSUFFICIENT_INVENTORY`, `INVALID_STOCK_ADJUSTMENT`, `INVALID_INVENTORY_STATE`, and `INVENTORY_CONFLICT`.

Mass assignment is reduced: staff edit requests allow name, description and price only; reserved variant quantity is not client-editable; generic stock changes are rejected; negative and fractional quantities are rejected. High-risk stock changes record actor, reference, source and before/after balances.

## UI and Ghana operations

The existing Faako theme, cards, tokens and navigation are preserved. No new coloured-border visual language or module redesign was introduced.

The register prioritises item name/SKU, Total, Available or Check dates, Reserved, In Use, maintenance/status and next actions. Search continues to cover product name, SKU and category. Low-stock behavior now uses each product’s configured reorder level rather than duplicated magic thresholds across Inventory-adjacent portal views. The detail stock field is read-only and directs staff to Adjust stock so changes cannot silently bypass audit. Movement history is loaded only when requested and is paginated in pages of at most 50.

### Ghana business readiness

| Area | Supported | Implementation | Remaining issue |
|---|---:|---|---|
| Simple staff terminology | Yes | Add stock, Remove stock, Total, Available, Reserved, In Use | Damage/loss workflows need dedicated screens if required |
| Mobile operations | Yes | Responsive list/cards, detail drawer and adjustment modal | Final physical-device review remains recommended |
| Fast item search | Yes | Name, SKU/reference and category filtering | Server pagination/search is deferred for very large catalogues |
| Human-readable SKU/reference | Yes | SKU and optional adjustment reference | Legacy records may have missing SKU/reference |
| Low-stock clarity | Yes | Per-item reorder level and separate out-of-stock state | Replenishment automation is out of scope |
| Damage/maintenance clarity | Partial | Reason code plus maintenance records | No per-unit asset/damage model |
| Weak-network recovery | Yes | Draft queue plus server-confirmed mutation and idempotency | Offline queue still requires later connectivity |
| Permission-controlled adjustments | Yes | Server session, role and permission checks | Custom-role matrix should be reviewed operationally |
| Configurable thresholds | Yes | `reorderLevel` and `reorderQuantity` per product | No supplier procurement workflow |

## Capability matrix

| Capability | Before | After | End-to-end | Status |
|---|---|---|---:|---|
| Inventory list | Connected | Water-safe operational summary | Yes | COMPLETE |
| Item detail | Connected | Stock is read-only; history is lazy | Yes | COMPLETE |
| Available quantity | Duplicated | Core summary/view model; rentals say Check dates | Yes | COMPLETE |
| Reservations | Booking/variant owned | Reconciled and surfaced | Mostly | PARTIAL |
| In use | Booking-derived | Surfaced for rental inventory | Yes | COMPLETE |
| Receive stock | Connected | Transactional, audited, idempotent | Yes | COMPLETE |
| Adjustment | Multiple paths | Dedicated service; generic edit blocked | Yes | COMPLETE |
| Damage | Notes/manual removal | Explicit audited reason | No dedicated lifecycle | PARTIAL |
| Maintenance | Connected | Org/Water-safe; multiple-open guard | Yes, whole item | COMPLETE |
| Low stock | Mixed thresholds | Per-item reorder level | Yes | COMPLETE |
| Movement history | Unbounded aggregate views | Lazy item pagination | Yes | COMPLETE |
| Booking integration | Connected | Capacity floor enforced | Yes | COMPLETE |
| Order integration | Connected | Existing transaction path preserved | Yes | COMPLETE |
| Water isolation | Incomplete | List/activity/counts/analytics/mutation boundary | Yes | COMPLETE |
| Audit | Actor/movement | Before/after/source/idempotency | New writes | COMPLETE |
| Reporting | Basic | Reliable Core stock activity/analytics | Partial | PARTIAL |
| Mobile | Existing responsive UI | Explicit narrow-width coverage | Yes | COMPLETE |

## Reconciliation and historical data

`scripts/maintenance/reconcileInventory.mjs` opens a read-only transaction and checks negative product/variant quantities, variant-parent drift, reservation-counter drift, maintenance availability drift, orphan movements and duplicate idempotency keys. It also reports, but does not mutate, Water-linked products excluded from Core and historical movement/opening-balance gaps.

Historical movement gaps are informational because older imports predate the ledger. No synthetic movement or cost history is fabricated. Reconciliation is intentionally read-only and production execution requires an explicit readiness-check opt-in.

Legacy Inventory import files were audited. `importProducts.js` has SKU-based reuse and an optional reset mode, but it lacks a modern dry-run, explicit organisation scope, movement-ledger integration and complete duplicate/variant validation. `backfillInventoryIds.js` targets the retired `inventory` model. These scripts must not be treated as approved live-stock tools. They were preserved for evidence and are deferred for a separately reviewed import migration; no live data was overwritten in this pass.

The development reconciliation also found that Water product key `gwater-15pk` is actively linked to generic product ID 165, `Baby pipkin water teether`. That identity looks inconsistent with the Water Business pack and requires manual business confirmation. It was not silently re-linked. Because active Water links are intentionally excluded from Core Inventory, this configuration should be corrected before deployment if the linked shop product is meant to remain Core inventory.

## Optimization matrix

| Area | Before | Change | Result |
|---|---|---|---|
| Large frontend file | `Admin.jsx` 6,303 lines | Shared inventory view model extracted; history added in-place | 6,376 lines; further component split deferred |
| Large backend file | `inventory.js` 2,284 lines | Stock orchestration extracted | 2,426 lines because operational summary/boundary SQL was added; CRUD split deferred |
| Stock handler | 284 lines | Thin handler delegates domain/service/repository | 84 lines |
| Duplicate stock logic | Hardcoded low-stock thresholds in adjacent views | Shared reorder helper/status rule | Configurable per item |
| Query count | Detail could rely on broad activity payload | One paginated item-history query on demand | Reduced initial detail work |
| Query efficiency | Movement history not item-paginated | Indexed organisation/product/date and limit/offset | Bounded to 50 rows/request |
| API payloads | List already omitted full movement history | Operational summary fields only; history separate | Appropriate summary/detail split |
| Render/fetch behavior | Inventory list transforms memoized; history absent | History fetched only on explicit action | No extra initial movement request |
| Dependencies | No dedicated Inventory library | No dependency added | Dependency surface unchanged |
| CSS | Existing split styles | Small status/history responsive additions | Faako theme retained |

The measured source baseline was captured before changes in this pass. The immediately preceding Inventory chunk was 124.02 kB / 30.47 kB gzip for JavaScript and 302.67 kB / 47.27 kB gzip for CSS. The final chunk is 124.77 kB / 30.87 kB gzip for JavaScript and 304.01 kB / 47.52 kB gzip for CSS. Shared extracted Inventory helpers add 2.11 kB / 0.89 kB gzip and are reusable by other lazy portal routes. This is a small feature cost, not a claimed runtime speed benchmark.

## Files and schema

Representative new boundaries:

- `backend/modules/inventory/inventoryDomain.js`
- `backend/modules/inventory/inventoryService.js`
- `backend/modules/inventory/inventoryRepository.js`
- `src/domains/inventory/inventoryViewModel.js`
- `scripts/maintenance/reconcileInventory.mjs`

The additive migration `20260831193000_inventory_integrity` adds movement idempotency/source/balance fields, supporting indexes and non-validating nonnegative constraints. It was created but is not applied by this implementation pass. Deployment order is migration first, then application code that writes or reads the new movement fields.

## Remaining debt and decisions

- `Admin.jsx` and `backend/functions/inventory.js` remain multi-responsibility hotspots. Split register, detail, adjustment, import and CRUD concerns incrementally after browser characterization tests are stable.
- Inventory list filtering/pagination remains client-side and returns the complete summary list. Introduce server pagination only with a compatibility adapter for storefront and portal consumers.
- Bookings, Orders and Inventory still have domain-specific stock operations. A shared availability/reservation contract should be designed before redirecting mature transaction paths.
- Variant absolute stock edits remain a supported audited compatibility path. Moving them entirely to delta adjustments needs a product decision and migration of current autosave UX.
- Damage/loss/disposal have auditable reasons but not per-unit asset lifecycle records.
- Maintenance is whole-product, not per serialised asset.
- Imports need a dedicated dry-run, organisation-scoped, idempotent staging workflow before any further bulk load.
- Existing historical movement gaps, missing identifiers and any reconciliation discrepancies require reviewed backfill decisions; do not invent records.
- No reliable rental-utilisation percentage was added. It requires an agreed denominator and date window from Bookings.
- Customers deep dive should consume organisation-scoped Inventory summary/availability contracts only. It must not calculate stock or expose Water cost/profit and should not begin until the migration is reviewed and reconciliation passes in the target environment.

## Verification record

- Portal tests: 143 tests passed, 0 failed. This includes Inventory transaction, concurrent final-stock, idempotency, Water boundary, Bookings, Orders, authentication and offline queue coverage.
- Focused Inventory tests: 18 passed, including rental-capacity floor and idempotent replay after newer bookings.
- Browser checks: three Inventory Playwright flows passed across the completed runs. The page has no horizontal document overflow at 320, 375, 390, 430, 768, 1024 or 1440 pixels; operational states exclude Water finance; item detail and lazy movement history work.
- Portal lint: 0 errors. The workspace retains unrelated/pre-existing warning debt; no lint rule was weakened.
- Portal production build: passed, 1,567 modules transformed.
- Website lint: 0 errors, 8 existing warnings.
- Website typecheck: 140 files, 0 errors/warnings/hints.
- Website tests: 8 passed, 0 failed.
- Website production build: passed, 1,125 static pages generated.
- Static storefront route audit: passed with 1,125 HTML routes, 22 rental details, 1,045 shop details and 18 linked assets.
- Prisma development validation and generation: passed.
- Development reconciliation: final read-only run passed with no blocking discrepancies. It reported 28 historical ledger/opening-balance gaps and one active Water-linked generic product as informational. An intermediate retry encountered a transient DNS `ENOTFOUND`; no data was changed by any run.
- Release prerequisites: tooling, 26 workspace manifests and conflict-marker scan passed.
- Security scan: passed across 2,277 non-ignored workspace files.
- Security gate: passed app configuration, headers, environment exposure, auth storage and CORS checks.

The additive migration was validated but not applied by this pass. No production migration, import, backfill, stock rewrite or Git command was run.
