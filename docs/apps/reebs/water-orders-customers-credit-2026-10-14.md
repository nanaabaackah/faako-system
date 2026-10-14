# Water Orders, customers and retained credit

Approved scope: combine Sales/Orders within the existing Faako theme, add useful
order/customer stats, and retain manual overpayments as customer credit for
future Water orders. No framework, authentication, Core finance or pricing-model
replacement. No new database migration is required by this change.

## Navigation and customers

- Sidebar: Dashboard, Orders, Customers, Stock. `/sales` redirects to
  `/orders?new=1`; bookmarked record-sale links remain usable.
- Orders has a record-order toggle, existing sortable/paginated ledger, and
  filtered order count, commercial order value, outstanding balance and open
  order count. These are for the selected product/stock period and filters,
  not cash receipts. Form drafts survive hiding the form and changing modules.
- Customer directory opens a Faako detail drawer. Stats cover **all active Water
  orders, all products, all time**, not just the ten recent history entries.
- Customer identity is shared with REEBS. Explicit contact edits use the existing
  `customers:write` permission and validation/audit endpoint; Water operators
  retain existing creation/collection rights, not new contact-edit privileges.
  Contact edits do not rewrite historical sale-name snapshots.

## Payment invariants

- Manual collection above a positive order balance requires explicit confirmation
  and an identified customer. The full amount received is a Water payment record;
  only the order balance becomes its initial payment application.
- Remaining unapplied GHS amount is customer credit, not extra sale revenue.
  Credit is organization/customer/Water scoped, available across Water products,
  and never applied to Core rentals/events. No second ledger is introduced.
- The collection dialog can explicitly apply existing credit, oldest receipt
  first, up to the order balance. It creates applications only, not cash records.
  The amount must match the refreshed available-credit/balance minimum. Existing
  immutable application uniqueness is retained; a receipt already applied to
  that order is not applied again after later commercial repricing.
- Same-customer credit applications serialize with a transaction advisory lock,
  lock source payments, then re-read availability. The existing command wrapper
  atomically commits applications, settlement projection, audit and retry marker.
- Online provider payments retain strict trusted-balance validation. No automatic
  payment retry, provider charge, refund or customer-credit transfer is added.
- Cash reports count the full receipt on its original application only. Later
  credit applications count zero new cash. Application amounts still settle
  orders. Credit application dates—not the old receipt date—determine settlement.
- Reversed/mixed-scope payment applications are excluded from spendable credit
  pending reconciliation. Legacy paid flags do not mint credit.

## Explicit limits and deployment checks

### Operator flow

1. In Orders, record the customer's order. If paying with retained credit, choose
   Pay later rather than recording a new cash payment at creation.
2. Open Record collection. For money received above the outstanding balance,
   enter the actual received amount and confirm retaining the excess as credit.
3. On a future outstanding order for the same customer, open Record collection
   and choose Apply customer credit. The displayed amount is capped at that
   order's balance. This does not record another receipt.
4. Open the customer in Customers to see remaining credit and all-Water totals.

### Release limitations

- This flow accepts excess while settling an outstanding order; it is not a
  standalone deposit or refund workflow for already-paid orders.
- No database connection, migration, secret read or production operation is part
  of this work. The reported P3009 operational-integrity migration remains
  unresolved at the user's request. These changes do not repair migration history.
- API must deploy before the Water frontend for the new credit action/customer
  stats. First verify in isolated staging using existing migrated schema.
- Mocked tests do not prove real PostgreSQL concurrency or RLS deployment state.
  Rehearse two simultaneous credit applications, ambiguous-response retry and
  rollback in isolated staging before accepting live overpayments.
- Keep production separate; the requested code destination is `develop` only.

## Local verification

- 211 focused Node tests pass: Water collection/credit, permissions, commands,
  customer totals/identity, shared payments/provider validation and Core dashboard
  separation. Includes overpayment consent, customer requirement, application
  limits, cross-product reuse, no repeated cash, and replay behavior.
- Scoped ESLint passes. Water production-mode Vite build passes with environment
  files disabled and an unreachable loopback API, in a temporary output folder.
- Security scan, security gate and Cloudflare/Railway readiness checks pass.
- Browser verification includes a discovered/fixed focus-return bug after saving
  customer details and an updated Orders test helper that waits for the action.
  The final full mocked browser run passes all **46 tests** with no failures.
  Browser APIs are mocked; screenshots were inspected at 320px dark and 1440px
  light. Accessibility scans of customer/collection dialogs and existing theme
  scenarios reported no violations. Real database concurrency remains a staging
  gate, not a claim established by these tests.
