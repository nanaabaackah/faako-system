# Codebase Cleanup Audit

Date: 2026-05-12

## Summary

This is a planning-only cleanup audit for the Faako monorepo. No files were deleted, moved, renamed, or refactored as part of this audit.

REEBS Portal and Dev ERP must remain production-sensitive during any future cleanup. REEBS Portal is live/private beta and used by authenticated users. Dev ERP is fully live with real operational data. Any cleanup touching auth, API permissions, payments, receipts, orders, bookings, rent, inventory, reports, email workflows, AI/productivity endpoints, offline sync, or database schema should be treated as high risk.

The strongest cleanup opportunities are:

- Duplicate layout, card, button, table, modal, form, and status styles across app CSS files.
- Very large REEBS admin pages and Dev ERP operational pages that should be split only after focused tests and route snapshots exist.
- Repeated display helpers for currency, dates, statuses, payment methods, receipt/share messages, and queue notices.
- Legacy or candidate-unused components that should be verified with static analysis before removal.
- Module overlap already documented in consolidation plans, especially Finance, Customers/CRM, Bookings/Rentals/Schedule, Settings/Admin/Advanced, and Team/User/HR areas.

Generated/runtime folders such as `dist`, `node_modules`, and generated Prisma clients should stay out of cleanup line-count decisions. They appeared in broad scans and were excluded from source-focused findings.

## Files Reviewed

The audit reviewed source and documentation structure across:

- `apps/reebs-portal`
- `apps/dev-erp`
- `apps/stroane-web`
- `apps/faako-website`
- `apps/faako-api`
- `apps/faako-erp`
- `apps/reebs-website`
- `apps/bynana-portfolio`
- `apps/system-starter`
- `apps/ui-workbench`
- `packages/config`
- `packages/ui`
- `packages/theme`
- `packages/finance`
- `packages/offline-sync`
- `packages/notifications`
- `packages/core`
- `packages/security`
- `packages/logger`
- `packages/email-kit`
- `packages/types`
- `packages/utils`

Reference scans included:

- Source line-count scan for `*.js`, `*.jsx`, `*.ts`, `*.tsx`, and `*.css`, excluding `node_modules`, `dist`, `.turbo`, and generated Prisma clients.
- CSS selector scans for repeated `panel`, `card`, `glass-card`, `button`, `btn`, `status-pill`, `data-table`, `table-row`, `admin-modal`, `modal`, `input`, `page-header`, and `section-header` patterns.
- Helper scans for `formatCurrency`, `Intl.NumberFormat`, `toLocaleDateString`, `toLocaleString`, date/status labels, payment method labels, receipt formatting, `mailto:`, WhatsApp links, clipboard usage, and API/fetch helpers.
- Shared package usage scans for `@faako/ui`, `@faako/config`, `@faako/finance`, `@faako/offline-sync`, `@faako/notifications`, `@faako/core`, `@faako/security`, `@faako/logger`, `@faako/email-kit`, `@faako/types`, and `@faako/utils`.
- Existing module and finance consolidation plans for REEBS Portal and Dev ERP.

Notable source-size hotspots:

- `apps/dev-erp/backend/server.js`: about 10,974 lines.
- `apps/reebs-portal/src/pages/Admin/Admin.jsx`: about 6,209 lines.
- `apps/reebs-portal/src/pages/AdminInvoicing/AdminInvoicing.jsx`: about 4,363 lines.
- `apps/reebs-portal/src/pages/AdminWorkspace/AdminWorkspace.jsx`: about 3,484 lines.
- `apps/reebs-portal/src/pages/AdminAccounting/AdminAccounting.jsx`: about 3,414 lines.
- `apps/reebs-portal/src/pages/AdminBookings/AdminBookings.jsx`: about 2,784 lines.
- `apps/reebs-portal/src/styles/admin.css`: about 15,376 lines.
- `apps/dev-erp/src/index.css`: about 2,950 lines.
- `apps/faako-website/src/styles/pages/Home.css`: about 4,410 lines.

## Findings By App And Package

### REEBS Portal

Risk level: High for business logic, Medium for display-only cleanup, Safe for documentation-only cleanup.

Findings:

- `src/styles/admin.css`, `src/styles/public.css`, `src/styles/global.css`, `AdminWorkspace.css`, `StoreMode.css`, `AdminInvoicing.css`, `AdminBookings.css`, `AdminWater.css`, and `PortalSidebar.css` repeat shell, panel, table, modal, card, button, status, and responsive layout patterns.
- `Admin/Admin.jsx`, `AdminInvoicing/AdminInvoicing.jsx`, `AdminWorkspace/AdminWorkspace.jsx`, `AdminAccounting/AdminAccounting.jsx`, and `AdminBookings/AdminBookings.jsx` are long operational files with mixed data loading, state, formatting, mutation, modal, table, and queue behavior.
- Currency/date/status helper logic is repeated in Admin, Bookings, Accounting, Invoicing, Documents, Marketing, Workspace, Orders, Store Mode, Customers, Directory, Rentals, Scheduler, Water, and shared order UI files.
- REEBS already has shared wrappers for `SearchField`, `InlineNotice`, `AdminBreadcrumb`, and `SelectField`. These are useful transitional adapters but should be reviewed later for whether the local wrappers still add app-specific value.
- Candidate-unused or legacy components found by static text search: `src/components/SideNav/SideNav.jsx`, `src/components/PopupModal/PopupModal.jsx`, and the `AdminQuickActions` component. The `getAdminQuickActions` utility is still used, so the component and utility must be evaluated separately.
- Module overlap is already documented for Finance, Customers/CRM, Bookings/Rentals/Schedule, Settings/Admin/Advanced, and Team/User/HR/Timesheets. Cleanup should follow those plans, not invent a second module model.
- Offline queue UI and queue state wording now appears in Store Mode, Orders, Orders List, Admin Inventory, Bookings, and Admin Workspace. Shared presentation helpers in `@faako/offline-sync` are a good later target, but queue processing itself is high risk.

Safe cleanup candidates:

- Documentation and README alignment.
- Confirm-unused component inventory without deletion.
- Display-only helper consolidation behind tests.
- CSS token inventory and visual snapshots.

High-risk cleanup candidates:

- POS order creation, order payment recording, receipt generation, booking creation/status changes, stock adjustments, inventory reservation/deduction, auth/session handling, role checks, API handlers, Prisma migrations, and offline sync processing.

### Dev ERP

Risk level: High for backend, auth, rent, accounting, invoicing, reports, and operational records; Medium for display-only UI extraction.

Findings:

- `backend/server.js` is the largest source file in the repo and owns many live backend responsibilities. It should not be split casually because it touches auth, capabilities, operational records, reports, email/integration behavior, rent payments, public booking, public invoices, and AI/productivity endpoints.
- `src/index.css` repeats global panel, button, modal, data-table, input, status-pill, page-header, and responsive patterns that overlap with `packages/ui/src/compat.css` and `packages/theme/src/erp-shell.css`.
- `Dashboard.jsx`, `Rent.jsx`, `Invoicing.jsx`, `Accounting.jsx`, `Productivity.jsx`, `UserControl.jsx`, and `Reports.jsx` are the main long-file candidates.
- Display helpers for currency/date/status labels are repeated across Dashboard, Rent, Invoicing, Accounting, InvoiceView, Productivity, Reports, AuditLogs, `utils/formatters.js`, `utils/status.js`, and `utils/invoicePdf.js`.
- Dev ERP has a good `api/client.ts` pattern, but public booking/setup/invoice view flows still use direct `fetch` where public-route behavior differs. Any consolidation must preserve public token and unauthenticated route behavior.
- Finance grouping remains pending by design. Do not force rent payments, public invoices, reports, or accounting into shared finance logic during cleanup.
- Bookings/Appointments are currently rent-adjacent and calendar-oriented. Do not force a REEBS-style booking model.

Safe cleanup candidates:

- Documentation cleanup and backend route map documentation.
- Display-only date/currency helper alignment.
- CSS token inventory and visual snapshots.
- Static usage audit for package exports and page-local helpers.

High-risk cleanup candidates:

- Backend route splitting, auth/capability changes, rent payment writes, accounting entries, invoice status changes, public invoice tokens, public booking behavior, email workflows, AI/productivity endpoints, environment validation, and Prisma migrations.

### Stroane Web

Risk level: Medium for frontend cleanup, High for auth, customer/order/payment-adjacent data, backend, Prisma, and environment configuration.

Findings:

- `Header.css`, `globals.css`, `App.css`, and page CSS files repeat card, button, page shell, header, and responsive patterns that overlap with shared UI primitives.
- `Shop.tsx`, `ProductList.tsx`, `ProductDetail.tsx`, `UserManagement.tsx`, and `FloatingHeader.tsx` are candidates for future focused component extraction if the current client-facing UI is stable.
- API calls are split between `src/api/products.ts`, `AuthContext`, and `UserManagement`. A small Stroane API client wrapper could reduce duplication later.
- Environment files are sensitive. Cleanup documentation must not copy secret values. If any live credential or auth secret has been exposed in chat, logs, or version control, rotate it outside this cleanup task.
- As the first paying client project, public polish regressions and auth/data regressions should be treated as release-sensitive.

Safe cleanup candidates:

- Documentation cleanup, README setup clarity, and environment variable descriptions without values.
- Component-level CSS review after screenshots.
- Static unused export checks.

High-risk cleanup candidates:

- Auth backend, user management, Prisma migrations/schema, CORS/proxy settings, customer data, order/payment-adjacent behavior, and production environment values.

### Faako Website

Risk level: Medium for public UI cleanup, High for signup/API integration and production environment behavior.

Findings:

- `Home.css`, `global.css`, `Solutions.css`, `Pricing.css`, `ModuleConfig.css`, `CaseStudies.css`, and `Auth.css` repeat button, card, section-header, CTA, form, and responsive layout patterns.
- `Home.jsx`, `Signup.jsx`, `Pricing.jsx`, `ModuleConfig.jsx`, and related page CSS are candidates for future page-section extraction.
- Signup behavior is coupled to the dedicated Faako API deployment. Cleanup must preserve that deployment topology.
- Public pricing/copy UI cleanup should include content review, not only code movement.

Safe cleanup candidates:

- Shared public-site button/card/section-header style inventory.
- Page-section extraction for purely presentational blocks after visual snapshots.
- Documentation of signup deployment modes.

High-risk cleanup candidates:

- Signup submission, API base URL handling, mirrored function sync, production environment values, and database-backed signup storage.

### Faako API

Risk level: High for database/runtime behavior, Low for documentation-only cleanup.

Findings:

- The API is small but deployment-sensitive because Faako Website may mirror its functions.
- `signup` and runtime configuration should remain source-of-truth until endpoint contracts are documented.
- Cleanup should focus first on endpoint docs, environment docs, and deploy topology rather than code movement.

Safe cleanup candidates:

- Endpoint contract docs and README alignment.
- Mirrored-function ownership documentation.

High-risk cleanup candidates:

- Database targeting, signup persistence, runtime config, production database guards, and hosted API deployment behavior.

### Faako ERP, System Starter, UI Workbench

Risk level: Low to Medium.

Findings:

- These apps are useful reference surfaces for shared UI, shell, registry, and theme behavior.
- `apps/faako-erp/src/styles/global.css` repeats panel, button, data-table, table-row, page-header, and status-pill patterns also present in Dev ERP and shared UI compatibility CSS.
- Demo/reference apps should not drive production app behavior, but they are good places to validate shared UI cleanup before applying it to REEBS or Dev ERP.

Safe cleanup candidates:

- Use these apps as visual regression/reference targets for shared UI cleanup.
- Consolidate demo-only style patterns after production apps are stable.

### REEBS Website

Risk level: Medium for public commerce/booking UI, High for any shared backend or order/booking behavior.

Findings:

- REEBS Website duplicates many components and styles with REEBS Portal: `admin.css`, `public.css`, `global.css`, Navbar, Footer, CartOverlay, PortalSidebar, booking/shop/checkout UI, and cart/SEO utilities.
- Runtime/generated scan results should not be treated as source refactor candidates.
- Public booking/checkout/rental flows overlap with REEBS Portal data concepts but should not be merged without a customer-facing workflow review.

Safe cleanup candidates:

- Shared visual primitives and public-site CSS token inventory.
- Component comparison with REEBS Portal before extracting shared public UI.

High-risk cleanup candidates:

- Checkout, booking, cart pricing, backend functions, public inventory availability, and order creation.

### Shared Packages

Risk level: Depends on package.

Findings:

- `packages/ui` and `packages/theme` are the correct destination for shared primitive styles and shell patterns, but `compat.css` already exists as a bridge for legacy classes. Future cleanup should reduce app-specific duplication gradually.
- `packages/config` is the correct destination for registry/module helper conventions. Do not use registry metadata as access enforcement.
- `packages/finance` is ready for display-only helper adoption, but payment writes, receipt numbering, balance persistence, and accounting side effects must stay app-owned.
- `packages/offline-sync` is ready for passive queue UI/status helpers, but real queue processing adapters must remain app-specific until server validation and permissions are thoroughly reviewed.
- `packages/notifications` is ready for customer-safe message templates and user-triggered share links. It must not send automated notifications yet.
- `packages/layout` currently appears to export shell class helpers without active app imports. Treat it as a candidate package usage review, not an immediate deletion target.
- `packages/core`, `packages/security`, `packages/logger`, and `packages/email-kit` are shared runtime/security infrastructure. Cleanup here should be test-backed and high caution.

## Duplicate Styling Findings

### Safe

- Build a style inventory for repeated primitives:
  - Buttons: `.button`, `.button-primary`, `.button-ghost`, `.btn`, `.btn-primary`, `.button-plain`.
  - Cards/panels: `.panel`, `.glass-card`, `.card`, `.admin-card`, module cards.
  - Tables: `.data-table`, `.table-row`, `.admin-table`, table index cells.
  - Status: `.status-pill`, badges, inline notices.
  - Forms: `.input`, select/date fields, field groups.
  - Modals: `.admin-modal`, `.modal-backdrop`, `.modal-card`.
  - Headers: `.page-header`, `.section-header`, panel headers.

### Medium Risk

- Move purely visual primitives into `packages/ui` or `packages/theme` only after screenshots of:
  - REEBS desktop sidebar and mobile bottom nav.
  - REEBS Store Mode, Orders, Bookings, Inventory, Finance, Settings, and Admin Workspace.
  - Dev ERP Dashboard, Rent, Accounting, Invoicing, Reports, Settings, User Control, and mobile navigation.
  - Stroane Home, Shop, Product Detail, User Management, and responsive header.
  - Faako Website Home, Pricing, Solutions, Signup, and Module Config.

### High Risk

- Removing app CSS without visual comparison.
- Changing table/modal styles around live payment, booking, inventory, or user-control workflows.
- Changing responsive shell CSS without role/mobile checks.

## Unused File Findings

These are candidates only. Do not delete without a static analysis pass, build verification, and manual route checks.

### Candidate Unused Or Legacy Files

- `apps/reebs-portal/src/components/SideNav/SideNav.jsx`: text search found definition/export but no current import in REEBS source.
- `apps/reebs-portal/src/components/PopupModal/PopupModal.jsx`: text search found definition/export but no current import in REEBS source.
- `apps/reebs-portal/src/components/AdminQuickActions/AdminQuickActions.jsx`: the component appears unused, but `src/utils/adminQuickActions.js` is still used by Admin Workspace and Settings.
- `packages/layout/src/index.ts`: package exports layout helpers, but no app import was found in the current scan. Confirm package intent before changing it.

### Generated Or Local Build Artifacts To Exclude From Cleanup Decisions

- `apps/*/dist`
- `apps/*/node_modules`
- generated runtime folders
- `apps/reebs-portal/prisma/generated`

If any of these are tracked, fix ignore/tracking policy in a separate safe cleanup task. Do not delete local runtime folders as part of feature cleanup.

## Long File Breakdown Candidates

### REEBS Portal

- `src/pages/Admin/Admin.jsx` (High risk): split into inventory data hooks, inventory table/components, stock adjustment modal, variant editor, edit-request review, queue status helpers, and inventory constants. Keep stock writes and offline sync paths app-owned.
- `src/pages/AdminInvoicing/AdminInvoicing.jsx` (High risk): split document list, document editor, invoice/receipt preview, email actions, PDF helpers, customer/order/booking source selectors, and formatting helpers. Do not change document persistence or email behavior.
- `src/pages/AdminWorkspace/AdminWorkspace.jsx` (Medium/High risk): split dashboard data loaders, KPI cards, workflow panels, Sync Review section, global search, and module-link utilities. Keep auth/role and queue behavior unchanged.
- `src/pages/AdminAccounting/AdminAccounting.jsx` (High risk): split chart of accounts, journal editor, import history, trial balance, report panels, and display helpers. Do not change accounting calculations or API payloads.
- `src/pages/AdminBookings/AdminBookings.jsx` (High risk): split booking loaders, queue adapter usage, booking list/table, editor modal state, status actions, customer/item selectors, and booking notices. Do not alter booking creation/update/status or availability logic.
- `src/pages/AdminWater/AdminWater.jsx` (Medium/High risk): split ledgers, order editor, restock, KPI, customer picker, and formatting helpers. Water payments and stock behavior should remain unchanged.
- `src/pages/StoreMode/StoreMode.jsx` and `components/StoreModeLayout.jsx` (High risk): split display-only cart panels and notices first. Keep POS order creation, offline queue sync, payment method handling, and draft clearing unchanged.
- `src/components/PortalSidebar/PortalSidebar.jsx` (Medium risk): split notification fetching, module rendering, app switcher, profile menu, and sidebar chrome. Keep route links and role behavior intact.
- CSS: split `admin.css`, `public.css`, `StoreMode.css`, `AdminWorkspace.css`, `AdminInvoicing.css`, and `AdminBookings.css` by feature only after visual snapshots.

### Dev ERP

- `backend/server.js` (High risk): create a route map first, then split by auth/session, access/capabilities, rent, organizations, accounting, invoices, reports, bookings, settings/alerts, productivity/AI, integrations, and public routes. Add endpoint-level smoke tests before moving code.
- `src/pages/Dashboard/Dashboard.jsx` (Medium/High risk): split dashboard data hooks, booking panels, accounting panels, productivity widgets, weather/holiday panels, and display helpers.
- `src/pages/Rent/Rent.jsx` (High risk): split rent dashboard, payment form, queue sync adapter, tenant list, status helpers, and display helpers. Do not change rent payment writes or balances.
- `src/pages/Invoicing/Invoicing.jsx` (High risk): split invoice editor, list/detail panels, send/quotation actions, line-item helpers, and display helpers. Preserve invoice state and public token behavior.
- `src/pages/Accounting/Accounting.jsx` (High risk): split accounting entry list, entry editor, posting actions, import/report display, and helpers.
- `src/pages/UserControl/UserControl.jsx` (High risk): split role/capability editor components without changing backend permissions.
- `src/index.css` (Medium risk): split global shell primitives from page-specific legacy styles only after screenshots.

### Stroane Web

- `src/pages/Shop.tsx` (Medium risk): split filters, product grid, product card, status/empty states, and sorting helpers.
- `src/pages/UserManagement.tsx` (High risk): split user table, create/edit modal, auth checks, and API calls carefully. Preserve auth and backend behavior.
- `src/components/FloatingHeader.tsx` and `src/components/Header.tsx` (Medium risk): consolidate header state and responsive variants only after visual checks.
- CSS: review `Header.css`, `globals.css`, `Shop.css`, `Home.css`, `About.css`, and `Services.css` for shared card/button/page patterns.

### Faako Website

- `src/pages/Signup.jsx` (High risk): split form sections, validation display, plan/module selection, submission adapter, and success/error states. Preserve API behavior.
- `src/pages/Home.jsx` and `src/styles/pages/Home.css` (Medium risk): split page sections and CSS bands.
- `src/pages/Pricing.jsx`, `src/pages/ModuleConfig.jsx`, and associated CSS (Medium risk): extract pricing cards, estimator, add-on lists, and CTA sections.
- `src/styles/global.css`, `header.css`, and `footer.css` (Medium risk): align public primitives with shared UI styles.

### Shared Packages

- `packages/ui/src/components/Fields.tsx` (Medium risk): already sizable. Split date/select/search primitives only if exports stay stable.
- `packages/ui/src/ui.css` and `packages/ui/src/compat.css` (Medium risk): document which app selectors are compatibility bridges before removing any legacy CSS.
- `packages/offline-sync` (High risk if processing changes): keep components/hooks pure and presentation-focused; queue processing must remain app-owned.
- `packages/finance` (High risk if persistence changes): keep helpers pure; do not move payment or receipt write behavior yet.

## Duplicate Helper Findings

### Currency Formatting

Risk: Safe for display-only adoption, High for persisted amounts and payment calculations.

Repeated in REEBS Admin, Accounting, Bookings, Documents, Invoicing, Marketing, Rentals, Scheduler, Store Mode, Customers, Directory, Water, Orders UI, Dev ERP Dashboard/Rent/Accounting/Invoicing/InvoiceView/invoice PDF, Stroane Shop, and Faako Website pricing/config pages.

Recommended cleanup:

- Use `@faako/finance` for display-only currency helpers where no persistence/calculation behavior changes.
- Keep app-specific helper wrappers where locale/product language differs.
- Do not replace calculation, persistence, receipt, stock, or rent balance logic in the same pass.

### Date And Time Formatting

Risk: Safe to medium.

Repeated across most admin pages. Differences include `en-GB`, `en-US`, local timezone behavior, UTC month labels, and public invoice formatting.

Recommended cleanup:

- Create app-level display date helper modules first.
- Consider shared date display helpers later only after timezone expectations are documented.

### Status Labels

Risk: Safe for display labels, High if coupled to workflow states.

Repeated for order statuses, booking statuses, rent statuses, invoice statuses, payment statuses, offline queue states, module statuses, and audit/action labels.

Recommended cleanup:

- Move display-only label maps to app-local constants or shared packages by domain.
- Do not collapse workflow state machines during cleanup.

### Payment Methods And Receipt Formatting

Risk: High.

`@faako/finance` has normalized constants and presentation helpers, but REEBS and Dev ERP still own live payment, receipt, invoice, order, and rent behavior.

Recommended cleanup:

- Adopt shared constants only for display where proven safe.
- Keep receipt numbering, payment writes, balance updates, and accounting side effects unchanged.

### API Calls

Risk: Medium to High.

Dev ERP has a shared API client for authenticated routes. REEBS Portal still uses many direct API handler `fetch` calls. Stroane has product/auth/user fetch paths. Faako Website has signup fetch behavior.

Recommended cleanup:

- Document endpoint maps first.
- Add small app-owned request helpers for repeated error parsing only after tests.
- Do not force a shared API client across apps until auth/session/public-route differences are mapped.

### Auth And Role Helpers

Risk: High.

REEBS and Dev ERP have different role/capability models. Shared helper cleanup must not blur frontend grouping with backend enforcement.

Recommended cleanup:

- Keep role normalization app-owned until a formal access-control contract exists.
- Avoid moving backend permission checks into frontend packages.

## Module Overlap Findings

### REEBS Portal

- Finance/accounting/expenses/invoicing/vendors/documents overlap is documented. Keep grouping metadata separate from payment/receipt/invoice behavior.
- Customers/CRM/directory overlap remains product-language sensitive.
- Bookings/rentals/schedule overlap is grouped visually but not logically consolidated.
- Settings/admin/advanced/website-template/inventory settings overlap remains configuration-focused.
- Team/users/employees/hr/roles/timesheets overlap is grouped visually but not permission-consolidated.

### Dev ERP

- Rent/payments/accounting/invoicing/reports overlap is live-data sensitive and should remain pending for deeper consolidation.
- Organizations/customers/user-control/profile are related but have different permissions and user expectations.
- Bookings/Appointments are rent-adjacent today; do not create a separate Bookings model without workflow review.
- Settings/system-health/audit logs/reporting should remain as currently documented until capability review.

## Shared Package Opportunities

### packages/ui

Good future targets:

- Buttons, icon buttons, primitive cards/panels, empty/loading/error states, status pills, table shells, modal shells, form fields, search fields, page headers, and app bottom bars.

Avoid for now:

- Business-specific modals, payment forms, booking editors, stock editors, auth-sensitive controls, and workflow-specific action menus.

### packages/theme

Good future targets:

- CSS variables, spacing, typography, radius, shadows, focus rings, app shell layout tokens, and compatibility shims.

Avoid for now:

- Removing existing app CSS before screenshots and route checks.

### packages/config

Good future targets:

- Registry conventions, module grouping metadata, visibility state helpers, and shell placeholders.

Avoid for now:

- Any registry-driven access enforcement.

### packages/finance

Good future targets:

- Currency formatting, amount conversion, display-safe status labels, payment method labels, receipt display text, and pure metadata normalization.

Avoid for now:

- Payment writes, receipt numbering, invoice generation, order/rent balance persistence, accounting journal behavior, and gateway reconciliation.

### packages/offline-sync

Good future targets:

- Queue summaries, local queue display, retry/cancel/resolve UI, safe metadata formatting, local draft helpers, and passive online status.

Avoid for now:

- Cross-app automatic sync adapters, server writes, conflict auto-resolution, offline receipt generation, offline stock mutation, or auth refresh changes.

### packages/notifications

Good future targets:

- Customer-safe templates, channel labels, user-triggered `mailto:` and WhatsApp draft links, and safe text formatting.

Avoid for now:

- Automated email/WhatsApp/SMS sending, notification persistence, audit logs, provider retries, or customer preference enforcement.

### packages/auth or packages/core later

Good future targets:

- Shared auth storage conventions, token parsing utilities, organization context conventions, and safe frontend helpers.

Avoid for now:

- Shared permission enforcement until each live app's backend capability model is documented.

## Safe Cleanup Candidates

- Add cleanup conventions and route/module ownership notes to docs.
- Add or update README sections for existing shared package boundaries.
- Create an endpoint map for REEBS API handlers and Dev ERP Express routes.
- Confirm candidate-unused files with static analysis and imports search.
- Add visual snapshot checklist before CSS cleanup.
- Consolidate display-only currency/date/status helpers behind app-level wrappers.
- Add tests for pure helper changes before adopting shared helpers.
- Inventory generated/runtime folders and confirm ignore/tracking policy.
- Split purely presentational components from long pages without changing props, side effects, or APIs.

## Risky Cleanup Candidates

### Medium Risk

- Extracting shared CSS primitives from app styles.
- Splitting long React pages where state and side effects stay in the parent.
- Replacing display-only formatting helpers with shared helpers.
- Consolidating app-owned API error parsing.
- Removing candidate-unused components after static analysis.

### High Risk

- Payment logic.
- Receipt generation or receipt numbering.
- Invoice persistence or public invoice token behavior.
- Order creation, POS sale creation, or order balance calculations.
- Rent payment recording, rent balances, and Dev ERP operational records.
- Inventory stock updates, variant stock, reservation/deduction timing, and audit records.
- Booking creation/edit/status updates and availability checks.
- Offline queue processing, sync retries, and conflict handling.
- Auth/session/capability/role/permission logic.
- Database schema, migrations, seed scripts, production import scripts, and data relinking.
- Email, WhatsApp, SMS, notification automation, and AI/productivity endpoints.

## Recommended Implementation Order

1. Documentation and README cleanup.
   - Add cleanup conventions, generated-folder exclusions, and app ownership notes.
   - No runtime code changes.

2. Unused export/import audit.
   - Run static analysis and confirm candidates with `rg`.
   - Remove only confirmed-dead files in separate PRs/tasks with app builds.

3. Duplicate CSS audit.
   - Inventory repeated selectors and tokens.
   - Capture screenshots before any CSS movement.
   - Start with reference apps before REEBS or Dev ERP.

4. Shared UI style consolidation.
   - Move primitive visual styles only.
   - Preserve app-specific class names through compatibility shims during migration.

5. Display-only helper consolidation.
   - Currency, dates, status labels, and safe notification text first.
   - Keep persistence/calculation paths unchanged.

6. Long file extraction.
   - Split one file at a time.
   - Start with presentational components and pure hooks.
   - Keep data writes and side effects in place until tested.

7. Module-specific refactors.
   - Follow existing consolidation plans.
   - Start with low-risk navigation/display work.
   - Keep routes, permissions, and backend behavior unchanged.

8. High-risk logic cleanup last.
   - Payments, receipts, orders, bookings, rent, inventory, auth, schema, offline sync, notification sending, and backend route splitting need dedicated test plans and rollback plans.

## Safe Cleanup Wave 1 Results

Date: 2026-05-12

Completed low-risk cleanup:

- REEBS Portal: removed confirmed unused icon imports in sidebar/navigation code.
- REEBS Portal: removed obsolete `no-unused-vars` eslint-disable comments from Orders List and Store Mode.
- REEBS Portal: replaced a catalog media control-character regex with an equivalent helper to avoid source lint errors while preserving URL safety intent.
- REEBS Portal: excluded generated Prisma output from ESLint scans so generated/runtime files do not dominate cleanup signals.
- Dev ERP: removed an unused Dashboard catch binding.
- Dev ERP: stabilized the Settings Sync Review refresh callback dependency used by local retry/cancel/resolve controls.

Intentionally not changed:

- REEBS hook dependency and Fast Refresh warnings remain parked because they touch auth/session, cart/currency contexts, Store Mode callbacks, Admin Workspace queue access, and receipt rendering behavior.
- REEBS candidate legacy components such as `SideNav`, `PopupModal`, and `AdminQuickActions` were not deleted. They need a dedicated static-analysis/delete pass.
- No CSS selectors or files were removed because visual snapshots were not part of this wave.
- Stroane lint remains blocked by the missing `typescript-eslint` package in its lint config. TypeScript checking was also blocked by existing shared `@faako/ui` type errors outside this cleanup scope.
- No shared helper adoption was forced where it could affect payment, receipt, booking, inventory, auth, or offline sync behavior.

Verification:

- `pnpm --filter @faako/dev-erp run lint`
- `pnpm --filter @faako/reebs-portal exec eslint src`
- `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` was attempted and failed on existing shared `@faako/ui` type errors.

## Manual Verification Checklist

Before any cleanup implementation:

- Confirm the task is documentation-only, display-only, or behavior-affecting.
- Confirm affected app ownership and production sensitivity.
- Confirm no database schema or migration changes are included unless explicitly scoped.
- Confirm no route removals, route renames, or permission behavior changes are included.
- Confirm no live environment values or secrets are copied into docs, tests, logs, or README examples.

For CSS cleanup:

- Capture desktop and mobile screenshots before and after.
- Check REEBS sidebar, bottom nav, Store Mode, Orders, Bookings, Inventory, Finance, Settings, and Admin Workspace.
- Check Dev ERP Dashboard, Rent, Accounting, Invoicing, Reports, Settings, User Control, and mobile navigation.
- Check Stroane Home, Shop, Product Detail, User Management, and header/menu states.
- Check Faako Website Home, Pricing, Solutions, Signup, Module Config, and mobile header.

For helper cleanup:

- Add unit tests for pure helpers.
- Verify display labels and formatting match current screenshots.
- Confirm saved payloads and API request bodies are unchanged.

For long-file extraction:

- Build the affected app.
- Run relevant tests.
- Spot-check routes touched by the file.
- Confirm browser console has no new errors.
- Confirm existing online workflows still work.

For production-sensitive areas:

- REEBS: test auth, roles, POS, orders, payments, receipts, bookings, inventory, offline queue visibility, and reports.
- Dev ERP: test auth/session, capabilities, rent, rent payments, accounting, invoices, reports, public invoice view, public booking, settings, and sync review.
- Confirm rollback is a revert of the cleanup change, not a data operation.

## Next Step

Start with a documentation/README cleanup pass and a static unused export/import report. Do not implement file deletion, CSS removal, module refactors, backend route splitting, or shared logic extraction until the relevant app owner, risk level, test plan, and rollback plan are explicit.
