# REEBS Portal Order, Payment, Receipt Workflow Review

## Purpose

This review maps the current REEBS Portal order, payment, receipt, invoice, and balance workflows before any shared finance platform extraction. It is documentation-only and does not change application logic, routes, permissions, database schema, payment behavior, receipt generation, invoice generation, POS behavior, or order calculations.

## 1. Order Flow Mapping

### Where Orders Originate

- POS orders originate in `apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx` and post to `/api/orders` with `source: "POS"`, `purchaseChannel: "In Store"`, `isPosOrder: true`, selected payment preference, optional cash or MoMo details, an idempotency key, customer details, and cart items.
- Manual admin orders originate in `apps/reebs-portal/src/pages/OrderBuilder/OrderBuilder.jsx` and post to `/api/orders` with `source: "Manual Admin Entry"`, `purchaseChannel: "Admin"`, status, pickup/delivery details, discounts, and line items.
- Booking-linked add-on orders are supported by the backend source context in `apps/reebs-portal/backend/functions/_shared/shopOrders.js` through `linkedBookingId` or `bookingId`. The backend validates the linked booking within the same organization.
- Rent-linked orders are not part of REEBS Portal based on the reviewed code paths.

### POS Flow

- Store Mode builds a customer, cart, payment state, receipt delivery preference, and order payload before creating the order through the orders API handler.
- Immediate POS payment paths pass payment method, amount, provider/reference/phone details, and receipt contact data.
- Pay-later POS paths create an unpaid or pending order without immediate stock commitment from the POS form.
- The backend creates the order, optionally records the initial full payment, optionally creates a receipt, and commits stock only when payment/status rules allow it.

### Booking-Linked Orders

- Backend order creation accepts booking context and marks the source as a booking add-on when a linked booking is found.
- Booking screens link to invoice document generation through `/admin/invoicing?type=bookings&id=...`.
- Booking add-on order behavior should stay separate from booking creation/editing until a deeper booking/order consolidation is explicitly designed.

### Invoice-Linked Flows

- Order detail pages can link to invoice/receipt document creation through `/admin/invoicing?type=orders&id=...`.
- `apps/reebs-portal/backend/functions/invoice-documents.js` stores invoice document records for manual, order, and booking source types.
- `apps/reebs-portal/backend/functions/generateInvoice.js` can generate order-based invoice/receipt details using order data and adjustments.
- Order receipts generated from payments and invoice document receipts are currently separate concepts and should not be merged without reconciliation.

### Order Status Flow

- `apps/reebs-portal/backend/functions/orders.js` handles list/detail reads, order creation, metadata updates, cancellation, and payment-recording compatibility paths.
- `apps/reebs-portal/backend/functions/_shared/shopOrders.js` is the central backend source for order creation, payment recording, stock commitment, receipt generation, and accounting journal creation.
- Paid order cancellation is restricted to owner/admin roles.
- Order status can be updated directly by order mutation routes, but payment recording can also move an order to `partially_paid` or `paid`.

### Outstanding Balance Flow

- The backend stores order totals and payment aggregates in cents.
- Successful/confirmed/paid order payments are aggregated into `amountPaidCents`.
- `balanceDueCents` is calculated as order grand total minus successful payments, clamped at zero.
- `paymentStatus` becomes `unpaid`, `partially_paid`, `paid`, or `overpaid` based on aggregate payment state.

## 2. Payment Flow Mapping

### Where Payments Are Recorded

- Order detail payments are managed by `apps/reebs-portal/src/pages/Orders/hooks/useOrderPayments.js` and `apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx`.
- Order board/list payment updates are also posted from `apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx` when a payment modal is used during status changes.
- POS immediate payments are submitted during order creation from Store Mode.
- Backend payment writes go through `apps/reebs-portal/backend/functions/orderPayments.js` and ultimately `recordOrderPayment` in `apps/reebs-portal/backend/functions/_shared/shopOrders.js`.

### Manual Payment Flow

- Manual payments collect amount, method, provider, transaction reference, phone number, and notes in the order payment UI.
- The payment function validates organization access and `orders:write` permission before recording the payment.
- The order payment insert triggers payment aggregation, order status refresh, stock commitment checks, receipt generation, accounting journal creation when accounting tables are available, and an order event.

### MoMo References

- The POS flow and payment ledger both support mobile money references.
- Payment records can store provider, transaction reference, and phone number.
- The reviewed UI does not independently confirm MoMo settlement; confirmation is represented as payment metadata/state rather than a provider-verified workflow.

### Partial Payments

- Partial payments are supported by the payment ledger and order list payment modal.
- The frontend validates amount against visible balance in the modal, while the backend remains the source of truth for aggregate paid and balance amounts.
- Partial payment updates can move orders to `partially_paid`.

### Outstanding Balances

- Outstanding balances are recalculated from persisted order total and successful payment records.
- Payment state is aggregate-driven and should be treated as production-sensitive because it affects stock commitment, receipt creation, order status, and reporting.

### Payment Status Logic

- Backend aggregation includes payments whose status is `successful`, `confirmed`, or `paid`.
- Payments default to successful unless another status is supplied.
- `confirmationStatus` exists in backend payment payload handling, but the reviewed payment UI primarily captures method/provider/reference data.

### Payment APIs, Hooks, and Components

- API: `apps/reebs-portal/backend/functions/orderPayments.js`
- API compatibility path: `apps/reebs-portal/backend/functions/orders.js`
- Backend helper: `apps/reebs-portal/backend/functions/_shared/shopOrders.js`
- Hook: `apps/reebs-portal/src/pages/Orders/hooks/useOrderPayments.js`
- Components: `PaymentLedger.jsx`, `OrdersList.jsx`, `StoreMode.jsx`

## 3. Receipt Flow Mapping

### Where Receipts Are Generated

- Order payment receipts are generated by `createReceiptForPayment` in `apps/reebs-portal/backend/functions/_shared/shopOrders.js`.
- Receipts are generated after a payment is recorded and payment/order snapshots are available.
- Invoice document records can also represent receipt documents, but they are stored separately from `OrderReceipt`.

### Receipt Numbering

- Order payment receipt numbers use the format `REC-YYYYMMDD-###`.
- Number generation uses a transaction-scoped advisory lock and a daily count to reduce duplicate numbering risk.
- Receipt numbers are unique per organization in the order receipt model.

### Receipt Rendering

- Receipt detail data is read through `apps/reebs-portal/backend/functions/orderReceipts.js`.
- `apps/reebs-portal/src/pages/Orders/components/ReceiptViewer.jsx` renders the receipt snapshot.
- Receipt snapshots include order, payment, customer, item, and total details at generation time.

### Print and Share Flow

- Receipt Viewer supports thermal printing through QZ Tray when available in the browser.
- Store Mode captures receipt delivery channel/contact values, but the reviewed payment receipt path should be verified before treating WhatsApp/email delivery as complete for order receipts.

### WhatsApp and Email Integrations

- Shared WhatsApp and email helpers exist under `apps/reebs-portal/backend/functions/_shared/`.
- Invoice document email sending is implemented in `apps/reebs-portal/backend/functions/invoice-document-email.js`.
- Order receipt delivery over WhatsApp/email should be reviewed separately before platform extraction.

### Receipt Dependencies

- Order receipts depend on order totals, payment records, organization context, item snapshots, and receipt numbering.
- Receipts are immutable enough to rely on snapshots for display, but future platform extraction should explicitly preserve immutability guarantees.

## 4. Invoice Flow Mapping

### Invoice Generation Points

- Admin invoicing creates invoice/receipt documents through `apps/reebs-portal/backend/functions/invoice-documents.js`.
- Order detail and booking admin screens can open the invoicing workspace with source type and source id.
- `apps/reebs-portal/backend/functions/generateInvoice.js` can build an order-based invoice/receipt response from order data.

### Invoice Dependencies

- Invoice documents depend on source type, source id, document line items, additional items, expenses, tax rate, discount amount, deposit amount, customer/recipient details, and organization context.
- For manual and booking invoice documents, inventory deltas can be committed when documents are sent.
- Order source invoice documents should remain separate from order payment receipts until a shared document strategy is designed.

### Invoice Status Handling

- Invoice documents support draft, unpaid, and paid payment-status style states.
- Email sending updates sent metadata and calculates deposit/balance messaging.
- Archiving reverses invoice document inventory deltas where inventory was managed by the invoice document flow.

### Relationship to Orders and Payments

- Orders have their own payment ledger and receipt table.
- Invoice documents can be generated from order data but do not replace the order payment ledger.
- Future shared finance work must define which object is the financial source of truth before merging invoice, receipt, and payment concepts.

## 5. Financial Calculation Mapping

### Balance Calculations

- Order balances are calculated in cents from order grand total minus successful/confirmed/paid payment sums.
- Invoice documents calculate totals in major currency units from line items, additional items, expenses, taxes, and discounts.
- `generateInvoice.js` derives display summaries from order data and invoice-style adjustments.

### Outstanding Logic

- Outstanding order balances are stored as `balanceDueCents`.
- Overpayment is represented by `paymentStatus: "overpaid"` while balance due remains zero.
- Invoice document balance messaging can depend on deposit amount and due-date behavior.

### Payment Aggregation

- Payment aggregation is performed after each payment write.
- Aggregation drives order amount paid, balance due, payment status, and some order status changes.

### Discounts

- Admin order builder can convert percent discounts into fixed discount amount before sending the order payload.
- Order backend applies fixed discount cents to the order total.
- Invoice documents apply discount amounts in their own calculation path.

### Taxes

- Reviewed order payment flows do not rely on tax calculation.
- Invoice documents support tax rate and tax amount calculation.

### Stock Deduction Timing

- Stock commitment is tied to order status/payment status and runs through `commitOrderStockIfNeeded`.
- POS paid orders can commit stock immediately.
- Pay-later or pending orders should not commit stock until payment/status rules allow it.
- Invoice documents can also commit or reverse inventory for manual and booking source types, which creates a high-risk overlap for future shared inventory/payment work.

### Refund Logic

- Paid order cancellation marks payment status as `refund_pending`.
- A full refund workflow was not found in the reviewed order payment paths.

## 6. Shared Dependencies

### Shared Helpers

- `apps/reebs-portal/backend/functions/_shared/shopOrders.js`
- `apps/reebs-portal/backend/functions/_shared/normalizeOrders.js`
- `apps/reebs-portal/backend/functions/_shared/orderDetails.js`
- `apps/reebs-portal/backend/functions/_shared/deliveryFee.js`
- `apps/reebs-portal/backend/functions/_shared/inventoryExtensions.js`
- `apps/reebs-portal/backend/functions/_shared/paymentInstructions.js`
- `apps/reebs-portal/backend/functions/_shared/auditLog.js`
- `apps/reebs-portal/backend/functions/_shared/email.js`
- `apps/reebs-portal/backend/functions/_shared/whatsapp.js`
- `apps/reebs-portal/backend/functions/_shared/transactionEmailTemplates.js`

### Shared APIs

- `apps/reebs-portal/backend/functions/orders.js`
- `apps/reebs-portal/backend/functions/orderPayments.js`
- `apps/reebs-portal/backend/functions/orderReceipts.js`
- `apps/reebs-portal/backend/functions/invoice-documents.js`
- `apps/reebs-portal/backend/functions/invoice-document-email.js`
- `apps/reebs-portal/backend/functions/generateInvoice.js`

### Shared Components

- `apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx`
- `apps/reebs-portal/src/pages/Orders/components/ReceiptViewer.jsx`
- `apps/reebs-portal/src/pages/Orders/hooks/useOrderPayments.js`
- `apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx`
- `apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx`
- `apps/reebs-portal/src/pages/OrderBuilder/OrderBuilder.jsx`

### Duplicated Logic

- Order payment receipts and invoice document receipts are separate receipt-like systems.
- Order totals, invoice document totals, and generated invoice summaries calculate money in separate paths.
- Payment capture UI exists in Store Mode, Orders List, and Order Detail.
- Inventory commitment can happen through order payment/status and through invoice document sending for some source types.

### Cross-Module Dependencies

- Orders affect inventory, receipts, accounting journals, reports, customer data, booking add-ons, and invoice documents.
- Payment writes affect stock commitment and accounting side effects, not only balances.

## 7. High-Risk Areas

- Duplicate calculation paths between orders, generated invoices, and invoice documents.
- Payment aggregation and order status updates happen together and must stay transactionally safe.
- Receipt generation depends on payment writes and must avoid duplicate or stale receipts.
- Inventory commitment depends on payment/status timing and can drift from payment state if changed unsafely.
- Order receipts and invoice document receipts may confuse operators if treated as the same receipt type.
- Mobile money references are stored, but provider confirmation should not be assumed without a verified integration.
- Refund behavior is incomplete beyond `refund_pending` state in the reviewed flows.
- Runtime invoice document table creation/alteration in a function path is operationally sensitive.
- Future offline payment sync could create duplicate payment, stale receipt, and stock mismatch risks without idempotency.

## 8. Security Considerations

- Order and payment APIs require authenticated users and `orders:read` or `orders:write` permissions.
- Invoice document APIs require `invoices:read` or `invoices:write` permissions.
- Paid order cancellation is owner/admin-sensitive.
- Payment modification paths should remain permission-sensitive and audit-covered.
- Receipt spoofing risk should be managed by immutable server-generated receipt numbers and snapshots.
- Audit events currently exist for order creation, payment recording, updates, cancellation, and receipt generation events. Audit coverage should be confirmed before extracting shared services.
- Environment-sensitive dependencies include database connection settings, email/WhatsApp provider configuration, printer/browser integration, and any payment instruction/provider settings.

## 9. Future Platform Extraction Opportunities

- Shared payment ledger service for recording payments, enforcing idempotency, and aggregating balances.
- Shared receipt engine for immutable numbering, rendering, delivery metadata, and print/share adapters.
- Shared invoice service for source-linked invoice documents and source-of-truth reconciliation.
- Shared balance calculator for cents-safe totals, partial payments, overpayments, and outstanding balances.
- Offline-safe payment queue with server-side idempotency and reconciliation.
- Shared transaction audit layer for order, payment, receipt, invoice, and inventory side effects.

## 10. Recommended Extraction Order

1. `packages/finance`: start with read-only money utilities, status mapping, cents-safe balance projections, and calculation fixtures. Do not move write paths first.
2. `packages/orders`: add read-only order adapters and source-context mapping so REEBS order behavior can be documented and tested before shared writes exist.
3. `packages/payments`: introduce an idempotent payment command contract around the existing `orderPayments` behavior, initially as wrappers/tests with no persistence change.
4. `packages/receipts`: extract receipt rendering and numbering contracts only after order receipts and invoice document receipts have a documented source-of-truth decision.

## 11. Rollback Considerations

- This review is documentation-only. Rollback is removal or reversion of this markdown file and related progress-log references.
- Future implementation rollbacks should be designed around preserving existing API routes, existing receipt numbers, existing payment records, and existing stock movements.
- Shared package extraction should be reversible at the adapter layer before any backend write paths are moved.

## 12. Manual Testing Checklist

- Create POS paid order and verify payment, order status, stock movement, receipt availability, and audit event.
- Create POS pay-later order and verify no premature stock commitment.
- Record partial order payment from order detail and verify balance/status update.
- Record full order payment from order list flow and verify receipt creation.
- Generate invoice/receipt document from an order and verify it does not overwrite order payment receipt records.
- Generate invoice document from a booking and verify inventory behavior remains unchanged.
- Cancel unpaid order and paid order with appropriate role coverage.
- Verify MoMo reference/provider/phone fields display and persist as expected.
- Verify receipt print flow where QZ Tray is available.
- Verify email/WhatsApp receipt delivery assumptions before any shared receipt extraction.
