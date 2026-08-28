# Analytics data-flow map

| Flow | Source owner | Extract/grain | Processing | Output/consumer | Current storage/retention | Failure behaviour |
| --- | --- | --- | --- | --- | --- | --- |
| REEBS dashboard pilot | REEBS Portal backend | One tenant; daily commercial aggregates, weekday booking counts, product inventory movement aggregates and customer counts | `reebs.dashboard-insights` v1 rules plus quality checks | Stable envelope adapted to current admin dashboard | Stateless request only | Context mismatch/blocked quality rejected; Node fallback on service outage |
| Dev ERP operational-health pilot | Dev ERP backend (producer pending) | One tenant; one record per project task with lifecycle dates, stage and opaque assignee key | Cycle time, overdue work, stage delay concentration and workload distribution | Stable envelope prepared for operations dashboard/report | Stateless request only | Invalid/duplicate grain blocked; stale/empty data labelled |
| Future batch/report | To be approved | Governed extract/materialised analytical grain | Versioned batch job | Report/Power BI/export | Not implemented; retention ADR required | Checkpoint, retry, backfill and rollback design required |

## Prohibited flow

Browser/public site -> Python service, raw production database -> unrestricted Python,
or one tenant's extract -> another tenant's response are all prohibited.
