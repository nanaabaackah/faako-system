# Shared Form And Table System Plan

Date: 2026-05-12

## Summary

This is a planning-only document for a future shared form and table system across Faako ERP apps. No app logic, routes, database schema, workflows, persistence, permissions, payment logic, receipt generation, booking behavior, inventory behavior, or offline queue processing changed as part of this plan.

REEBS Portal and Dev ERP are production-sensitive. Shared form/table work must start with display wrappers and compatibility adapters, then move into app-specific adoption only after visual checks and route/workflow verification.

## Files Reviewed

Representative files reviewed:

- `packages/ui/src/components/DataTable.tsx`
- `packages/ui/src/components/Fields.tsx`
- `packages/ui/src/components/Primitives.tsx`
- `packages/ui/src/components/Feedback.tsx`
- `packages/ui/src/compat.css`
- `apps/reebs-portal/src/pages/Admin/Admin.jsx`
- `apps/reebs-portal/src/pages/Admin/styles/AdminInventoryRegister.css`
- `apps/reebs-portal/src/pages/AdminBookings/AdminBookings.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/AdminBookings.css`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingEditorModal.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingDetailModal.jsx`
- `apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx`
- `apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx`
- `apps/reebs-portal/src/pages/AdminCustomers/components/*`
- `apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx`
- `apps/dev-erp/src/pages/Rent/Rent.jsx`
- `apps/dev-erp/src/pages/Invoicing/Invoicing.jsx`
- `apps/dev-erp/src/pages/Reports/Reports.jsx`
- `apps/dev-erp/src/pages/UserControl/UserControl.jsx`
- `apps/dev-erp/src/pages/AuditLogs/AuditLogs.jsx`
- `apps/dev-erp/src/pages/Productivity/Productivity.jsx`
- `apps/dev-erp/src/pages/SystemHealth/SystemHealth.jsx`

## 1. Current Repeated Patterns

### Tables

- REEBS uses multiple app-owned table patterns: `admin-table`, `admin-table-scroll`, `orders-table`, `bookings-hub-table`, inventory register tables, inventory variant tables, and table footers with summary cells.
- Dev ERP uses `data-table`/`table-row` div-based tables in Invoicing and System Health, native tables in Rent and User Control, and repeated `table-strong`/stacked cell content.
- Existing `@faako/ui` `DataTable` already supports typed columns, sortable headers, summaries, empty/loading/error states, and scroll wrapping, but it does not yet cover pagination, row selection, bulk action bars, mobile card fallbacks, row expansion, destructive row actions, editable cells, or domain-specific status rendering.

### Forms

- Dev ERP repeats `form-field`, `stack`, page-specific grids such as `invoice-grid`, `rent-form-row`, `report-editor__grid`, and `user-control-create-grid`.
- REEBS repeats `customers-form`, `bookings-editor-form`, `orders-payment-field`, `bookings-expense-field`, inventory filter labels, customer modal forms, and payment drawer fields.
- Shared `@faako/ui` fields exist, but many app forms need legacy class compatibility and workflow-specific validation/submit behavior preserved.

### Filters And Search

- REEBS uses `SearchField`, `FilterBar`, bookings toolbar filters, orders toolbar filters, inventory register filters, and URL-backed booking/order UI state.
- Dev ERP repeats filter forms in Audit Logs, Invoicing, Reports, Productivity, Rent, and System Health.
- Filter state is often tied to URLs, role-specific views, backend query params, or local storage, so the first shared layer should be visual and compositional, not state-owning.

### Pagination

- REEBS has local pagination renderers for Orders and Bookings, inventory register pagination classes, invoice document pagination styles, and mobile-specific pagination variants.
- Dev ERP currently has fewer shared pagination surfaces, but tables still need future pagination conventions for long operational lists.
- Pagination needs shared metadata display, range text, previous/next controls, disabled states, mobile wrapping, and screen-reader labels.

### Modal Forms

- REEBS uses `customers-modal`, `customers-modal-panel`, `admin-modal-panel`, booking editor/detail modals, order payment modals, inventory modals, and water/order modal variants.
- Dev ERP uses `modal-backdrop`, `modal-card`, invoice preview/form modals, and page-specific modal header/action structures.
- Modal extraction is medium-to-high risk because focus management, escape behavior, background dismissal, destructive actions, and form submit behavior vary by workflow.

### Status Badges

- Shared `StatusPill` and `ErpStatusBadge` exist, but apps also use `status-pill`, `orders-status-pill`, `bookings-pill`, `bookings-link-pill`, sync banners, rent status cards, invoice status pills, and health status pills.
- Status text and tone mapping are domain-specific. A shared badge shell is safer than a shared status meaning map at first.

### Bulk Actions

- REEBS Inventory has selected-item state and bulk move/archive/restore/delete UI.
- User Control has row-level user actions that feel bulk-adjacent but are permission-sensitive.
- Bulk action extraction should wait until selection semantics, destructive confirmations, and permission behavior are documented per app.

### Empty, Loading, And Error States

- Both ERP apps repeat `loading-card`, `notice is-error`, `notice is-success`, `admin-empty`, `bookings-empty`, `orders-empty`, and inline status banners.
- `@faako/ui` already includes `EmptyState`, `InlineNotice`, `NoticeBanner`, and toast foundations. Adoption should begin on read-only surfaces before live workflow forms.

## 2. Shared Component Opportunities

Recommended future components:

- `TableShell`: scroll wrapper, caption, density, sticky-header option, legacy class adapter, and responsive overflow behavior.
- `DataTableV2`: column definitions, optional sorting, row action slots, summary/footer cells, empty/loading/error rendering, and accessible captions.
- `TablePagination`: range text, page count, previous/next buttons, disabled states, mobile layout, and aria labels.
- `BulkActionBar`: selected count, primary/secondary action slots, destructive action slot, clear-selection action, and permission-aware disabled text.
- `FilterToolbar`: grouped filters, search slot, segmented view controls, action area, responsive wrapping, and URL-state-friendly composition.
- `SearchControlAdapter`: bridge between REEBS `SearchField` and shared field/search styling without changing search behavior.
- `FormSection`: title, description, content grid, notice slot, action slot, and legacy class compatibility.
- `FormGrid`: responsive form layout primitive for two-column, three-column, full-width, and compact rows.
- `FormActions`: consistent alignment for save/cancel/destructive controls with loading and disabled states.
- `ModalFormShell`: modal frame, title/description, close button slot, footer actions, form body slot, and future focus-management hooks.
- `StatusBadge`: visual badge shell with domain-provided tone/class, not shared business meaning.
- `ActionToolbar`: page-level and table-level action grouping for refresh, export, create, print/share, and review actions.

## 3. App-Specific Exceptions

- REEBS Store Mode/POS should not adopt shared table/form wrappers until mobile POS layout, cart persistence, payment method drafts, offline queued POS orders, and payment references have dedicated visual and workflow tests.
- REEBS Orders payment forms and payment ledger should preserve existing online/offline payment behavior, final receipt behavior, balance presentation, and server validation. Shared wrappers may start with read-only payment history rows before touching payment forms.
- REEBS Bookings editor/detail forms should preserve availability, status, selected rental items, expenses, invoice links, delivery/setup notes, and offline booking queue notices. Shared modal wrappers are not first-wave candidates.
- REEBS Inventory register has bulk selection, archive/restore/delete, stock adjustment queue notices, variants, low-stock state, and mobile cards. Shared table adoption must start with wrapper-only compatibility.
- Dev ERP Rent forms and tables are tied to live rent payment recording, queued offline new payments, tenant status, and operational reports. Treat payment forms and rent tables as high risk.
- Dev ERP Invoicing modals combine invoice status, line items, totals, public invoice behavior, PDF export, and client actions. Shared modal/form extraction is medium-to-high risk.
- Dev ERP User Control tables/forms are auth and permission sensitive. Shared table wrappers may be safe later, but role/status/password/reset actions must stay app-owned.
- Dev ERP Reports and Productivity include email, AI/productivity, schedule, and operational report settings. Shared fields are possible, but workflows remain app-owned.

## 4. Safe Extraction Candidates

Safe first candidates:

- Shared visual `TableShell` that only wraps existing table markup and preserves app class names.
- Shared `TablePagination` that accepts app-owned page state/callbacks and does not fetch or mutate data.
- Shared `FilterToolbar` and `ActionToolbar` wrappers that render children and preserve existing query/filter state.
- Shared `FormSection`, `FormGrid`, and `FormActions` wrappers that only control layout.
- Shared `StatusBadge` shell that takes `label`, `tone`, and `className`, while apps keep status normalization and business mapping.
- Shared `EmptyState` and `InlineNotice` adoption in read-only/reporting areas.
- Story/workbench examples in `apps/ui-workbench` before production app adoption.
- Dev ERP Settings/Profile-style low-risk form surfaces after visual checks.

## 5. Medium And High-Risk Extraction Candidates

Medium risk:

- Dev ERP Invoicing list display, excluding invoice create/edit modal internals.
- Dev ERP Reports editor layout, excluding report run/schedule behavior.
- Dev ERP Audit Logs filters, because they are mostly read-only but URL/query behavior must stay unchanged.
- REEBS Bookings list table wrapper, excluding editor/detail modal and status mutation controls.
- REEBS Orders list table wrapper, excluding payment action modal and offline payment queue logic.
- REEBS Customers result views, after modal create/detail workflows are reviewed.

High risk:

- POS cart, checkout, payment, and offline queued sale UI.
- Manual payment forms, payment ledgers with offline sync, receipt previews, and final receipt actions.
- Inventory stock adjustment forms, bulk archive/delete/move, reservation/deduction status, and variant edits.
- Booking create/edit/status modals, availability checks, delivery/setup schedule, linked invoices, and expenses.
- Dev ERP rent payment forms, tenant edits, accounting/invoice/report relationships, and queued offline rent payments.
- User/role/password reset tables and forms.
- Any shared component that owns data fetching, server mutation, validation, permissions, or persistence.

## 6. Mobile-Specific Considerations

- REEBS already switches between table/card views in Bookings, Orders, and Inventory. Shared tables must support mobile card fallbacks without forcing a single layout.
- POS mobile layout should remain app-owned until a dedicated mobile POS layout system is planned and tested.
- Pagination controls need compact wrapping and larger touch targets.
- Filter toolbars need horizontal and stacked modes without causing text overflow.
- Modal shells need safe viewport-height handling, scroll containment, and keyboard-friendly close/action controls.
- Dense operational lists should not hide payment, stock, booking, or status context on small screens.

## 7. Accessibility Considerations

- Shared tables should require `caption` or labelled headers for screen readers.
- Sort buttons must expose active sort direction with `aria-sort` or equivalent assistive text.
- Pagination controls need `aria-label`, disabled states, and readable range text.
- Empty/loading/error states should use appropriate `role="status"` or `role="alert"` and `aria-live`.
- Modal form shells need focus management, labelled dialogs, escape behavior, close buttons with labels, and safe background dismissal rules.
- Form wrappers must keep label/input association through nesting or `htmlFor`/`id`.
- Bulk action bars should announce selected counts and destructive action consequences.
- Status badges need text labels, not color-only meaning.

## 8. Performance Considerations

- Shared table wrappers should not sort, filter, or paginate unless explicitly configured. Existing app-owned memoization and server queries should remain intact.
- Large lists need optional virtualization planning later, but virtualization is not a first implementation step because row heights, mobile cards, and interactive controls vary by app.
- Column render functions should be memo-friendly and avoid recreating expensive formatters per row.
- Filter inputs should allow app-owned debouncing and URL sync.
- Shared components should avoid unnecessary context/global state.
- CSS extraction should reduce duplication without importing heavy app-specific styles into all apps.

## 9. Styling Consistency Opportunities

- Align table overflow wrappers, header rows, summary footers, row actions, and numeric alignment across ERP apps.
- Align form field spacing, helper/error text, full-width fields, compact row grids, and action rows.
- Align filter/search toolbar spacing, segmented controls, and responsive wrapping.
- Align status badge size, border radius, tone tokens, and readable contrast while allowing app-specific color accents.
- Align loading/empty/error presentation with `@faako/ui` feedback primitives.
- Keep app branding through CSS variables and className overrides rather than hard-coding one ERP look.

## 10. Recommended Implementation Order

1. Add docs and workbench examples for table/form patterns before production app adoption.
2. Add `TableShell`, `TablePagination`, `FilterToolbar`, `ActionToolbar`, `FormSection`, `FormGrid`, and `FormActions` as presentational wrappers in `@faako/ui`.
3. Add accessibility-focused tests or examples for captions, labelled filters, notices, pagination labels, and modal labelling.
4. Adopt wrappers in low-risk read-only Dev ERP surfaces such as Audit Logs or Settings/Profile-style sections.
5. Adopt wrappers in read-only/reporting table surfaces, preserving existing row markup and callbacks.
6. Adopt wrapper-only table shells for REEBS Orders and Bookings lists after desktop/mobile screenshots.
7. Adopt wrapper-only table shells for REEBS Inventory after bulk selection and mobile card checks.
8. Plan modal shell extraction separately for read-only/preview modals before form-submit modals.
9. Plan form field wrapper adoption per domain after app-specific validation and submit flows are tested.
10. Leave POS, payments, receipts, booking creation/status, inventory stock changes, rent payment recording, user roles, and high-risk workflow forms for last.

## Manual Verification Checklist For Future Implementation

- Desktop and mobile screenshots for each adopted page.
- Keyboard navigation through filters, tables, pagination, forms, and modals.
- Screen reader labels for captions, pagination, sort controls, errors, and modals.
- Unchanged route URLs, query params, filters, and local storage behavior.
- Unchanged auth/permission behavior and disabled states.
- Unchanged online submission behavior for every form touched.
- Unchanged offline queue notices and retry/review behavior where present.
- No broken table totals, summary rows, status labels, or payment/booking/inventory amounts.
- App builds/lint/type checks for every affected app.

## Next Step

Shared table foundation implementation.
