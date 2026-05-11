# Dev ERP Order, Payment, Receipt Workflow Review

## Purpose

This review maps the current Dev ERP rent payment, accounting, invoice, reporting, and related finance workflows before any shared finance platform extraction. It is documentation-only and does not change application logic, routes, permissions, database schema, payment behavior, receipt behavior, invoice behavior, reports, or operational records.

Dev ERP is fully live, contains real operational data, and is production-sensitive.

## 1. Order Flow Mapping

### Where Orders Originate

- A dedicated order module was not found in the reviewed Dev ERP code paths.
- Dev ERP money workflows currently originate from rent payments, manual accounting entries, invoices/quotations, and operational reports.
- Future shared platform work should not assume REEBS-style orders exist in Dev ERP.

### POS Flow

- No POS module was found in the reviewed Dev ERP code paths.
- POS extraction work should remain REEBS-specific unless Dev ERP later adds a POS workflow.

### Booking-Linked Orders

- No booking-linked order workflow was found in the reviewed Dev ERP code paths.

### Rent-Linked Orders

- Rent is a primary Dev ERP finance workflow.
- Rent tenants and payments are managed through `apps/dev-erp/src/pages/Rent/Rent.jsx`.
- Backend rent APIs in `apps/dev-erp/backend/server.js` manage rent dashboard data, tenant records, payment records, and monthly update emails.
- Rent payments are not currently modeled as orders. Future shared platform extraction should preserve this distinction unless a formal rent order model is designed.

### Invoice-Linked Flows

- Invoice records are managed through `apps/dev-erp/src/pages/Invoicing/Invoicing.jsx` and backend `/api/invoices` routes.
- Accounting entries can generate/download invoice PDFs through an accounting invoice-number path, but that flow does not create an `Invoice` model record.
- Public invoice links use view tokens and can be accepted or declined without an authenticated user when the token is valid.

### Order Status Flow

- No order status flow exists in the reviewed Dev ERP code paths.
- Invoice status and accounting entry status are the closest equivalents and should not be treated as order status without a future design decision.

### Outstanding Balance Flow

- Rent outstanding balances are calculated from tenant rent terms, opening balance, expected rent through a reporting date, and recorded rent payments.
- Accounting pending/paid state is stored on `AccountingEntry`.
- Invoice totals and paid state are stored on `Invoice`, but invoice paid status is not tied to a payment ledger in the reviewed code paths.

## 2. Payment Flow Mapping

### Where Payments Are Recorded

- Rent payments are recorded through `apps/dev-erp/src/pages/Rent/Rent.jsx` and backend `/api/rent/payments` routes.
- Accounting entries can be marked paid through `/api/accounting/entries/:id/mark-paid`.
- Invoices can be marked `PAID` by invoice status update, but this does not create a separate payment record.

### Manual Payment Flow

- Rent payment forms collect tenant, amount, paid date/month, method, reference, and notes.
- Backend rent payment creation validates access through rent manager controls and organization/user scoping.
- Creating a rent payment writes a `RentPayment` record and triggers a rent payment recorded email notification.
- Rent payments can also be edited or deleted, which changes live operational balance calculations.

### MoMo References

- The rent payment method field is free-form and can describe mobile money or bank transfer usage.
- The rent payment reference field can store external payment references.
- No provider-confirmed MoMo settlement integration was found in the reviewed Dev ERP code paths.

### Partial Payments

- Rent partial payments are supported because multiple `RentPayment` records can be recorded against a tenant and month/date.
- Outstanding totals are calculated from aggregate payments against expected rent and opening balance.
- Accounting and invoice paid status are status-driven rather than ledger-driven.

### Outstanding Balances

- Rent outstanding balances are calculated by backend dashboard helpers using expected rent through the current/as-of date, opening balances, paid-to-date totals, and credits.
- Accounting pending balances are represented by `AccountingEntry` status and due dates.
- Invoice outstanding state is represented by invoice status and totals, not by a payment ledger.

### Payment Status Logic

- Rent payments do not have a status field in the reviewed schema; existence of the record contributes to paid totals.
- Accounting entries use `PAID`, `PENDING`, `SCHEDULED`, or `OVERDUE`.
- Invoices use statuses such as `DRAFT`, `QUOTATION`, `SENT`, `ACCEPTED`, `DECLINED`, `PAID`, `OVERDUE`, and `VOID`.

### Payment APIs, Hooks, and Components

- UI: `apps/dev-erp/src/pages/Rent/Rent.jsx`
- Backend rent APIs: `apps/dev-erp/backend/server.js` under `/api/rent/*`
- Schema: `RentTenant` and `RentPayment` in `apps/dev-erp/prisma/schema.prisma`
- Notification template: `apps/dev-erp/backend/rentPaymentRecordedEmailTemplate.js`
- Accounting APIs: `/api/accounting/entries/*` in `apps/dev-erp/backend/server.js`
- Invoice APIs: `/api/invoices/*` in `apps/dev-erp/backend/server.js`

## 3. Receipt Flow Mapping

### Where Receipts Are Generated

- A dedicated immutable receipt generation workflow was not found in the reviewed Dev ERP code paths.
- Rent payment recorded emails are notifications, not confirmed immutable receipts.
- Invoice PDFs and accounting invoice PDFs are documents, not payment receipts.

### Receipt Numbering

- No dedicated receipt numbering sequence was found for rent payments or invoices.
- Future shared receipt work should add numbering only after a Dev ERP receipt source-of-truth decision is made.

### Receipt Rendering

- No dedicated receipt rendering component was found.
- Invoice PDF rendering exists for invoice and accounting document flows.

### Print and Share Flow

- Invoice PDFs can be downloaded from the frontend.
- Public invoice view links can be sent by email for invoice/quotation review.
- No receipt-specific print/share flow was found.

### WhatsApp and Email Integrations

- Rent payment recorded email notifications are generated after rent payment creation.
- Invoice and quotation emails are sent from backend invoice routes using configured application URL and sender settings.
- No WhatsApp receipt workflow was found in the reviewed Dev ERP paths.

### Receipt Dependencies

- Future Dev ERP receipt generation would likely depend on rent payment records, tenant records, invoice records, accounting entries, organization/user context, and immutable numbering.
- Existing operational payments should not be mutated to create receipts without a migration and audit plan.

## 4. Invoice Flow Mapping

### Invoice Generation Points

- Main invoices are created and updated through `/api/invoices` and `apps/dev-erp/src/pages/Invoicing/Invoicing.jsx`.
- Accounting entries can receive an invoice number through `/api/accounting/entries/:id/invoice` and download a PDF through `apps/dev-erp/src/utils/invoicePdf.js`.
- Public invoice views are accessed through `/api/invoices/view/:token`.

### Invoice Dependencies

- Invoice records depend on customer name/email, subject, message, line items, tax rate, discount, totals, status, due date, and view token state.
- Accounting invoice PDFs depend on `AccountingEntry` values and generated invoice number.
- Invoice email delivery depends on application base URL and sender/email provider configuration.

### Invoice Status Handling

- Invoice create/update calculates and persists subtotal, tax amount, discount, and total.
- Sending an invoice from draft creates a time-limited view token and moves the invoice to `SENT`.
- Sending a quotation can move the invoice to `QUOTATION`.
- Admin and public token routes can accept or decline quotations.
- Marking an invoice as `PAID` sets paid date behavior, but does not create a separate payment ledger entry.

### Relationship to Orders and Payments

- Invoices are not linked to Dev ERP order records because no order model was found.
- Invoices are not linked to rent payment records in the reviewed code paths.
- Accounting invoice PDFs are separate from persisted invoice records and should be reconciled before shared invoice extraction.

## 5. Financial Calculation Mapping

### Balance Calculations

- Rent balances are calculated from monthly rent, lease dates, opening balance, payments to date, and expected rent through the selected period.
- Invoice totals are calculated from line items, quantity, price, tax rate, and discount.
- Accounting summaries are calculated from entries by type and paid/pending state.

### Outstanding Logic

- Rent outstanding values include current month, total-to-date, year-to-date/year-end views, missed months, and credits.
- Invoice outstanding state is represented by invoice status and total, not a dedicated balance ledger.
- Accounting pending values are derived from unpaid entries.

### Payment Aggregation

- Rent payment aggregation sums payments per tenant and reporting period.
- Accounting dashboard summaries aggregate `AccountingEntry` values.
- Invoice paid state is not payment-aggregated in the reviewed code paths.

### Discounts

- Invoice records support a discount value.
- Rent payments and accounting entries do not have discount behavior in the reviewed payment paths.

### Taxes

- Invoice records support tax rate and tax amount.
- Rent payment records do not appear to calculate tax.
- Accounting entries store amount directly.

### Stock Deduction Timing

- Dev ERP finance workflows reviewed do not include inventory stock deduction.

### Refund Logic

- No dedicated refund workflow was found for rent payments, accounting payments, or invoices.
- Rent payment edits/deletes can correct records but should be treated as high-risk operational changes.

## 6. Shared Dependencies

### Shared Helpers

- Rent payment notification template: `apps/dev-erp/backend/rentPaymentRecordedEmailTemplate.js`
- Invoice PDF generation: `apps/dev-erp/src/utils/invoicePdf.js`
- Backend total calculation helpers in `apps/dev-erp/backend/server.js`
- Prisma schema models in `apps/dev-erp/prisma/schema.prisma`

### Shared APIs

- `/api/rent/dashboard`
- `/api/rent/tenants`
- `/api/rent/payments`
- `/api/rent/monthly-updates/send`
- `/api/accounting/entries`
- `/api/accounting/entries/:id/mark-paid`
- `/api/accounting/entries/:id/archive`
- `/api/accounting/entries/:id/invoice`
- `/api/invoices`
- `/api/invoices/:id/send`
- `/api/invoices/:id/send-quotation`
- `/api/invoices/:id/accept`
- `/api/invoices/:id/decline`
- `/api/invoices/view/:token`
- `/api/reports`
- `/api/reports/summary`

### Shared Components

- `apps/dev-erp/src/pages/Rent/Rent.jsx`
- `apps/dev-erp/src/pages/Accounting/Accounting.jsx`
- `apps/dev-erp/src/pages/Invoicing/Invoicing.jsx`
- `apps/dev-erp/src/pages/InvoiceView/InvoiceView.jsx`
- `apps/dev-erp/src/utils/invoicePdf.js`

### Duplicated Logic

- Invoice total calculation exists in backend routes and frontend PDF generation.
- Accounting invoice-number/PDF flow and persisted invoice records are separate document paths.
- Rent payment records, accounting paid entries, and invoice paid status are separate payment concepts.

### Cross-Module Dependencies

- Rent payments affect rent dashboard summaries, tenant standing, reports, and email notifications.
- Accounting entries affect dashboard revenue/expense summaries, reports, and invoice-number PDFs.
- Invoice records affect customer communications, public token workflows, and paid/accepted/declined state.

## 7. High-Risk Areas

- Dev ERP is live with real operational data, so rent payment edits/deletes directly affect customer/client balances and reports.
- Invoice paid status is manual/status-based and not tied to a ledger.
- Rent payments do not generate immutable receipts, creating future receipt reconciliation risk.
- Invoice total calculations are duplicated between backend and frontend PDF generation.
- Accounting invoice-number documents and `Invoice` model documents are separate flows.
- Public invoice token routes must preserve expiry and response protections.
- Rent payment notifications are sent on create, but edit/delete notification behavior should be reviewed before extraction.
- Future offline sync could create duplicate rent payments or stale balance/report views without idempotency.
- Audit coverage for rent payment edits/deletes, accounting updates, and invoice status changes should be confirmed before shared service extraction.

## 8. Security Considerations

- Rent routes are auth-sensitive and permission-sensitive through rent manager controls and user/org scoping.
- Accounting and invoice write routes are admin-sensitive.
- Public invoice view/response routes rely on token secrecy and expiry rather than authenticated sessions.
- Payment modification risk is highest for rent payment create/edit/delete and accounting mark-paid actions.
- Receipt spoofing risk should be considered if payment emails or invoice PDFs are interpreted as receipts.
- Environment-sensitive dependencies include `DATABASE_URL`, application base URL, invoice sender email, email provider credentials, auth/session secrets, database isolation settings, and any external subscription data connection.
- Future shared services should add explicit audit requirements for payment modification, invoice status changes, receipt generation, and public token responses.

## 9. Future Platform Extraction Opportunities

- Shared payment ledger service that can support rent payments without assuming order records.
- Shared receipt engine for immutable rent payment receipts and invoice/payment receipts.
- Shared invoice service that reconciles persisted invoices with accounting invoice PDFs.
- Shared balance calculator for rent outstanding, invoice balances, and accounting summaries.
- Offline-safe payment queue with idempotency for rent payment recording.
- Shared transaction audit layer for rent, accounting, invoice, report, and receipt events.

## 10. Recommended Extraction Order

1. `packages/finance`: start with read-only money utilities, invoice/rent/accounting status mapping, and calculation fixtures for existing Dev ERP behavior.
2. `packages/payments`: add a ledger contract that can model rent payments separately from REEBS order payments, initially as adapters around existing APIs.
3. `packages/receipts`: design immutable receipt contracts for rent payments after deciding how historical rent payments should receive receipt metadata.
4. `packages/orders`: keep order extraction REEBS-focused unless Dev ERP adds an order concept; do not force Dev ERP rent into an order model.

## 11. Rollback Considerations

- This review is documentation-only. Rollback is removal or reversion of this markdown file and related progress-log references.
- Future implementation rollback should preserve existing rent payment records, invoice statuses, accounting entries, public invoice tokens, and reports.
- Shared service extraction should begin with adapters so Dev ERP can return to existing route handlers without data migration.

## 12. Manual Testing Checklist

- Create rent payment and verify dashboard balances, payment list, and notification behavior.
- Edit rent payment and verify recalculated balances and reports.
- Delete rent payment with authorized role and verify tenant/payment totals update correctly.
- Mark accounting entry paid and verify dashboard/accounting summaries.
- Generate accounting invoice PDF and verify it does not create a persisted invoice row.
- Create invoice, send invoice, and verify public view token behavior.
- Send quotation and verify accept/decline flows from admin and public token paths.
- Mark invoice paid and verify paid date/status behavior.
- Verify reports that depend on rent, accounting, and invoices remain consistent.
- Verify unauthorized users cannot mutate rent payments, accounting entries, or invoices.
