# Dev ERP Finance Consolidation Plan

## Purpose

Document a safe, planning-only path for future Finance consolidation in Dev ERP. Dev ERP is fully live with real operational data, so this plan must not change app logic, database schema, payment flows, rent payment behavior, invoice behavior, accounting logic, files, routes, redirects, or backend capabilities.

## Current Implementation Status

Finance grouping is reviewed and pending for Dev ERP. Accounting and Invoicing remain separate visible routes, Rent Payments remain under Rent, Reports remain under Reports, and public invoice views remain outside authenticated navigation assumptions.

The hidden `payments` registry parent should not be exposed or renamed to Finance until rent-only users, public invoice token behavior, accounting/invoicing product language, report dependencies, mobile tabs, and backend capabilities are reviewed together.

## 1. Current Finance-Related Modules/Routes

Current authenticated routes:

- Accounting: `/accounting`
- Invoicing: `/invoicing`
- Rent and rent payments: `/rent`
- Reports: `/reports`
- Audit logs: `/audit-logs`
- Dashboard finance/rent summaries: `/dashboard`
- Organizations/client context: `/organizations`

Current public finance-adjacent routes:

- Public invoice view: `/invoice/view/:token`
- Public invoice accept/decline actions through token-backed API routes

Current backend API surfaces:

- `GET/POST/PATCH /api/accounting/entries`
- `POST /api/accounting/entries/:id/mark-paid`
- `POST /api/accounting/entries/:id/archive`
- `POST /api/accounting/entries/:id/invoice`
- `GET/POST/PATCH /api/invoices`
- `POST /api/invoices/:id/send`
- `POST /api/invoices/:id/send-quotation`
- `POST /api/invoices/:id/accept`
- `POST /api/invoices/:id/decline`
- `GET/POST /api/invoices/view/:token/...`
- `GET/POST/PATCH/DELETE /api/rent/payments`
- `GET /api/rent/dashboard`
- Report APIs used by `/reports`

Current registry shape:

- `payments` is a hidden parent for Accounting and Invoicing.
- `rent` owns Rent and Appointments.
- No dedicated POS, Orders, or Receipts module exists in Dev ERP today.

## 2. Current Workflow Mapping

- Rent payments are created, edited, and deleted from `src/pages/Rent/Rent.jsx` through `/api/rent/payments`.
- Rent balances are calculated by backend rent summary helpers from `RentTenant.monthlyRent`, `RentTenant.openingBalance`, lease dates, and `RentPayment` records.
- Accounting entries are created and edited from `src/pages/Accounting/Accounting.jsx` through `/api/accounting/entries`.
- Accounting paid state is set through entry status and `/api/accounting/entries/:id/mark-paid`.
- Accounting summaries are currently calculated in the Accounting page from loaded accounting entries.
- Invoices are created and edited from `src/pages/Invoicing/Invoicing.jsx` through `/api/invoices`.
- Invoices can also originate from Accounting entries through `/api/accounting/entries/:id/invoice`.
- Invoice PDFs are generated client-side through invoice PDF utilities.
- Invoice email/send/quotation flows use `/api/invoices/:id/send` and `/api/invoices/:id/send-quotation`.
- Public invoice acceptance/decline uses token-backed public API routes.
- Reports read from report summary APIs and include KPI, rent monthly summary, accounting reminder, and operational reporting data.
- Dev ERP does not currently have a dedicated receipt generation workflow or POS/order payment workflow.

## 3. Target Finance Structure

Suggested target structure for future implementation:

- Finance
- Payments
- Receipts
- Invoices
- Expenses
- Accounting
- Rent Payments
- Financial Reports

The first implementation should be navigation metadata only. Existing URLs, APIs, capability checks, calculations, emails, invoice token behavior, and rent-only user behavior should remain unchanged.

## 4. High-Risk Areas

- Duplicate payment calculations between rent payments, accounting paid entries, invoice statuses, and reports.
- Outstanding rent balance logic, especially opening balances, lease dates, month windows, and partial payments.
- Invoice generation from accounting entries and independent invoice creation.
- Invoice status transitions, public acceptance/decline, token expiry, and sent quotation behavior.
- Rent payment edits/deletes affecting live balances and reports.
- Accounting entry mark-paid/archive behavior affecting reporting.
- Report dependencies that read accounting, rent, invoice, organization, dashboard, or audit data.
- Future receipt generation, because no dedicated receipt source of truth exists today.
- Offline payment sync later, especially for rent payments or mobile field collection.
- Capability mismatches between frontend navigation and backend route/module access.

## 5. Data Dependencies

Current shared tables/models include:

- `AccountingEntry`
- `Invoice`
- `InvoiceLineItem`
- `RentTenant`
- `RentPayment`
- `Organization`
- `User`
- Report configuration and reporting/audit data used by `/reports`
- Booking and booking settings data for appointment-related reporting context

API/reporting dependencies include:

- Accounting entry APIs
- Invoice APIs and token-backed public invoice APIs
- Rent dashboard and rent payment APIs
- Report summary/send/configuration APIs
- Auth capability middleware and rent-only module restrictions
- Email templates for invoice sending, rent payment recorded notifications, rent monthly summaries, and accounting reminders

## 6. Security Considerations

- Dev ERP finance routes are capability-sensitive: accounting, invoicing, rent, reports, and audit logs can be granted separately.
- Backend middleware and capability checks must remain authoritative.
- Rent-only users must not gain broader finance access through a future Finance parent.
- Public invoice token routes must stay outside authenticated navigation assumptions and require careful token expiry/status handling.
- Rent payment create/edit/delete actions require manager/admin-level review and should remain auditable.
- Accounting mark-paid/archive/invoice actions require admin-level controls.
- Payment, rent, invoice, organization, and client data must be treated as live production data.
- Future payment modification, receipt issuing, refund, or adjustment behavior needs explicit audit logging requirements before implementation.

## 7. Recommended Implementation Order

1. Keep this plan documentation-only until Dev ERP finance workflow owners approve a target structure.
2. Confirm current accounting, invoicing, rent payment, report, public invoice, and capability behavior.
3. Rename or document the hidden `payments` parent as Finance in registry metadata only if product language is approved. Current review keeps this pending.
4. Preserve existing `/accounting`, `/invoicing`, `/rent`, `/reports`, `/audit-logs`, and `/invoice/view/:token` routes.
5. Preserve all accounting calculations, invoice totals, invoice status behavior, rent payment calculations, and report summaries.
6. Keep Rent Payments under Rent until a live workflow review approves cross-linking under Finance.
7. Add Finance grouping only as metadata/navigation, then verify normal users, rent-only users, and admin users separately.
8. Add read-only Finance overview links only after navigation grouping proves stable.
9. Design any receipt service, payment ledger, or shared invoice engine as separate production-sensitive work.

## 8. Rollback Strategy

- Revert Finance registry/navigation metadata to the previous Payments/Accounting/Invoicing/Rent shape.
- Restore previous labels and visible navigation ordering.
- Keep every route, backend endpoint, public invoice token route, schema, calculation, email workflow, and report unchanged.
- If live users report disruption, restore previous Accounting, Invoicing, Rent, Reports, and Audit Logs visibility first.
- Do not roll back by deleting public invoice, rent, accounting, or reporting routes.

## 9. Manual Testing Checklist

- Verify `/accounting` loads entries and summaries for users with accounting access.
- Create/edit an accounting entry in a safe environment and verify existing status and totals behavior.
- Verify mark-paid, archive, and accounting-entry invoice actions remain gated and unchanged.
- Verify `/invoicing` loads invoices, creates/edits invoices, changes status, downloads PDFs, and sends invoice/quotation email.
- Verify `/invoice/view/:token` public view, accept, and decline behavior remains unchanged.
- Verify `/rent` loads tenant balances, records payments, edits payments, deletes payments, and updates dashboard summaries.
- Verify rent-only users still see only intended rent/profile navigation and cannot reach accounting/invoicing/reporting endpoints.
- Verify `/reports` summary and scheduled report controls still read expected accounting/rent/invoice data.
- Verify `/audit-logs` remains reachable for permitted users.
- Confirm no duplicate nav items and no broken links.

## 10. Future Shared Platform Opportunities

- Shared payment ledger across ERP apps.
- Shared receipt service for rent payments and future finance flows.
- Shared invoice engine with token-backed public views.
- Shared accounting summaries and reporting adapters.
- Shared audit event vocabulary for payment, invoice, rent, and accounting actions.
- Offline-safe payment queue later, after idempotency, conflict resolution, reconciliation, and notification behavior are designed.
- Common Finance module registry pattern that can represent Accounting, Invoices, Rent Payments, Reports, and future Receipts without changing backend capabilities.
