# Water historical price schedules

> Superseded on 2026-10-07. This document records the retired scheduled-pricing
> implementation only. Water now uses current Retail, Company and Bulk prices
> stored in `waterProductConfig`; historical audit entries do not control sales.
> See [Water architecture](water-architecture.md) for the current model.

## Root cause and scope

Water sale creation and quantity/channel/date corrections correctly resolve prices
on the transaction date. Settings and the configuration API previously rejected
historical start dates, preventing owners from supplying the missing policy.
Water product prices now have a dedicated historical scheduling path. Generic
Core, Shared and Water discount commercial rules still reject past starts.

## Settings and effective windows

- Owner/admin plus the existing `water-pricing:manage` authorization is required.
- Both existing-product and new-product forms use Faako DateField controls. A past
  date displays “Historical price schedule” and explains snapshot preservation.
- Dates entered in the UI start at midnight Ghana time (UTC), including today.
- The optional “Ends before” date is **exclusive**. For Jan through August, use
  January 1 as the start and September 1 as the end.
- A blank end means until the next active schedule for the same organization,
  product and price type, or open-ended if none exists.
- An explicit end beyond that next start is rejected with
  `WATER_PRICE_SCHEDULE_CONFLICT` (409). Choose an end on/before that boundary;
  a historical insertion must not silently replace subsequent scheduled prices.
- The existing overlap planner closes or supersedes the covered record and clones
  a trailing period where needed. Records are never deleted. Existing transaction
  references remain valid. The advisory lock and database transaction are retained.
- Current shows effective prices, Schedule shows current/future prices, and History
  includes expired/superseded prices. Expand “Price periods” for dates and amounts.
  Water's view selection does not change Core commercial data selection.

Examples: Jan→open at GH₵30 plus Sep→open at GH₵35 gives Jan→Sep at 30 and
Sep→open at 35. Jan→open at 30 plus Mar→Jun at 28 gives Jan→Mar at 30,
Mar→Jun at 28 and Jun→open at 30. Future scheduled periods survive either operation.

## Transaction and audit guarantees

Scheduling only writes `waterProductPrice` and the existing audit log, never
`waterSale`, stock, payments or Core financial records. Sale unit price, standard
price, schedule ID and cost snapshots stay unchanged until an explicit authorized
transaction correction. The pricing basis remains quantity, channel and sale date.
Retail selection uses the highest applicable minimum quantity across retail/bulk;
a missing bulk tier still permits an applicable retail price. No current-price
fallback is introduced. Existing purchase-cost and discount prerequisites remain.

Price-only authorized corrections retain the sale's historical standard, schedule
ID and cost. Other price-basis changes resolve the applicable historical schedule
and cost, recalculate discounts/totals and retain the existing stock and payment
rules. Water remains separate from Core. Missing prices give safe, actionable
Settings → Commercial guidance instead of inventing a historical price.

Price creation audits include actor, tenant, product identity, type, minimum
quantity, integer-pesewa price, currency, effective interval, overlap operations
and `scheduleType` (historical/current/future relative to creation time). Existing
sale-recalculation audit events are unchanged.

## Verification and release

No migration, automatic price seed, backfill or production data change is required.
Database/API tests use isolated in-memory fixtures around the real handlers and
resolvers; these are not a live PostgreSQL integration test.

Before release, verify in **staging only**, using an owner/admin account:

1. Record an existing sale's unit price, standard price, schedule ID and cost.
2. Add Jan→Sep retail/bulk prices and a September replacement; inspect all three
   views, including expired periods. Confirm the existing sale remains unchanged.
3. Insert Mar→Jun into an existing period. Confirm the surrounding prices and a
   future schedule remain intact. Try crossing the next start; expect rejection.
4. Record a July sale; edit quantities through 10→19→20→30→10, then move its date
   into September. Check price, total, discount, cost, stock and paid/unpaid totals.
5. Try an uncovered historical date; expect historical-price guidance, not today's
   price. Verify authorized price-only corrections and denied Water-staff overrides.
6. Check mobile/desktop and light/dark form layout, calendar keyboard operation,
   historical notice, end-date validation, save feedback and History visibility.

Do not use production for these checks. Git and deployment remain manual.
