# Platform Status

## Purpose

Summarize the current state of the documented Faako monorepo apps and their operational sensitivity.

## Current status

The monorepo is a growing platform with multiple app types: live operational systems, live/private-beta operations, paying-client commerce, public marketing, and backend signup API.

REEBS Portal and Dev ERP are both live systems with real data. Any change affecting auth, API permissions, customer/user data, payments, receipts, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, or database schema must be treated as production-sensitive.

## Apps

### REEBS Portal

- Purpose: Authenticated REEBS admin and operations portal with Netlify Functions and Prisma backend.
- Status: Live/private beta.
- Sensitivity: High because real authenticated users and operational data may be affected.

### Stroane Web

- Purpose: Full-stack commerce app for product browsing and purchasing flows.
- Status: First paying client project.
- Sensitivity: High because client trust, public experience, and transaction readiness are affected.

### Dev ERP

- Purpose: Fully live operational ERP with frontend, backend, Prisma database, auth, reports, invoicing, appointments, rent/payment records, email workflows, AI/productivity endpoints, and integrations.
- Status: Fully live with real operational data.
- Sensitivity: High because auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, and AI/productivity endpoints can affect live operations.

### Faako ERP

- Purpose: Shared-shell ERP frontend reference with config-driven demo/reference routes.
- Status: Demo/reference ERP app.
- Sensitivity: Medium because it exercises shared ERP navigation conventions and public demo access behavior.

### Faako Website

- Purpose: Public Faako marketing site and signup funnel.
- Status: Public-facing website and onboarding entry point.
- Sensitivity: Medium to high because brand trust and signup reliability are affected.

### Faako API

- Purpose: Netlify Functions backend for Faako signup and health checks.
- Status: Focused backend service for signup flow.
- Sensitivity: High for signup data, database targeting, and website compatibility.

## Shared high-risk areas

- Auth, roles, sessions, permissions, CSRF, and organization scoping.
- Database migrations, data imports, seed scripts, and production data targeting.
- Public signup, purchasing, payments, receipts, invoices, accounting, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, and operational records.
- Environment variables, especially secrets and browser-visible `VITE_*` values.
- Netlify/Railway deployment configuration and frontend/backend URL pairing.
- Shared ERP shell/layout foundations now live across `@faako/layout`, `@faako/ui`, `@faako/theme`, `@faako/types`, and `@faako/config`. REEBS Portal, Dev ERP, and Faako ERP use shared shell wrappers where low-risk while keeping business pages, routes, workflows, auth, and app-specific navigation behavior in each app.
- Shared ERP module registry metadata in `@faako/config` and app-specific admin registries. REEBS Portal, Dev ERP, and Faako ERP navigation now read from registry-backed adapters with visibility/state metadata for hidden, disabled, internal, coming-soon, and experimental modules, but permissions, routing, API access, page logic, database schema, billing, SaaS plan gating, and database-backed module toggles remain unchanged.
- Low-risk module consolidation is underway through registry/navigation metadata only. REEBS Team, Settings, Bookings, and Finance groupings are implemented without route removals, permission changes, payment logic changes, or receipt/invoice behavior changes; Dev ERP Team, Settings, Bookings/Rentals/Schedule, and Finance consolidation have been reviewed conservatively with no forced behavior changes.
- Order, payment, receipt, invoice, rent-payment, and balance workflows are now mapped in app-specific workflow reviews for REEBS Portal and Dev ERP. These reviews are documentation-only and must be used before designing shared payment/receipt/order runtime packages or expanding `@faako/finance` beyond constants, helpers, and presentation utilities.
- `@faako/finance` now provides shared payment/receipt constants, documented shape descriptors, pure formatting/normalization helpers, display-safe balance helpers, metadata normalization helpers, and receipt presentation helpers. Current app adoption is presentation-only in REEBS Portal order UI and Dev ERP Rent/Invoicing displays; it does not implement shared payment recording, receipt generation, invoice persistence, gateway integrations, app adapters, schema changes, API changes, or workflow changes.
- `@faako/notifications` now provides shared notification channels, types, statuses, customer-safe message templates, channel availability helpers, and user-triggered `mailto:`/WhatsApp draft helpers. Current adoption is display/share-only: REEBS receipt summaries can be copied or opened as email/WhatsApp drafts, and Dev ERP Appointments uses the shared booking draft text for the existing email-link action. It does not send automated WhatsApp messages, emails, SMS, in-app notifications, change Resend behavior, persist notification data, or alter receipt/payment/order/rent workflows.
- `@faako/offline-sync` now provides offline queue constants, local draft storage helpers, IndexedDB queue storage helpers, retry metadata helpers, queue summary/review helpers, online/offline status hooks, passive status components, and documented security assumptions. REEBS Portal uses local draft storage for Store Mode POS/manual order payment drafts, queues offline Store Mode POS order creation, queues offline manual order payments, queues offline inventory stock adjustments, and queues offline booking create/edit/status actions through existing server endpoints when online returns. Dev ERP queues new offline rent payments, keeps rent payment edits and booking/calendar settings online-only, and has no current inventory adjustment surface wired for offline sync. REEBS Admin Workspace and Dev ERP Settings expose Sync Review panels for local pending, failed, conflict, and needs-review queue visibility plus retry/cancel/mark-resolved controls. No service worker, database schema change, receipt-offline generation, permanent offline stock deduction/reservation before server sync, offline balance update, offline accounting effect, or full offline business workflow exists yet.
- Shell placeholders exist for offline indicators, sync status, notifications, and future organization switching, but backend behavior and multi-tenant controls are not implemented yet.

## Platform operating notes

- Keep app documentation structurally consistent.
- Log shared changes in `docs/platform/platform-progress-log.md`.
- Log app-specific changes in the relevant `docs/apps/<app>/progress-log.md`.
- Record durable architecture or product decisions in `docs/decisions/README.md` using the decision template.
- Keep implementation notes in app folders for app-specific details and `docs/implementation-notes/README.md` for cross-app notes.
