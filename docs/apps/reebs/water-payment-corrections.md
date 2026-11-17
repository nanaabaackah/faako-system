# Water payment corrections and legacy reconciliation

## Scope and UI
- Water Owners and Admins can open **Payment history / collection** for an unpaid, partial, paid or legacy Water order.
- **Record collection** still records new received funds only against an outstanding balance.
- **Correct payment** in Collection history offers **Replace with corrected details** (amount, method, date, external reference and notes) or **Reverse incorrect entry**.
- **Reconcile legacy payment** allows an older order with a paid flag but no collection application to be confirmed with a manual receipt or reset to unpaid. It does not assume a historical paid flag is proof of a receipt.
- The UI uses the same Faako/REEBS Water modal, input, action button and icon components; no emoji buttons.

## Security and ledger behavior
- POST actions: `correct_collection` and `reconcile_legacy_payment`, owner/admin only, checked server-side.
- All corrections require a 5–500 character explanation and use Water command idempotency/transaction handling.
- Correcting a manual payment marks the existing application `REVERSED`, supersedes (but does not erase) the original record, and optionally records a replacement `MANUAL_WATER` receipt using the existing Water Payment Service.
- An audit event and a `waterPaymentCorrection` entry link the original payment, replacement payment, order, actor, reason and time.
- The Water settlement projection recalculates paid/unpaid/partial state. Application reversals remove the old receipt from collected-cash figures without changing Water revenue or REEBS Core finances.
- The credit loader excludes superseded receipts. An original payment with **any** applications on other orders (including customer-credit reuse) is blocked pending manual review; the system does not reverse downstream payments automatically.
- Provider-verified, provider-attempt-linked and non-manual receipts are deliberately not editable in this flow. A reversal here is a **ledger correction only**, not a bank/MoMo refund.

## Deployment
- Deploy migration `20261116210000_water_payment_corrections` to the intended isolated environment before deploying the corresponding API, since it adds `paymentRecord.supersededAt` and the audited correction table.
- Confirm existing migration history is healthy first, including the previously reported Water migration blocker. Never reset data or mark a failed migration applied simply to deploy this change.
- API first, then standalone Water frontend. No production database or provider mutation was performed by this PR.
- Verify with a backed-up staging database: partial/full manual receipt correction, repeated submit, revised electronic reference, reverse-only flow, legacy confirm/unpaid, multiple-payments-on-one-order, cross-product isolation, role denial, and blocked credit reuse/provider receipts.
- The new backend unit tests use in-memory query fakes and do not establish real DB locking, migration or payment-provider behavior; staging rehearsal is required before production deployment.
