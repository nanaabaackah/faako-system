# REEBS Portal Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for REEBS Portal without changing application behavior.

## Known technical notes

- The app includes a React admin portal, Netlify Functions backend, Prisma schema/migrations, and deeper local app docs under `apps/reebs-portal/docs`.
- Role assignment includes Owner, Admin, Manager, Staff, Warehouse, Driver, and Water, with legacy values normalized to Staff.
- Inventory compatibility still depends on legacy source category and specific category relationships.
- Variant-aware order, booking, scheduling, and invoicing flows should preserve `variantId` and `variantLabel`.
- Secrets must stay out of `VITE_*` values.
- `src/config/adminModules.js` defines the REEBS admin module registry for home, POS, orders, bookings, inventory, customers, delivery, finance, reports, team, settings, and detailed child navigation entries.
- `src/config/adminNavigation.js` adapts the registry into the current sidebar and bottom navigation without changing route guards, backend access, or data behavior.
- Registry metadata includes group, status, visibility, and state fields for future grouped rendering and module exposure controls, plus child modules for current detailed routes that should not be consolidated yet.
- Hidden modules are filtered out of sidebar and bottom navigation. Disabled, internal, coming-soon, and experimental metadata is currently visual only and does not block routes, redirect users, or change backend access.
- The admin route shell uses shared ERP shell/page-content/status-badge wrappers from `@faako/ui`, but REEBS-specific sidebar behavior, bottom navigation, search, notifications, auth, pages, and workflows remain app-owned.
- Shared shell placeholders for offline/sync/notifications/org switching are available structurally only. REEBS production behavior should stay app-owned until backend-owned shell metadata exists.
- Team navigation is the first consolidation implemented: `/admin/users`, `/admin/employees`, `/admin/directory`, `/admin/hr`, `/admin/roles`, and `/admin/timesheets` now resolve visually through the Team sidebar module while all routes remain intact.
- Settings navigation consolidation is implemented in registry metadata: `/admin/settings`, `/admin/advanced`, `/admin/website-template`, `/admin/inventory/products`, and `/admin/inventory/templates` resolve visually through the Settings module while existing routes and redirect targets remain intact.
- Bookings navigation consolidation is implemented in registry metadata: `/admin/bookings`, `/admin/rentals`, and `/admin/schedule` resolve visually through the Bookings module while existing routes, page logic, booking workflows, rental workflows, schedule workflows, stock behavior, payments, and receipts remain intact.
- Finance consolidation is planning-only in `finance-consolidation-plan.md`. The plan covers order payments, order receipts, invoice documents, expenses, accounting journals, reports, POS/order touchpoints, data dependencies, and security risks before any Finance grouping implementation happens.
- Finance navigation grouping is implemented in registry metadata: `/admin/accounting`, `/admin/expenses`, and `/admin/invoicing` resolve visually through the Finance module while payment recording, receipt generation, invoice generation, POS logic, order balance calculations, accounting behavior, APIs, permissions, and routes remain unchanged.
- `order-payment-receipt-workflow-review.md` maps REEBS order origins, POS payment flow, booking-linked orders, order payment ledger behavior, order receipt generation, invoice document flow, balance calculations, stock commitment timing, duplicated receipt/invoice concepts, and future shared package extraction order.
- Order payment receipts and invoice document receipts are separate source-of-truth concepts today. Do not merge them without a documented receipt ownership decision and migration/audit plan.
- `docs/platform/shared-payment-receipt-architecture.md` defines the planning-only target architecture for future shared payment, receipt, finance, and audit packages. REEBS-specific POS, booking, rental, party-item, delivery/setup, stock, and receipt-source boundaries remain app-owned until separate implementation work.
- `@faako/finance` now provides shared payment/receipt constants, pure display helpers, normalization helpers, display-safe balance helpers, metadata helpers, and receipt presentation helpers. REEBS consumes it only in order UI currency/payment-label display helpers; current payment strings used for saves, receipt generation, stock side effects, and order balance logic remain app-owned.
- `@faako/offline-sync` now provides shared offline constants, queue storage helpers, local draft helpers, retry metadata helpers, online/offline hooks, and passive status UI. REEBS consumes it for the admin shell online/offline indicator and draft-only Store Mode/manual payment recovery; no REEBS business action is queued or synced.
- Store Mode POS drafts are browser-local only. They preserve cart lines, minimal selected customer draft data, customer contact, payment method/reference, discount, and cash received for refresh recovery, then clear after successful online sale or cancellation.
- Manual payment drafts are browser-local only. Order detail and orders board payment forms preserve unsent amount/method/provider/reference/phone/notes fields and clear after successful online payment recording or cancellation.

## Open questions

- Which private-beta workflows should be considered launch-blocking before each deploy?
- What is the canonical rollback plan for failed migrations or production data relinking?
- Which admin modules are stable enough to graduate from private-beta monitoring?
- Which module visibility rules should become registry metadata before any database-backed enable/disable work starts?
- Which REEBS modules should become app-specific consolidated modules before module toggles are exposed to admins or orgs?
- Which REEBS shell controls should eventually move into shared wrappers without losing app-specific search, notifications, or role behavior?
- Should Team eventually become a deeper workspace with tabs for Directory, HR, Roles, and Timesheets, or remain a grouped navigation entry?
- Should inventory product/template admin configuration eventually become Settings tabs, Inventory child tabs, or a dedicated configuration surface?
- Should Bookings eventually become a deeper workspace with a shared booking calendar, linked order/payment flow, rental return workflow, and delivery/setup schedule?
- Should future Finance grouping show POS/orders as cross-links, child items, or keep them as separate operational modules with Finance summaries only?
- Should Vendors/Documents join the visible Finance grouping in a later pass, or remain standalone privileged modules until document/vendor workflows are reviewed?
- Which receipt source of truth should own future shared receipt numbering and delivery: `OrderReceipt`, invoice documents with `documentType: receipt`, or a new platform receipt model?
- Should payment provider confirmation become a separate state machine before any shared payment ledger extraction?
- Which REEBS payment/receipt constants can be safely shared first without implying shared persistence, gateway behavior, or receipt numbering?

## Future cleanup

- Continue consolidating shared portal shell and form behavior across ERP-style apps.
- Keep old inventory compatibility paths documented until they can be safely retired.
- Expand operational runbooks for incidents involving orders, payments, inventory, bookings, and delivery.
- Review the registry against the full current admin route list before using it for access checks or consolidated modules.
- Connect database-backed module toggles, org-level module config, permissions integration, and SaaS plan gating only after route and backend access reviews are complete.
- Revisit shared shell adoption after app-specific module consolidation, but avoid moving complex REEBS business UI into shared packages prematurely.
- Keep the Team registry match paths aligned with any future staff/user route additions.
- Add a module enable/disable settings surface only after backend-owned module config, org-level controls, permissions integration, and audit expectations are defined.
- Keep Bookings route grouping metadata separate from booking creation/editing, payment recording, receipt generation, inventory reservation/deduction, rental return, and delivery/setup logic until those workflows are reviewed independently.
- Use the Finance consolidation plan before any Finance registry change; preserve `recordOrderPayment`, `OrderReceipt`, invoice-document behavior, balance calculations, POS/order routes, and accounting functions until separately reviewed.
- Keep deeper Finance consolidation separate from the current grouping. Orders payment ledger, POS payment flow, receipts, invoice documents, vendor/documents workflows, and financial reports need a separate shared workflow review.
- Use `order-payment-receipt-workflow-review.md` before creating payment/receipt/order runtime packages or expanding `@faako/finance` beyond constants, helpers, and presentation utilities. Start with read-only contracts/adapters and fixtures before moving write paths.
- Use `docs/platform/shared-payment-receipt-architecture.md` before adding shared payment/receipt constants and types. Keep the first implementation limited to constants/types and non-mutating helpers.
- Keep REEBS adoption of `@faako/finance` limited to display helpers until app-specific fixtures prove that POS/order/receipt persistence, stock timing, and balance behavior remain unchanged.
- Keep REEBS offline adoption limited to passive indicators and draft-only POS/payment form recovery until queued POS order creation, payment sync, booking, inventory, delivery, auth refresh, server validation, idempotency, conflict handling, and audit requirements are designed and tested.

## Risks to monitor

- Permission drift between frontend navigation and backend enforcement.
- Receipt, invoice, accounting, and revenue-recognition regressions.
- Inventory and variant mismatches that affect bookings, orders, or fulfillment.
- Production data changes from migrations, imports, relinks, and seed scripts.
- Future registry wiring into access checks, route guards, database-backed toggles, org-level config, or SaaS plan gating could affect authenticated navigation and must be reviewed separately.
- Shared shell wrapper changes can affect private-beta navigation density, topbar spacing, or mobile bottom-nav ergonomics even when data behavior is unchanged.
- Future deeper Team consolidation could accidentally blur standard versus privileged team workflows if frontend grouping is mistaken for permission enforcement.
- Settings grouping could confuse owner/admin users who expect inventory product/template admin routes under Inventory; monitor navigation feedback before any deeper page consolidation.
- Bookings grouping could confuse users who expect Rentals under Inventory or Schedule as a separate admin item; monitor navigation feedback before any shared calendar or rental workflow consolidation.
- Finance consolidation could cause payment/receipt/source-of-truth drift if order payments, invoice-document receipts, reports, and accounting journals are grouped before their ownership boundaries are explicit.
- Finance grouping can make Expenses/Invoicing less direct in the flat sidebar; monitor private-beta feedback before adding a deeper Finance workspace or child navigation.
- Shared payment or receipt extraction could create duplicate payments, stale receipts, receipt-number drift, stock/payment mismatches, or accounting journal regressions if order payment side effects are moved before idempotency and audit behavior are defined.
- Shared architecture work could be mistaken for shared runtime behavior; keep REEBS payment writes, receipt numbering, stock commitment, and invoice document behavior unchanged until app-specific adapters are proven.
- Offline queue constants and local draft helpers could be mistaken for enabled offline workflows. REEBS must not queue POS orders, payments, bookings, inventory changes, delivery updates, or customer writes until server-side permission rechecks and conflict handling exist.
- Local drafts can contain customer contact or payment reference text entered by staff. Keep the stored payload minimal, scoped by app/org/user/order where possible, and clear drafts after successful online submission.
