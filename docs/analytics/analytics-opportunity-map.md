# Analytics opportunity map

Opportunities are ranked by a real decision, not by data availability alone.

| Application/domain | Business question and decision | Primary user | Source/data requirement | Refresh/output | Privacy | Complexity/value | Python? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dev ERP projects | Which work is overdue, how long does completion take, and where is delayed work concentrated? Prioritise intervention and balance workload. | Operations/project leads | Tenant-scoped project-task lifecycle dates, stage and opaque assignee key; unique task grain | Daily/on demand; dashboard dataset | Internal employee/work metadata | Medium / high | Yes for reusable profiling; simple counts may remain SQL | Pilot implemented, producer prepared |
| REEBS inventory | Which items risk stock-out or are slow-moving? Decide reorder/review actions. | Inventory/operations managers | Product stock, reorder level and governed outbound movement totals | On demand; dashboard recommendations | Commercial confidential | Low-medium / high | Yes for reusable rules and future forecasting | Pilot integrated |
| REEBS sales/bookings | How are revenue and booking demand trending? Plan capacity and follow-up. | Managers | Completed/non-cancelled commercial aggregates with agreed date/currency grain | Daily/on demand; dashboard/report | Commercial confidential | Medium / medium | Maybe; simple trends remain SQL, evaluated forecasts may use Python | Existing provisional heuristic |
| Stroane inventory/enquiries | Which products attract demand but fail to convert, and where is stock constraining enquiries? | Admin/owner | Governed enquiry, catalogue and stock-movement events with stable identifiers | Daily; dashboard | Customer/commercial confidential | Medium / high | Maybe after source contract and conversion definition | Candidate |
| Faako ERP finance | Which invoices age, payments delay and cash-flow risks need action? | Finance users | Invoice/payment snapshots, currency policy and status history | Daily; dashboard/report | Restricted financial | Medium / high | Yes for ageing/trend analysis; ledger totals stay SQL | Candidate after finance batch |
| Faako Website/platform | Which content and journeys generate qualified enquiries? Decide content/navigation improvements. | Product/marketing | Consent-aware web events and enquiry outcomes | Weekly; GA/BI first | Pseudonymous usage | Low / medium | No initially; GA/BI is simpler | Keep outside Python |
| Product/platform adoption | Which tenants adopt modules and complete workflows? Prioritise onboarding/product work. | Product/platform admin | Approved event taxonomy with tenant-safe aggregates | Weekly; management dashboard | Tenant confidential | High / high | Maybe after instrumentation governance | Candidate |
| Automation projects | How much cycle time and manual effort changed after automation? Decide value/next investment. | Business analysts/clients | Reviewed baseline/after measures and automation-run outcomes | Monthly/project close; report | Client confidential | Medium / high | Yes for comparative analysis when definitions exist | Candidate; formula unconfirmed |
| Hotel/event solutions | What are utilisation, lead time, cancellation and capacity patterns? Decide pricing/staffing/capacity. | Venue/event managers | Booking inventory, capacity, event date, cancellation history | Daily/weekly | Customer/commercial confidential | Medium / high | Maybe; descriptive SQL first | Future solution, no active source proven |
| TTNGH programmes/donations | What is programme reach, participation and donation trend? Decide outreach and impact reporting. | NGO leadership/partners | Consent/lawful-purpose participant and donation aggregates | Monthly/quarterly; report | Sensitive participant/financial | High / high | Maybe for longitudinal analysis; simple counts stay BI | Deferred until tracked app/data governance |

## Selection rationale

The first pilots have known source fields, immediate operational decisions, bounded
tenant scope and deterministic baselines. Forecasting, segmentation and cross-tenant
product analytics are not selected because history, definitions or approvals are not
yet strong enough.
