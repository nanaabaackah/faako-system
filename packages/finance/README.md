# @faako/finance

Shared finance constants, pure helpers, receipt presentation utilities, and documented shape contracts for Faako ERP apps.

## What Changed

Added the Shared Finance Foundation Wave for low-risk finance terminology and presentation. This package exports constants, documented shape descriptors, pure formatting/normalization helpers, balance display helpers, transaction metadata normalization helpers, and receipt presentation helpers.

No app logic, payment calculations, receipt generation, database schema, API routes, auth behavior, or workflows were moved into this package.

## Where It Lives

- `src/constants/paymentMethods.js`: normalized payment method constants and labels.
- `src/constants/paymentStatuses.js`: normalized payment status constants and labels.
- `src/constants/receiptStatuses.js`: normalized receipt status constants and labels.
- `src/constants/financeStatuses.js`: normalized finance/balance status constants and labels.
- `src/types/paymentTypes.js`: documented payment shape and payment metadata placeholders.
- `src/types/receiptTypes.js`: documented receipt shape, delivery channels, and snapshot placeholders.
- `src/types/transactionTypes.js`: documented normalized reference, transaction metadata, and audit metadata placeholders.
- `src/helpers/currency.js`: currency formatting plus `majorToCents` and `centsToMajor`.
- `src/helpers/normalization.js`: payment method, payment status, receipt status, and finance status normalization.
- `src/helpers/balances.js`: display-safe balance helpers and finance summary helpers.
- `src/helpers/metadata.js`: normalized payment, receipt, reference, and transaction metadata helpers.
- `src/receipts/formatters.js`: receipt display summaries, print-friendly text, WhatsApp message formatting, and email placeholder formatting.
- `test/financeHelpers.test.mjs`: node:test coverage for formatting, normalization, summaries, and receipt messages.
- `src/index.js`: safe package export surface.

## How To Use It

Future code can import constants and display helpers from `@faako/finance` when a migration is explicitly planned:

```js
import {
  FINANCE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RECEIPT_STATUSES,
  formatCurrencyFromCents,
  formatCurrencyMajor,
  getPaymentMethodLabel,
  normalizePaymentStatus,
} from "@faako/finance";
```

Current low-risk app usage:

- REEBS Portal uses shared helpers for order UI currency display and payment method labels only.
- Dev ERP uses shared helpers for Rent and Invoicing currency display only.

Existing apps are not required to migrate write paths. REEBS Portal and Dev ERP should continue using their current payment, receipt, invoice, order, rent, and balance behavior until separate app-specific adapter work is planned and tested.

## Environment Variables

None.

## Setup Or Migration Steps

None. This is a workspace package with no runtime setup, database migration, gateway setup, or app migration requirement.

## Security Or Data Impact

Standardizes finance terminology and presentation only. There is no runtime security, auth, permission, data access, payment persistence, receipt generation, invoice persistence, order persistence, rent calculation, route, or schema behavior change.

## Known Limitations

- Constants, helpers, and shape descriptors are not validation logic.
- Balance helpers are display-safe helpers only and are not a replacement for app-owned persisted calculations.
- The package does not record payments.
- The package does not generate receipts.
- The package does not normalize persisted app data.
- The package does not implement gateway integrations.
- The package does not implement offline payment sync.
- The package does not replace app-owned audit logging.
- Receipt presentation helpers format provided data only; they do not create official receipts or receipt numbers.

## Testing Notes

Use lightweight import checks to verify the package export surface resolves.

Run package tests:

```bash
pnpm --filter @faako/finance run test
```

Manual display checks for current adoption:

- REEBS order list/detail currency display still renders expected GHS amounts.
- REEBS order payment method labels still render existing labels such as Cash, Mobile Money, Bank Transfer, Card, and Other.
- Dev ERP Rent currency summaries still render code-prefixed values such as `GHS 1,234.00`.
- Dev ERP Invoicing currency summaries still render code-prefixed values such as `CAD 1,234.00`.

## Future Work

- Expand shared finance helper utilities only where display-safe.
- Add shared payment service adapter contracts.
- Add shared receipt service adapter contracts.
- Add shared invoice engine contracts.
- Add gateway integration contracts after manual payment behavior is stable.
- Add offline payment sync contracts after idempotency and reconciliation rules are proven.
- Add MoMo reconciliation contracts after provider confirmation behavior is reviewed.
- Add WhatsApp/email receipt automation contracts after delivery audit rules are defined.
