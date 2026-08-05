# Metric catalogue

Metrics marked **provisional** require business-owner confirmation before they are
used for targets, external reporting, comparisons or automated decisions.

| Metric ID | Definition/formula | Dimensions/filters/exclusions | Owner/source | Refresh | Limitations/status |
| --- | --- | --- | --- | --- | --- |
| `revenue` | Sum of REEBS order revenue plus booking revenue in minor currency units | Tenant/day; excludes cancelled/canceled statuses | REEBS commercial owner (to confirm); order/booking aggregates | On demand/daily | Currency, recognition date, refunds/tax and booking `createdAt` treatment require confirmation; provisional |
| `order-count` | Count of non-cancelled orders in the period | Tenant/day/status | Application commercial owner; order source | Daily | Definition of placed vs paid order requires confirmation |
| `average-order-value` | Approved order revenue divided by approved order count | Tenant/period/currency | Commercial owner | Daily/weekly | Do not calculate across currencies; numerator/denominator statuses require confirmation |
| `booking-count` | Count of non-cancelled bookings using the approved booking date grain | Tenant/date/status | Booking owner | Daily | Event date versus created date depends on decision; provisional |
| `utilisation` | Requires confirmed capacity unit and occupied/capacity formula | Venue/resource/time | Venue owner | Daily/weekly | Not implemented; business confirmation required |
| `inventory-days-cover` | Current usable stock divided by average outbound units per day over the approved lookback | Tenant/product/location | Inventory owner; stock/movements | On demand/daily | Existing pilot uses 90 days and treats no movement as unknown cover; thresholds provisional |
| `stock-turnover` | Requires approved cost/average-inventory convention | Tenant/product/period | Inventory/finance owners | Monthly | Not implemented; business confirmation required |
| `days-outstanding` | Days from approved invoice issue/due event to payment or period end | Tenant/customer/invoice/currency | Finance owner | Daily | Partial payments, credits and ageing buckets require confirmation |
| `conversion-rate` | Approved successful outcomes divided by eligible opportunities | Channel/stage/period | Domain owner | Weekly | Opportunity and success events vary by application; no shared formula yet |
| `active-users` | Distinct authorised users completing an approved meaningful action in a window | Tenant/application/module | Product owner | Weekly/monthly | Login alone is not assumed meaningful; event taxonomy required |
| `process-cycle-time` | Completion timestamp minus creation/start timestamp for completed work at a stable work-item grain | Tenant/work type/stage/team | Operations owner; task/workflow source | Daily/weekly | Pilot uses task creation-to-completion; transition history is unavailable, so causal bottlenecks are not claimed |
| `overdue-work-item-count` | Open work with due timestamp before calculation time | Tenant/stage/team | Operations owner | On demand/daily | Due-date policy and paused work need confirmation |
| `automation-time-saved` | Requires reviewed baseline time minus post-automation human effort for comparable volume/quality | Client/process/version/period | Business-analysis owner | Project/monthly | Not implemented; baseline, quality guardrail and attribution rules required |
| `repeat-customer-rate` | Customers with more than one approved interaction divided by all eligible customers | Tenant/window/channel | CRM owner | Weekly/monthly | Existing REEBS snapshot is all-time-like and provisional; identity/window rules require confirmation |

## Governance workflow

1. Name the decision and metric owner.
2. Approve definition, grain, source, dimensions, filters, exclusions and currency/timezone.
3. Define quality/freshness requirements and known limitations.
4. Validate against deterministic fixtures and a reviewed source sample.
5. Version the calculation and update consumers/documentation together.

