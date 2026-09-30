# REEBS production migration review — 2026-09-30

## Release scope and authority

The owner permits structural migrations provided existing data is preserved.
The release cutoff is `a949d6d13`; subsequent responsive fixes are for `develop`
only. Production auto-deployment is active, so pushing the release to `main`
can run `railway:start` → `server:with-migrate` → `db:deploy` automatically.

This is a source review, not a production database inspection or proof that a
migration has already been applied. No credentials or real environment files
were read. No production migration or data operation was performed by this review.

## Eight migrations absent from the reviewed main branch

| Migration | Existing-data effect |
| --- | --- |
| `20260828143000_water_pricing_integrity` | Adds Water configuration and sale snapshot fields; fills missing base price from the sale's unit price. Seeds configuration only when absent, preferring a matched inventory product and otherwise legacy default rates. Existing cost snapshots stay unknown; sale amounts and stock are not recalculated. |
| `20260829150000_booking_rental_integrity` | Adds and populates booking references, end dates, subtotal and item-price snapshots from existing fields. Existing totals and item prices are retained. Adds constraints and indexes. |
| `20260830120000_orders_commercial_snapshots` | Adds Core currency, scope, tax/discount and cost-snapshot fields with defaults; adds constraints/indexes. Does not infer historical costs or recalculate existing totals. |
| `20260831193000_inventory_integrity` | Adds stock-movement metadata and indexes; nonnegative-stock constraints are initially `NOT VALID`. Does not change stock quantities. |
| `20260902190000_customer_identity_integrity` | Adds identity/contact fields and fills missing references and normalized contact copies. Original email/phone values remain unchanged. Replaces two validation constraints. |
| `20260903120000_payments_foundation` | Creates payment attempt, record, application and provider-event tables, indexes and tenant policies. Does not migrate or rewrite historical payments. |
| `20260904120000_invoicing_integrity` | Adds invoice snapshots/lifecycle fields, number sequences, indexes and tenant policies. Fills missing issued timestamps from existing sent/updated timestamps. Duplicate invoice numbers explicitly stop the transactional migration. No payment history or monetary totals are rewritten. |
| `20260920113000_user_account_invitations` | Creates the invitation table and indexes; existing users are retained. |

No reviewed migration executes `DELETE`, `TRUNCATE`, `DROP TABLE` or `DROP COLUMN`.
`ON DELETE` clauses define future foreign-key behavior; they do not delete rows
while creating the constraint. This does not guarantee deployment success.

## Required production checks before release

1. Confirm a recent, restorable production backup and the intended REEBS Railway
   service/environment. Never copy production credentials into staging.
2. Through the approved operator workflow, check migration status. The eight-file
   branch difference is not the production pending-migration count. In particular,
   a previously failed Water migration must not be assumed resolved.
3. Review existing schema drift and duplicate customer/invoice references or
   linked invoice sources. Several migrations are not fully retry-idempotent;
   do not blindly mark a failed migration applied or retry partial SQL.
4. Check booking snapshot arithmetic fits integer columns and required source
   dates/totals are populated. Constraints can reject inconsistent historical
   data without deleting it. Resolve discrepancies explicitly, never by wiping
   records or resetting a shared database.
5. Review newly seeded Water configuration separately from Core commercial data:
   name-based product matching and fallback prices require operator verification.
6. Verify tenant context for invoice/payment queries after RLS changes. Preserved
   records must remain accessible to their authorized organisation.
7. Compare before/after row counts and financial/stock totals per organisation
   and business domain using approved aggregate-only checks; verify `/live`,
   `/ready`, login, Water stock/sales, and invoice/payment visibility.

A code rollback does not undo schema changes or backfills. Retain the previous
release and a tested backup recovery path. Do not restore a backup casually over
new transactions; coordinate recovery if migration deployment fails.

The owner confirmed a recent restorable backup and authorized structural
migrations. Live migration state remains uninspected under the secret-safety
rules; Railway's deployment result must be checked before claiming successful
application. No production safety claim is inferred from mocked frontend tests.
