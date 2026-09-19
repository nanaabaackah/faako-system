# REEBS Invoicing deep-dive handoff

Date: 4 September 2026

## Outcome

The existing invoice builder and Faako visual design were preserved while the lifecycle was hardened around authoritative issue, immutable snapshots, safe numbering, Payments-derived balances, tenant scope, audit events and read-only reconciliation. No production migration was run. No Git command was run.

Water remains standalone. The changed invoice path is explicitly `REEBS_CORE`; Water documents are rejected rather than silently mixed into rental/event revenue.

## Capability matrix

| Capability | Before | After | State |
|---|---|---|---|
| Draft editor | Connected | Preserved; server ignores lifecycle fields | Connected |
| Issue | Implicit during send/status edit | Explicit transaction with trusted snapshots | Connected |
| Numbering | Timestamp suffix | Atomic organization/type/year sequence | Migration-backed |
| Customer snapshot | Mutable display fields | Persisted issue-time snapshot | Connected |
| Financial snapshot | Recalculated in several clients | Integer-pesewa issue snapshot | Connected |
| Payment status | Staff-selectable | Derived from Payment applications | Connected |
| Pay balance | Absent | Trusted Invoice payable opens Paystack | Connected; provider config required |
| Email | Browser supplied whole document | Persisted issued document ID only | Connected |
| Void | Archive/delete semantics | Permission, reason, audit, no paid void | API connected; dedicated dialog deferred |
| Water | No invoice implementation | Explicitly rejected by Core | Safe boundary |
| Customer self-service | Absent | Not fabricated | Deferred |
| Credits/refunds/reminders | Absent | Not fabricated | Deferred |

## Data and reconciliation

The additive migration introduces issue/void metadata, Core/Water scope, currency, immutable JSON snapshots, payment-state versioning, revisions and an atomic number sequence. Legacy non-draft/sent rows receive only an `issuedAt` lifecycle marker; the migration does not infer payment applications or rewrite money.

`invoices:reconcile:dev|prod` runs in a read-only transaction and checks duplicate numbers, missing snapshots, invalid totals, lifecycle mismatches, payment-status mismatches, orphan applications and Core/Water scope violations. Production use requires an explicit environment flag. No automatic repair exists.

## UX and accessibility

The established Faako cards, controls and table shell remain. The register retains search, filters, top/bottom pagination and mobile cards, and identifies total, paid and balance amounts. Status remains textual as well as coloured. Issued fields are disabled and accompanied by an explanatory notice. Save/archive actions are unavailable after issue. Email failure clearly states that the document was issued but delivery failed.

## Required 75-point handoff

1. Invoicing owns billing documents.
2. Payments owns collections and provider behavior.
3. Orders own Order commercial totals.
4. Bookings own Booking commercial totals.
5. Accounting remains a downstream consumer.
6. Water remains a separate domain.
7. Core invoice routes reject Water scope.
8. Drafts remain editable.
9. Drafts remain unnumbered.
10. Browser invoice numbers are ignored.
11. Browser payment statuses are ignored.
12. Browser send timestamps are ignored.
13. Issue requires a saved draft.
14. Issue locks the row.
15. Issue is idempotent.
16. Issue requires invoice issue permission.
17. Send requires invoice send permission.
18. Void requires invoice void permission.
19. Manager permissions were explicitly extended.
20. Owner/admin wildcard behavior is preserved.
21. Manual invoices require a customer.
22. Issue requires a billable line.
23. Issue requires a positive total.
24. Issue requires a valid issue date.
25. Linked Order totals reload from the server.
26. Linked Booking totals reload from the server.
27. Manual totals are recalculated server-side.
28. Money snapshots use integer pesewas.
29. Tax rates are bounded.
30. Discounts cannot exceed the calculated amount.
31. Customer identity reloads tenant-scoped.
32. Customer address/contact data is snapshotted.
33. Source identity is snapshotted.
34. Financial values are snapshotted.
35. Currency is stored explicitly.
36. Business unit is stored explicitly.
37. New Core records use `REEBS_CORE`.
38. Numbers are scoped per organization.
39. Numbers are scoped per document type.
40. Numbers are scoped per year.
41. Sequence reservation is atomic.
42. A unique index guards collisions.
43. Issued documents are immutable.
44. Void documents are immutable.
45. Issued documents cannot be archived.
46. Voiding requires a reason.
47. Applied payments block voiding.
48. Voiding is audited.
49. Issuing is audited.
50. Sending is audited.
51. Delivery failure does not unissue.
52. Email reads the stored document by ID.
53. Email uses the stored customer snapshot.
54. Email uses the stored financial snapshot.
55. Email never trusts a browser total.
56. Detail reads include safe payment summaries.
57. Lists include payment summaries.
58. Payment applications drive amount paid.
59. Balances cannot be negative.
60. Partial payment status is supported.
61. Overdue status is derived from due date.
62. Paid status requires sufficient applied money.
63. Legacy payment state remains readable.
64. New invoices opt into payment-state version 1.
65. Invoice Paystack initialization reloads the payable.
66. Only issued active Core invoices are payable.
67. Provider amount and currency remain server-owned.
68. The table keeps top and bottom pagination.
69. Mobile cards keep status and financial context.
70. Status is no longer an editable select.
71. Issued fields expose a visible lock explanation.
72. PDF libraries remain dynamically loaded.
73. Reconciliation is read-only.
74. The migration was validated, not deployed to production.
75. Customer self-service, credits, refunds, reminders, Water invoicing and accounting redesign remain explicitly deferred.

## Files and release position

Created: `backend/modules/invoicing/`, the Invoicing integrity migration, reconciliation script, architecture document and this report. Adapted: invoice document/email handlers, Payments payable/application integration, Core financial consumption, access policy, Prisma schema, Invoicing page/table/CSS and package commands.

Release requires the normal reviewed migration workflow, then read-only reconciliation, test-mode Paystack confirmation and email-provider confirmation. No live provider call or production data repair is claimed.

## Validation record

- Invoicing domain/repository tests: 11/11 passed.
- Full portal suite: 204/204 passed.
- Portal lint: 0 errors; 81 pre-existing warnings outside the changed Invoicing files.
- Prisma development validation and Client generation: passed.
- Portal production build: passed, 1,571 modules transformed.
- Invoicing browser coverage: six responsive widths (320, 375, 390, 430, 768 and 1440 px) plus the issued-document immutability/payment projection passed.
- Current Invoicing chunk: 98.41 kB raw / 24.85 kB gzip; its portal-wide CSS chunk is 320.66 kB / 48.14 kB gzip. No honest pre-phase baseline was available, so no invented reduction is reported.
- Website regression: 8/8 tests, lint 0 errors/8 existing warnings, Astro check 0 diagnostics, and 1,125-page static build passed. No website source was changed.
- Security scan: passed across 2,331 non-ignored workspace files.
- Security gate: passed.
- Read-only development preflight: zero duplicate invoice numbers. Snapshot/lifecycle/payment reconciliation remains pending until the additive migration is applied.
