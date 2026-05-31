# Dev ERP

Workspace package: `@faako/dev-erp`

Dev ERP is a fully live operational ERP in this repo with real operational data. It combines a Vite admin frontend with an Express and Prisma backend for organizations, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, email workflows, AI/productivity endpoints, and integrations.

## What Lives Here

- `src/`: React frontend, route shell, auth state, API client, pages, and utilities
- `backend/`: Express API, feature route slices, auth and capability middleware, jobs, email templates, and integration helpers
- `prisma/`: Prisma schema and migrations
- `netlify.toml`: frontend deploy config and API proxying
- `.env.example`: source of truth for local and hosted environment variables

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start the full local app:

```bash
pnpm --filter @faako/dev-erp run dev:with-backend
```

Equivalent root shortcut:

```bash
pnpm run dev:dev-erp
```

Run only one side:

```bash
pnpm --filter @faako/dev-erp run dev
pnpm --filter @faako/dev-erp run server:dev
```

Typical local ports:

- frontend: `5173`
- backend: `8080`

## Current System Notes

- the frontend now follows the shared shell contract used across the repo, including shared sidebar widths, the edge collapse toggle, and mobile-safe topbar spacing
- the app shell now uses shared ERP topbar, page-content, mobile-bottom-nav, and status-badge wrappers from `@faako/ui` while keeping Dev ERP pages, routes, auth, notifications, offline banner, and business workflows app-owned
- shared form compat styling from `@faako/ui` covers `select`, `date`, `time`, and related controls so Safari and WebKit stay visually aligned
- Settings now uses low-risk shared ERP panel, panel-header, stack, form-field, form-action, action-bar, primary-action, and secondary-action wrappers from `@faako/ui`. The wrappers preserve existing class hooks where needed, so alert settings, Sync Review behavior, routes, API calls, auth, and storage behavior remain unchanged.
- System Health now uses the shared `ERPTable` and `ERPStatusBadge` presentation foundation for the read-only service status table. Dev ERP still owns the health data source, refresh behavior, incident notes, status mapping, auth, and API behavior.
- the backend is organized into focused vertical slices while `backend/server.js` owns runtime composition
- Dev ERP site/app monitoring now reads monitored app metadata from `@faako/config` (`packages/config/src/monorepoApps/appRegistry.js`) instead of a local hardcoded site list. The monitoring list covers REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, REEBS Website, the portfolio site, and Faako ERP while preserving the existing legacy dashboard ids for `nana`, `reebs`, and `faako`.
- Root script `pnpm run monitoring:check` scans `apps/` and compares current app directories against the shared monorepo app registry without printing URLs or secrets. Run it when adding or renaming apps so Dev ERP monitoring metadata stays current.
- `src/config/adminModules.js` contains the Dev ERP admin module registry for home, dashboard, rent, appointments, customers/organizations, payments, reports, users, profile, and settings.
- `src/app/navigation.js` adapts that registry into the existing sidebar and mobile navigation, preserving current labels, links, module-access filtering, rent-only navigation, and legacy `/users -> /user-control` behavior.
- Module registry entries now carry `visibility` and `state` metadata. Hidden modules are ignored by navigation; disabled, internal, coming-soon, and experimental modules can render subtle visual badges/classes while preserving routes and existing page behavior.
- Module consolidation planning is documented in [docs/apps/dev-erp/module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/module-consolidation-plan.md). It is planning-only and does not change routes, auth, schema, redirects, public access, or live workflows.
- Team consolidation remains pending for Dev ERP because User Control and Profile have different access assumptions. No Dev ERP navigation behavior was changed for this Team-only phase.
- Settings consolidation was reviewed and left unchanged for Dev ERP because `/settings` is the only current settings/config route. System Health and Audit Logs remain Reports-owned until a separate live capability review.
- Bookings/Rentals/Schedule consolidation was reviewed and left unchanged for Dev ERP because `/bookings` is already nested under Rent as Appointments, and no separate rentals or schedule route exists to safely group under a new Bookings module in this low-risk phase.
- Finance consolidation planning is documented in [docs/apps/dev-erp/finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/finance-consolidation-plan.md). It is planning-only and does not change accounting entries, invoices, rent payments, public invoice views, reports, backend capabilities, routes, APIs, migrations, or permissions.
- Paystack foundation planning is documented in [docs/apps/dev-erp/paystack-foundation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/paystack-foundation-plan.md). It is planning/config-only and does not generate payment links, verify webhooks, mark invoices paid, create receipts, change manual rent payment behavior, update payment persistence, or change database schema.
- Proposal module planning is documented in [docs/apps/dev-erp/proposal-module-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/proposal-module-plan.md). The current `/proposals` implementation supports private authenticated proposal persistence, lightweight versioning, an internal `/proposals/:proposalId/preview` route, a token-based client view at `/proposal/view/:token`, lightweight client approval/request-changes actions for `shared` proposals, reusable proposal schema blocks, a simplified template-gallery UI with search/category filters, a Start from Scratch/Blank Proposal flow, configurable template starters for ERP, website, portal, POS/inventory, workflow, automation, onboarding, service, support, and future travel proposals, editor shell, responsive preview shell, export-aware preview metadata, print/save-as-PDF download from the client view, and internal workflow-state fields for review notes, readiness checks, client response state, and change-request notes. It does not expose drafts/internal-review proposals, internal notes, editor controls, staff metadata, invoice conversion, Paystack links, digital signatures, approval audit logs, email notifications, or AI generation through the client view.
- Finance grouping remains pending for Dev ERP. Accounting and Invoicing stay separate visible routes, Rent Payments stay under Rent, Reports stay under Reports, and public invoice views stay outside authenticated navigation until live workflow and capability behavior are reviewed.
- Rent payments, accounting paid state, invoices, public invoice links, report-adjacent finance behavior, missing dedicated receipt source of truth, and balance calculations are mapped in [docs/apps/dev-erp/order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/order-payment-receipt-workflow-review.md). This review is documentation-only and should be used before any shared payment/receipt/order runtime package work or before expanding `@faako/finance` beyond constants, helpers, and presentation utilities.
- `@faako/finance` is used only for Dev ERP Rent and Invoicing currency display. It does not change rent payment persistence, invoice persistence, accounting behavior, reports, public invoice links, backend APIs, permissions, or database schema.
- `@faako/notifications` is used only for the Appointments email-link draft text. It creates a customer-safe `mailto:` draft for the existing appointment link share action; it does not send automated email, change Resend behavior, send WhatsApp/SMS messages, persist notification data, or alter booking/calendar/rent/payment workflows.
- `@faako/offline-sync` is used for the Dev ERP topbar online/offline indicator and queued new rent payment recording when the browser is offline. Queued rent payments are user/org scoped where possible and submit to the existing rent payment endpoint when connectivity returns; the server still owns auth, permissions, rent references, balance updates, notifications, accounting/report effects, and final payment records. Existing rent payment edits remain online-only. Dev ERP currently has no inventory adjustment surface wired for offline sync, and its Bookings/Appointments page remains online-only because the reviewed surface is calendar/settings/sync oriented rather than a safe manual booking create/update/status workflow.
- Dev ERP Settings includes the shared `SyncReviewPanel` from `@faako/offline-sync` for local Dev ERP queue visibility. Use it to review queued rent payment counts, failed/needs-review errors, retry by re-arming items for existing sync handlers, cancel local queue items, or mark locally reviewed items resolved. The panel shows summary metadata and last errors only, not raw queue payloads. No environment variables, setup steps, migrations, route changes, permission changes, or server workflow changes are required.
- The registry uses shared helpers from `@faako/config`; it has no required environment variables, setup steps, migrations, database impact, billing behavior, SaaS plan gating, or access-control enforcement changes.
- Optional monitoring URL overrides are available through `REEBS_PORTAL_BASE_URL`, `DEV_ERP_BASE_URL`, `STROANE_WEB_BASE_URL`, `FAAKO_WEBSITE_BASE_URL`, `FAAKO_API_BASE_URL`, `REEBS_WEBSITE_BASE_URL`, `BYNANA_PORTFOLIO_BASE_URL`, and `FAAKO_ERP_BASE_URL`. If unset, monitoring uses the documented production/default app URLs.
- Shared app-mode helpers (`normal`, `degraded`, `read_only`, `maintenance`) and maintenance/read-only/degraded UI wrappers are available in `@faako/config` and `@faako/ui`, but Dev ERP has not wired them into runtime behavior yet. Do not rely on frontend mode banners for live-data protection; backend/API write guards are required before using maintenance or read-only mode during migrations or risky deployments.
- Known limitation: the registry now drives navigation metadata, but route guards, API permissions, backend capabilities, and database-backed module toggles remain manual and unchanged. Org-level module config, permissions integration, SaaS plan gating, and visual grouped navigation remain future work. The Proposals module has a token-based client-view and lightweight response MVP, but server-owned approval records, digital signatures, server PDF rendering/storage, invoice conversion, Paystack payment links, full revision history, notifications, analytics, expiry-management UI, view tracking, version locking, and AI wording remain future work.
- Known limitation: shell placeholder support for offline/sync/notifications/org switching is structural only; live notification polling, auth, and backend capabilities remain unchanged. Offline rent support queues new payment records only and does not queue edits, invoices, accounting changes, reports, inventory adjustments, booking/calendar settings, Google Calendar sync, public-token actions, or broader production sync. The Settings Sync Review panel is visibility/recovery tooling; retry still relies on existing app sync paths and server validation.
- Known limitation: Dev ERP does not currently have a REEBS-style order/POS source of truth or dedicated immutable receipt flow in the reviewed paths. Future shared payment/receipt work must preserve rent payment, accounting, invoice, report, and public-token behavior.
- Testing notes: verify the sidebar, mobile tabs, topbar spacing, hidden-module filtering in registry adapters, disabled-module visual state, Settings route access, Settings Sync Review queue counts/retry/cancel/mark-resolved controls, Rent/Appointments route access, appointment link email draft text, rent-only user view, Rent/Invoicing currency display, online/offline indicator visibility, queued offline rent payment save/sync/needs-review behavior, unchanged online Bookings/Appointments settings and Google Calendar sync behavior, invoice route lookup, and legacy `/users` target before future registry wiring.
- Shared ERP form foundation usage is presentation-only. Settings owns alert preference state, save/test handlers, API calls, auth/session handling, and local Sync Review behavior; do not migrate rent payments, invoices, user role/password changes, appointment settings, auth forms, or AI/productivity forms to shared wrappers without a separate workflow review.
- Shared ERP modal/action foundation usage is presentation-only. Settings uses shared action wrappers only; do not migrate Invoicing modals, rent payment actions, user role/password confirmations, appointment settings, auth/session modals, reports scheduling, AI/productivity actions, or Sync Review controls to shared modal/action wrappers without a separate workflow review.

## Database

Use `apps/dev-erp/.env.example` to create an untracked local env file such as `apps/dev-erp/.env.development`.

Common database commands:

```bash
pnpm --filter @faako/dev-erp run db:generate
pnpm --filter @faako/dev-erp run db:status:dev
pnpm --filter @faako/dev-erp run db:deploy:dev
pnpm --filter @faako/dev-erp run db:migrate:dev -- --name <migration-name>
pnpm --filter @faako/dev-erp run db:studio
```

Important safeguards:

- `APP_ENV` selects the environment-specific database flow
- `ENFORCE_DATABASE_ISOLATION=true` helps block local work from writing to production data
- `VITE_*` values are browser-visible and must not contain secrets
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled
- Paystack placeholders are documented in `.env.example` for future invoice/payment work: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, and `PAYSTACK_CURRENCY`. These are not wired into live payment behavior yet; keep secret and webhook values server-side only.
- Dev ERP is production-sensitive. Treat auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, and AI/productivity endpoints as live-data risk areas.

## Auth And API

- the frontend boots from `/api/auth/session`
- session state is cookie-based rather than browser-readable token storage
- access sessions use a short-lived server JWT; the shared API client retries once through `/api/auth/refresh` before signing out when the access cookie expires
- backend access is enforced by capability middleware and organization scoping, not only by frontend route visibility
- the shared API client in `src/api/client.ts` handles credentials, CSRF headers, JSON parsing, and normalized API errors
- when the hosted frontend and Railway API are on different sites, configure Railway with `AUTH_COOKIE_SAME_SITE=none`, `AUTH_COOKIE_SECURE=true`, and a narrow `CORS_ORIGINS` allow-list containing the frontend origin. Login, `/api/auth/session`, and refresh responses return the matching CSRF token for browser session storage while the API still validates the CSRF cookie/header pair.

## Invoice Payment Tracking

Invoice records now persist `paidAmount`, derive `balanceDue`, and present `unpaid`, `part_paid`, `paid`, or `overpaid` status without introducing an external payment ledger. Apply the additive production migration before deploying the updated backend:

```bash
pnpm --filter @faako/dev-erp run db:deploy:prod
```

## Verify Changes

```bash
pnpm --filter @faako/dev-erp run test
pnpm run monitoring:check
pnpm --filter @faako/dev-erp exec tsc --noEmit
pnpm --filter @faako/dev-erp run build
```

## Deployment

The frontend can build through Netlify with:

```bash
pnpm --filter @faako/dev-erp run build
```

The publish folder is `apps/dev-erp/dist`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/dev-erp
```

The backend deploys separately through Railway using the repo root `nixpacks.toml`. For a standalone backend start:

```bash
pnpm --filter @faako/dev-erp run start
```

## More Detail

- [module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/module-consolidation-plan.md)
- [finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/finance-consolidation-plan.md)
- [order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/order-payment-receipt-workflow-review.md)
