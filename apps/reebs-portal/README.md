# Reebs Portal

Workspace package: `@faako/reebs-portal`

Reebs Portal is the admin portal and API backend source for REEBS. It owns the operational frontend, Prisma-backed backend handlers, product and variant management, bookings, invoicing, delivery, accounting, website content, and the internal modules used by the REEBS stack.

## What Lives Here

- `src/`: React admin portal frontend
- `backend/server.js`: Express API wrapper for `api.reebspartythemes.com`
- `netlify/functions/`: legacy function handler source adapted by the API wrapper
- `prisma/`: Prisma schema, migrations, and generated client output
- `docs/`: deeper frontend and backend notes
- `.env.example`: runtime configuration reference

## Run It Locally

Frontend only:

```bash
pnpm --filter @faako/reebs-portal run dev:frontend
```

Backend/API only:

```bash
pnpm --filter @faako/reebs-portal run dev:backend
```

Full local REEBS stack from the repo root:

```bash
pnpm run dev:reebs
```

Typical local ports:

- portal frontend: `5174`
- API backend: `8888`

## Common Commands

```bash
pnpm --filter @faako/reebs-portal run build
pnpm --filter @faako/reebs-portal run dev:backend
pnpm --filter @faako/reebs-portal run server:prod
pnpm --filter @faako/reebs-portal run db:generate
pnpm --filter @faako/reebs-portal run db:migrate:dev
pnpm --filter @faako/reebs-portal run db:deploy:dev
pnpm --filter @faako/reebs-portal run db:status:dev
pnpm --filter @faako/reebs-portal run source-categories:seed
pnpm --filter @faako/reebs-portal run source-categories:relink:dry
pnpm --filter @faako/reebs-portal run source-categories:relink:apply
pnpm --filter @faako/reebs-portal run test:e2e
```

## Current Shared Shell

- the portal follows the current shared shell system used across the repo
- sidebar width, collapse behavior, edge toggle placement, shared modal spacing, and mobile-safe bottom-nav padding should stay aligned with the other ERP apps
- the admin app frame now uses shared ERP shell/page-content wrappers from `@faako/ui` while keeping REEBS-specific sidebar, bottom navigation, branding, pages, routes, and workflows in the app
- shared form styling and the `@faako/ui` ERP form/modal/action foundations should be preferred for future low-risk settings/profile/filter and read-only detail work, but REEBS POS, payments, receipts, bookings, inventory stock, offline queue, auth/session-sensitive, and other workflow-heavy forms/modals/actions remain app-owned until separately reviewed
- `src/config/adminModules.js` contains the REEBS admin module registry for home, POS, orders, bookings, inventory, customers, delivery, finance, reports, team, settings, and detailed child navigation entries.
- `src/config/adminNavigation.js` adapts that registry into the existing sidebar and bottom navigation, preserving current labels, links, role filtering, driver/water behavior, and legacy route targets.
- Module registry entries now carry `visibility` and `state` metadata. Hidden modules are ignored by navigation; disabled, internal, coming-soon, and experimental modules can render subtle visual badges/classes while preserving routes and existing page behavior.
- Module consolidation planning is documented in [docs/apps/reebs-portal/module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/module-consolidation-plan.md). It is planning-only and does not change routes, auth, schema, redirects, or workflows.
- Team navigation consolidation is the first implemented consolidation step: users, employees, directory, HR, roles, and timesheets now appear under the Team module while existing routes remain valid.
- Settings navigation consolidation groups settings, advanced, website template, inventory product admin, and inventory template admin routes under the Settings module in registry metadata while existing routes and redirects remain valid.
- Bookings navigation consolidation groups bookings, rentals, and schedule routes under the Bookings module in registry metadata while existing routes, booking workflows, rental workflows, schedule workflows, stock behavior, payments, and receipts remain unchanged.
- Finance consolidation planning is documented in [docs/apps/reebs-portal/finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/finance-consolidation-plan.md). It is planning-only and does not change payment recording, receipt generation, invoices, order/POS behavior, accounting logic, routes, APIs, migrations, or permissions.
- Finance navigation grouping now places accounting, expenses, and invoicing under the Finance module in registry metadata while keeping payment recording, receipt generation, invoice generation, POS/order behavior, accounting logic, routes, APIs, and permissions unchanged.
- Orders, payments, receipts, invoice documents, POS payments, booking-linked orders, balance calculations, and stock/payment side effects are mapped in [docs/apps/reebs-portal/order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/order-payment-receipt-workflow-review.md). This review is documentation-only and should be used before any shared payment/receipt/order runtime package work or before expanding `@faako/finance` beyond constants, helpers, and presentation utilities.
- `@faako/finance` is used only for REEBS order UI currency/payment-label presentation. It does not change order persistence, payment writes, receipt creation, invoice behavior, stock/payment timing, backend APIs, permissions, or database schema.
- `@faako/notifications` is used only for customer-safe receipt share drafts in the order receipt preview. Copy summary, email draft, and WhatsApp draft actions are user-triggered display/share helpers; they do not send automated messages, change backend receipt delivery, change Resend/email behavior, persist notification data, or alter order/payment/receipt workflows.
- `@faako/offline-sync` is used for the REEBS admin shell online/offline indicator, local draft storage for Store Mode POS carts and unsent manual order payment forms, queued Store Mode POS order creation, queued manual order payment recording, queued inventory stock adjustments, and queued booking create/edit/status actions when the browser is offline. Queued POS orders, manual payments, inventory adjustments, and booking actions are user/org scoped where possible and submit to existing online endpoints when connectivity returns; the server still owns auth, permissions, stock validation, booking availability validation, rental/variant checks, payment persistence, receipt creation, accounting effects, balances, reservations, and final status.
- The Admin Workspace Offline Sync view includes the shared `SyncReviewPanel` from `@faako/offline-sync`. Use it to review local POS, payment, inventory, and booking queue counts, retry failed/needs-review items by re-arming them for existing sync handlers, cancel local queue items, or mark locally reviewed items resolved. The panel intentionally shows summary metadata and last errors only, not raw queue payloads. No environment variables, setup steps, migrations, route changes, permission changes, or server workflow changes are required.
- Offline inventory adjustment queue support lives in `src/pages/Admin/offlineInventoryAdjustmentQueue.js` and is wired from `src/pages/Admin/Admin.jsx`. Use it by opening Inventory, choosing Adjust stock, and submitting while offline; the adjustment stays local as pending sync until the stock API endpoint accepts it online. No environment variables, setup steps, migrations, schema changes, or route changes are required.
- Offline booking queue support lives in `src/pages/AdminBookings/offlineBookingQueue.js` and is wired from `src/pages/AdminBookings/AdminBookings.jsx`. Use it by opening Bookings and creating, editing, or changing status while offline; the action stays local as pending sync until the bookings API endpoint accepts it online. No environment variables, setup steps, migrations, schema changes, route changes, payment changes, receipt changes, or inventory-reservation logic changes are required.
- The registry uses shared helpers from `@faako/config`; it has no required environment variables, setup steps, migrations, database impact, billing behavior, SaaS plan gating, or access-control enforcement changes.
- Known limitation: the registry now drives navigation metadata, but route guards and backend permissions remain manual and unchanged. Database-backed module toggles, org-level module config, permissions integration, SaaS plan gating, and visual grouped navigation remain future work.
- Known limitation: shell placeholder support for offline/sync/notifications/org switching is structural only; REEBS production notification/search behavior remains app-owned.
- Known limitation: offline POS support queues order creation, manual payment support queues order payment recording, inventory support queues stock adjustments, and Bookings support queues booking create/edit/status actions only. These flows do not create final receipt numbers offline, permanently deduct or reserve stock before server sync, update balances offline, bypass backend validation, or change successful online POS/payment/inventory/booking behavior. Offline booking creation currently requires an existing selected customer; creating a new customer still needs a connection. The Sync Review panel is visibility/recovery tooling; retry still relies on the existing app sync paths and server validation.
- Known limitation: order payment receipts and invoice document receipts remain separate concepts; payment provider confirmation, refund handling, and receipt delivery should be reviewed before shared extraction.
- Testing notes: verify sidebar and bottom-nav link sets, hidden-module filtering in registry adapters, disabled-module visual state, Finance ownership for `/admin/accounting`, `/admin/expenses`, and `/admin/invoicing`, Bookings ownership for `/admin/rentals` and `/admin/schedule`, Settings ownership for `/admin/advanced`, `/admin/website-template`, `/admin/inventory/products`, and `/admin/inventory/templates`, REEBS order currency display and payment method labels, receipt share draft copy/mailto/WhatsApp text, online/offline indicator visibility, Admin Workspace Offline Sync review counts/retry/cancel/mark-resolved controls, Store Mode local draft save/restore/clear behavior, queued offline POS save/sync/needs-review behavior, manual payment draft restore/clear behavior, queued offline manual payment save/sync/needs-review behavior, queued offline inventory adjustment save/sync/needs-review behavior, queued offline booking create/edit/status save/sync/needs-review behavior, unchanged online booking creation/editing/status behavior, driver/customer behavior, water access, shell frame spacing, and legacy targets such as `/admin/customers` before future registry wiring.

## Current Access Model

Role assignment currently uses these primary roles:

- `Owner`
- `Admin`
- `Manager`
- `Staff`
- `Warehouse`
- `Driver`
- `Water`

Current route and navigation behavior:

- `Owner`, `Admin`, and `Manager` can access the standard portal modules plus the privileged admin modules
- `Owner` and `Admin` also keep the inventory product and template admin routes
- `Staff` and `Warehouse` stay in the standard operations modules
- `Driver` is intentionally narrow and should only see the dashboard, bookings, delivery, and customer-directory related flows
- `Water` keeps dashboard/profile access plus the water module
- legacy `viewer`, `custodian`, and `sales` values are normalized to `staff`

Current module groups:

- standard operations: Store Mode, Inventory, Purchases, Offline, Orders, New Order, CRM, Users, Employees, Directory, Maintenance, Timesheets, Rentals under Bookings
- privileged admin: Bookings, Schedule under Bookings, Finance with Accounting/Expenses/Invoicing, Vendors, Delivery, Documents, Settings, HR, Roles, Marketing, Advanced, Website Template
- owner/admin inventory admin: Inventory Products, Inventory Templates
- water access: Water

## Products And Variants

- inventory still maps through the legacy `sourceCategory` and `specificCategory` tables for compatibility with existing REEBS data
- variant parents use `itemType = VARIANT_PARENT`, with child rows stored in `inventoryVariant`
- orders, bookings, scheduling, and invoicing should preserve `variantId` and `variantLabel` instead of collapsing everything to the parent product
- the product modal only shows the variant creation section when the item type is a variant parent

To relink Toys-era source categories safely, review first:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:dry
```

Then apply only after confirming the matches:

```bash
pnpm --filter @faako/reebs-portal run source-categories:relink:apply
```

## Auth And Security

- failed login attempts are lockout-protected
- manager login uses additional rate limiting
- backend functions log through `@faako/logger`
- keep secrets out of any `VITE_*` values

## Relationship To Reebs Website

- `apps/reebs-website` is the public customer-facing site
- `apps/reebs-portal` owns the admin experience and backend
- full local REEBS development normally runs both together through `pnpm run dev:reebs`

## Deployment

Cloudflare Pages builds the portal frontend with:

```bash
pnpm --filter @faako/reebs-portal run build
```

Use these Cloudflare Pages settings:

- Build command: `pnpm --filter @faako/reebs-portal build`
- Output directory: `apps/reebs-portal/dist`
- Environment variable: `VITE_API_BASE_URL=https://api.reebspartythemes.com`

The API service should run the Express adapter from the monorepo root:

- Build command: `pnpm --filter @faako/reebs-portal run db:generate`
- Start command: `pnpm --filter @faako/reebs-portal run server:with-migrate`
- Public API base: `https://api.reebspartythemes.com`
- If Railway/Postgres returns `SELF_SIGNED_CERT_IN_CHAIN`, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` on the API service or provide `DATABASE_SSL_CA`.

## More Detail

- [docs/FRONTEND.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/docs/FRONTEND.md)
- [docs/BACKEND.md](/Users/Nana/Desktop/Developer/faako-system/apps/reebs-portal/docs/BACKEND.md)
- [module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/module-consolidation-plan.md)
- [finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/finance-consolidation-plan.md)
- [order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/reebs-portal/order-payment-receipt-workflow-review.md)
