# Metric catalogue

Metrics marked **provisional** require business-owner confirmation before they are
used for targets, external reporting, comparisons or automated decisions.

| Metric ID | Definition/formula | Dimensions/filters/exclusions | Owner/source | Refresh | Limitations/status |
| --- | --- | --- | --- | --- | --- |
| `revenue` | Sum of eligible REEBS Core Order grand totals by `orderDate` plus confirmed/completed Booking totals by `eventDate`, in minor currency units | Tenant/day; Core only; excludes Water-contaminated, cancelled/canceled/refunded orders and non-recognised bookings | REEBS commercial owner; Order/Booking snapshots; calculation `2026-08-reebs-core-recognition-v2` | On demand/daily | Payment collection is separate; partial refunds, tax presentation and multi-currency remain provisional |
| `order-count` | Count of eligible REEBS Core orders recognised by `orderDate` | Tenant/day/status; excludes cancelled/canceled/refunded and Water-contaminated orders | Application commercial owner; Order source | Daily | Placed-order recognition is operational revenue, not payment cashflow |
| `average-order-value` | Approved order revenue divided by approved order count | Tenant/period/currency | Commercial owner | Daily/weekly | Do not calculate across currencies; numerator/denominator statuses require confirmation |
| `booking-count` | Count of confirmed/completed Core bookings by `eventDate` | Tenant/event date/status; Water excluded by domain table | Booking owner | Daily | Pending quotes are excluded; collection timing is not represented |
| `utilisation` | Requires confirmed capacity unit and occupied/capacity formula | Venue/resource/time | Venue owner | Daily/weekly | Not implemented; business confirmation required |
| `inventory-days-cover` | Current usable stock divided by average outbound units per day over the approved lookback | Tenant/product/location | Inventory owner; stock/movements | On demand/daily | Existing pilot uses 90 days and treats no movement as unknown cover; thresholds provisional |
| `stock-turnover` | Requires approved cost/average-inventory convention | Tenant/product/period | Inventory/finance owners | Monthly | Not implemented; business confirmation required |
| `days-outstanding` | Days from approved invoice issue/due event to payment or period end | Tenant/customer/invoice/currency | Finance owner | Daily | Partial payments, credits and ageing buckets require confirmation |
| `conversion-rate` | Approved successful outcomes divided by eligible opportunities | Channel/stage/period | Domain owner | Weekly | Opportunity and success events vary by application; no shared formula yet |
| `active-users` | Distinct authorised users completing an approved meaningful action in a window | Tenant/application/module | Product owner | Weekly/monthly | Login alone is not assumed meaningful; event taxonomy required |
| `process-cycle-time` | Completion timestamp minus creation/start timestamp for completed work at a stable work-item grain | Tenant/work type/stage/team | Operations owner; task/workflow source | Daily/weekly | Pilot uses task creation-to-completion; transition history is unavailable, so causal bottlenecks are not claimed |
| `overdue-work-item-count` | Open work with due timestamp before calculation time | Tenant/stage/team | Operations owner | On demand/daily | Due-date policy and paused work need confirmation |
| `automation-time-saved` | Requires reviewed baseline time minus post-automation human effort for comparable volume/quality | Client/process/version/period | Business-analysis owner | Project/monthly | Not implemented; baseline, quality guardrail and attribution rules required |
| `repeat-customer-rate` | Customers with more than one eligible Core Order/Booking interaction divided by customers with at least one such interaction | Tenant/Core scope; Water-only customers excluded | CRM owner | Weekly/monthly | Existing snapshot is all-time-like; identity/window rules remain provisional |

## Governance workflow

1. Name the decision and metric owner.
2. Approve definition, grain, source, dimensions, filters, exclusions and currency/timezone.
3. Define quality/freshness requirements and known limitations.
4. Validate against deterministic fixtures and a reviewed source sample.
5. Version the calculation and update consumers/documentation together.
