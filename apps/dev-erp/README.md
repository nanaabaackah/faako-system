# Dev ERP

Workspace package: `@faako/dev-erp`

Dev ERP is a fully live operational ERP in this repo with real operational data. It combines a Vite admin frontend with an Express and Prisma backend for organizations, projects, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, email workflows, AI/productivity endpoints, and integrations.

## What Lives Here

- `src/`: React frontend, route shell, auth state, API client, pages, and utilities
- `backend/`: Express API, feature route slices, auth and capability middleware, jobs, email templates, and integration helpers
- `prisma/`: Prisma schema and migrations
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

This command runs `predeploy:local` before starting the local API and frontend:
Prisma is generated, pending development migrations are applied, and migration
status is checked before the long-running dev processes start.

Equivalent root shortcut:

```bash
pnpm run dev:dev-erp
```

Run only one side:

```bash
pnpm --filter @faako/dev-erp run dev:frontend
pnpm --filter @faako/dev-erp run server:dev
```

Typical local ports:

- frontend: `5173`
- backend: `8080`

Keep `VITE_API_BASE=""` in the untracked local `.env.development` file so Vite
proxies `/api` to `VITE_API_PROXY_TARGET`. A hosted `VITE_API_BASE` inherited
from `.env` bypasses the local proxy and requires that hosted API to allow the
localhost origin. Keep `AUTH_COOKIE_SAME_SITE=lax` and
`AUTH_COOKIE_SECURE=false` there as well so local HTTP can persist auth cookies.

## Current System Notes

- the frontend now follows the shared shell contract used across the repo, including shared sidebar widths, the edge collapse toggle, and mobile-safe topbar spacing
- the app shell now uses shared ERP topbar, page-content, mobile-bottom-nav, and status-badge wrappers from `@faako/ui` while keeping Dev ERP pages, routes, auth, notifications, offline banner, and business workflows app-owned
- shared form compat styling from `@faako/ui` covers `select`, `date`, `time`, and related controls so Safari and WebKit stay visually aligned
- Settings now uses low-risk shared ERP panel, panel-header, stack, form-field, form-action, action-bar, primary-action, and secondary-action wrappers from `@faako/ui`. The wrappers preserve existing class hooks where needed, so alert settings, Sync Review behavior, routes, API calls, auth, and storage behavior remain unchanged.
- System Health now uses the shared `ERPTable` and `ERPStatusBadge` presentation foundation for the read-only service status table. Dev ERP still owns the health data source, refresh behavior, incident notes, status mapping, auth, and API behavior.
- the backend is organized into focused vertical slices while `backend/server.js` owns runtime composition
- Dev ERP site/app monitoring now reads app metadata from `@faako/config` (`packages/config/src/monorepoApps/appRegistry.js`) instead of a local hardcoded site list. Every registered app workspace appears in monitoring. Hosted apps are checked with bounded concurrency, while System Starter and UI Workbench remain visible as `Not configured` until their optional hosted URLs are supplied. Dev ERP API monitoring is an API/System Status surface pointed at `https://api.dev.nanaabaackah.com` by default, not a website page. Existing legacy dashboard ids for `nana`, `reebs`, and `faako` are preserved.
- Root script `pnpm run monitoring:check` scans `apps/` and compares current app directories against the shared monorepo app registry without printing URLs or secrets. Run it when adding or renaming apps so Dev ERP monitoring metadata stays current. The latest run reported 10 registered app workspaces and 14 monitored app surfaces.
- `src/config/adminModules.js` contains the Dev ERP admin module registry for home, projects, dashboard, rent, appointments, customers/organizations, payments, reports, users, profile, and settings.
- `src/app/navigation.js` adapts that registry into the existing sidebar and mobile navigation, preserving current labels, links, module-access filtering, rent-only navigation, and legacy `/users -> /user-control` behavior. Frontend route guards now use the same module keys for restricted users, and the Dashboard skips Bookings/Accounting subpanels when the user does not have those modules.
- The Projects module is available at `/projects` behind the `projects` capability. It stores org-scoped personal and external projects, renders a Kanban board across backlog, scoping, active, review, and done stages, and supports drag/drop plus button-based stage movement.
- AI/productivity fetches remain server-owned under `/api/ai/productivity-coach`, protected by auth, module capability, CSRF, AI rate limiting, prompt validation, API-key checks, timeout handling, and safe error responses. No browser-visible AI key or direct frontend model fetch is used.
- Module registry entries now carry `visibility` and `state` metadata. Hidden modules are ignored by navigation; disabled, internal, coming-soon, and experimental modules can render subtle visual badges/classes while preserving routes and existing page behavior.
- Module consolidation planning is documented in [docs/apps/dev-erp/module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/module-consolidation-plan.md). It is planning-only and does not change routes, auth, schema, redirects, public access, or live workflows.
- Team consolidation remains pending for Dev ERP because User Control and Profile have different access assumptions. No Dev ERP navigation behavior was changed for this Team-only phase.
- Settings consolidation was reviewed and left unchanged for Dev ERP because `/settings` is the only current settings/config route. Reports now owns scheduled report-email configuration and manual sends only. System Health and Audit Logs are standalone Insights modules; the legacy `/api/reports/summary` compatibility route requires Audit Logs capability.
- Bookings/Rentals/Schedule consolidation was reviewed and left unchanged for Dev ERP because `/bookings` is already nested under Rent as Appointments, and no separate rentals or schedule route exists to safely group under a new Bookings module in this low-risk phase.
- Finance consolidation planning is documented in [docs/apps/dev-erp/finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/finance-consolidation-plan.md). It is planning-only and does not change accounting entries, invoices, rent payments, public invoice views, reports, backend capabilities, routes, APIs, migrations, or permissions.
- Paystack foundation planning is documented in [docs/apps/dev-erp/paystack-foundation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/paystack-foundation-plan.md). It is planning/config-only and does not generate payment links, verify webhooks, mark invoices paid, create receipts, change manual rent payment behavior, update payment persistence, or change database schema.
- Dev ERP renders operational financial figures in GHS through app-owned display currency helpers. The backend can hydrate CAD->GHS from a server-side currency API using `CURRENCY_API_URL` and `CURRENCY_API_KEY`, then exposes the safe rate through `/api/currency/display-rate` for frontend dashboards, public invoice views, and browser PDFs. `CAD_TO_GHS_RATE` and `VITE_CAD_TO_GHS_RATE` remain non-secret fallbacks. Stored accounting entry currencies, tenant currencies, invoice currencies, form inputs, payment persistence, database schema, and Paystack planning remain unchanged.
- Proposal module planning is documented in [docs/apps/dev-erp/proposal-module-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/proposal-module-plan.md). The current `/proposals` implementation supports private authenticated proposal persistence, lightweight versioning, an internal `/proposals/:proposalId/preview` route, a token-based client view at `/proposal/view/:token`, lightweight client approval/request-changes actions for `shared` proposals, proposal/share/client-response/invoice-handoff audit events, approved-proposal to invoice-draft handoff, reusable proposal schema blocks, a document-first editable proposal canvas, responsive setup rail, template switching that preserves compatible entered fields and explicit section choices, search/category filters, a Start from Scratch/Blank Proposal flow, configurable template starters for ERP, website, portal, POS/inventory, workflow, automation, onboarding, service, support, and future travel proposals, add/remove pricing and timeline rows, export-aware preview metadata, browser print/save-as-PDF export, secure-link preparation/copy, and internal workflow-state fields for review notes, readiness checks, client response state, and change-request notes. It does not expose drafts/internal-review proposals, internal notes, editor controls, staff metadata, Paystack links, digital signatures, email notifications, or AI generation through the client view.
- Faako Onboarding is available at `/faako-onboarding` for authenticated admins with the `faako-onboarding` module. It reads Faako Website onboarding and client setup submissions through `FAAKO_DATABASE_URL`, displays them in a filterable shared ERP table, and opens full wizard responses in a lightbox that hides unanswered fields/sections instead of showing placeholder `N/A` rows. The module supports internal status updates, notes, owner assignment when the Faako migration is applied, email delivery metadata, PDF-summary metadata, and an activity timeline. Public Faako Website form submission, PDF generation, duplicate-submit idempotency, and email delivery remain owned by Faako API.
- Finance grouping remains pending for Dev ERP. Accounting and Invoicing stay separate visible routes, Rent Payments stay under Rent, Reports stay under Reports, and public invoice views stay outside authenticated navigation until live workflow and capability behavior are reviewed.
- Accounting can now create persisted invoice drafts only from manual revenue entries. Expenses remain payables in Accounting and do not offer invoice creation. The handoff writes an `Invoice` and `InvoiceLineItem`, keeps `AccountingEntry.invoiceNumber` aligned, and opens the resulting draft in Invoicing for editing/sending.
- Rent payments, accounting paid state, invoices, public invoice links, report-adjacent finance behavior, missing dedicated receipt source of truth, and balance calculations are mapped in [docs/apps/dev-erp/order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/order-payment-receipt-workflow-review.md). This review is documentation-only and should be used before any shared payment/receipt/order runtime package work or before expanding `@faako/finance` beyond constants, helpers, and presentation utilities.
- `@faako/finance` is used for Dev ERP invoice balance/payment-status helpers and shared finance constants. GHS display conversion is app-owned in Dev ERP and does not change rent payment persistence, invoice persistence, accounting behavior, backend APIs, permissions, or database schema.
- `@faako/notifications` is used only for the Appointments email-link draft text. It creates a customer-safe `mailto:` draft for the existing appointment link share action; it does not send automated email, change Resend behavior, send WhatsApp/SMS messages, persist notification data, or alter booking/calendar/rent/payment workflows.
- `@faako/offline-sync` is used for the Dev ERP topbar online/offline indicator and queued new rent payment recording when the browser is offline. Queued rent payments are user/org scoped where possible and submit to the existing rent payment endpoint when connectivity returns; the server still owns auth, permissions, rent references, balance updates, notifications, accounting/report effects, and final payment records. Existing rent payment edits remain online-only. Dev ERP currently has no inventory adjustment surface wired for offline sync, and its Bookings/Appointments page remains online-only because the reviewed surface is calendar/settings/sync oriented rather than a safe manual booking create/update/status workflow.
- Dev ERP Settings includes the shared `SyncReviewPanel` from `@faako/offline-sync` for local Dev ERP queue visibility. Use it to review queued rent payment counts, failed/needs-review errors, retry by re-arming items for existing sync handlers, cancel local queue items, or mark locally reviewed items resolved. The panel shows summary metadata and last errors only, not raw queue payloads. No environment variables, setup steps, migrations, route changes, permission changes, or server workflow changes are required.
- The registry uses shared helpers from `@faako/config`; it has no required environment variables, setup steps, migrations, database impact, billing behavior, SaaS plan gating, or access-control enforcement changes.
- Optional monitoring URL overrides are available through `DEV_ERP_API_BASE_URL`, `DEV_API_BASE_URL`, `REEBS_PORTAL_BASE_URL`, `REEBS_API_BASE_URL`, `REEBS_BACKEND_BASE_URL`, `DEV_ERP_BASE_URL`, `STROANE_WEB_BASE_URL`, `STROANE_PORTAL_BASE_URL`, `STROANE_API_BASE_URL`, `STROANE_BACKEND_BASE_URL`, `APP_API_BASE_URL`, `VITE_API_BASE`, `VITE_BACKEND_BASE_URL`, `FAAKO_WEBSITE_BASE_URL`, `FAAKO_API_BASE_URL`, `FAAKO_API_URL`, `REEBS_WEBSITE_BASE_URL`, `BYNANA_PORTFOLIO_BASE_URL`, `FAAKO_ERP_BASE_URL`, `SYSTEM_STARTER_BASE_URL`, and `UI_WORKBENCH_BASE_URL`. If unset, public monitoring uses documented production/default URLs; Stroane API defaults to `https://api.stroanesolutions.com`; optional internal surfaces remain visible as `Not configured`. Dev ERP promotes API surfaces into System Status and keeps API/internal-only surfaces out of the website and portal page list. `SITE_STATUS_CONCURRENCY` bounds simultaneous page checks. External database checks are optional and use `REEBS_DATABASE_URL`, `FAAKO_DATABASE_URL`, and `STROANE_DATABASE_URL` when supplied; table discovery is used so a connected database with the wrong app schema is marked as an error rather than a healthy connection.
- `FAAKO_API_BASE_URL` or `FAAKO_API_URL` should point to a real Faako API deployment that serves `/health` as JSON. The public marketing website host currently serves SPA HTML for API-like paths, so Faako API remains `Not configured` until one of those API host env vars is supplied.
- Railway events in Audit Logs come from the Dev API webhook at `/api/webhooks/railway`, not from a direct Railway console-log stream. Set server-only `RAILWAY_WEBHOOK_SECRET` on Railway and configure the Railway project webhook to send that secret as `Authorization: Bearer <secret>`, `x-faako-webhook-secret`, `x-railway-webhook-secret`, `x-webhook-secret`, or `?secret=<secret>`. Audit Logs shows webhook configuration status and auto-refreshes the terminal-style log stream.
- Cross-app activity in Audit Logs comes from Dev ERP's own persisted API request trail and the app activity webhook at `/api/webhooks/app-activity`. Set server-only `APP_ACTIVITY_WEBHOOK_SECRET` on Dev ERP. Server-side monitored apps can forward sanitized events by setting `DEV_ERP_ACTIVITY_WEBHOOK_URL` to the Dev ERP endpoint and `DEV_ERP_ACTIVITY_WEBHOOK_SECRET` to the same secret. REEBS portal audit writes, Stroane API order/payment events, and Faako API signup intake now emit optional central activity events when those env values are configured. The endpoint accepts the secret as `Authorization: Bearer <secret>`, `x-app-activity-webhook-secret`, `x-faako-webhook-secret`, `x-webhook-secret`, or `?secret=<secret>` and strips secret-like metadata keys before saving.
- Shared app-mode helpers (`normal`, `degraded`, `read_only`, `maintenance`) and maintenance/read-only/degraded UI wrappers are available in `@faako/config` and `@faako/ui`, but Dev ERP has not wired them into runtime behavior yet. Do not rely on frontend mode banners for live-data protection; backend/API write guards are required before using maintenance or read-only mode during migrations or risky deployments.
- `AppUpdateNotice` from `@faako/ui` is mounted in the app shell, enabled in production, and testable locally with `VITE_ENABLE_APP_UPDATE_NOTICE=true`. It prompts for a user-controlled refresh when a newer deployed frontend bundle exists and must not replace backend maintenance/read-only controls for live data, migrations, auth, payments, reports, or other risky operational work.
- Known limitation: the registry now drives navigation metadata and frontend route access for restricted module users, but the registry is not yet the source of truth for backend capabilities or database-backed module toggles. Keep route guard mappings, capability routes, and dashboard cross-module panels in sync manually until org-level module config, permissions integration, SaaS plan gating, and grouped navigation are designed. The Proposals module has a token-based client-view, lightweight response MVP, audit logging, and invoice draft handoff, but server-owned approval records, digital signatures, server PDF rendering/storage, Paystack payment links, full revision history, notifications, analytics, expiry-management UI, view tracking, version locking, and AI wording remain future work.
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
pnpm --filter @faako/dev-erp run predeploy:local
```

Important safeguards:

- `APP_ENV` selects the environment-specific database flow
- `ENFORCE_DATABASE_ISOLATION=true` helps block local work from writing to production data
- `VITE_*` values are browser-visible and must not contain secrets
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled
- Paystack placeholders are documented in `.env.example` for future invoice/payment work: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, and `PAYSTACK_CURRENCY`. These are not wired into live payment behavior yet; keep secret and webhook values server-side only.
- `FAAKO_DATABASE_URL` is required for the internal Faako Onboarding module. Apply the Faako API migration before using owner/status/notes/timeline/email/PDF metadata from Dev ERP.
- `APP_ACTIVITY_WEBHOOK_SECRET` is required before external monitored apps can report sanitized activity into Audit Logs. Emitting apps should use server-only `DEV_ERP_ACTIVITY_WEBHOOK_URL` and `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`; do not expose these values through `VITE_*` or public frontend code.
- Dev ERP is production-sensitive. Treat auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, and AI/productivity endpoints as live-data risk areas.

## Auth And API

- the frontend boots from `/api/auth/session`
- session state is cookie-based rather than browser-readable token storage
- access sessions use a short-lived server JWT; the shared API client retries once through `/api/auth/refresh` before signing out when the access cookie expires
- backend access is enforced by capability middleware and organization scoping, not only by frontend route visibility
- the shared API client in `src/api/client.ts` handles credentials, CSRF headers, JSON parsing, and normalized API errors
- the current hosted frontend can call the Railway API URL directly through `VITE_API_BASE`, for example `https://app-production.up.railway.app`. For that split-site setup, configure Railway with `AUTH_COOKIE_SAME_SITE=none`, `AUTH_COOKIE_SECURE=true`, and a narrow `CORS_ORIGINS` allow-list containing the exact frontend origin. Safari blocks third-party cookies by default, so use a same-site custom Railway API hostname such as `https://api.dev.example.com` when Safari login persistence is required; register that custom domain on Railway, point its DNS CNAME to Railway's provided target rather than Cloudflare Pages, and use `AUTH_COOKIE_SAME_SITE=lax`.
- login verifies `/api/auth/session` before opening the dashboard. If the browser rejects the HttpOnly API cookie, the login page now stays in place with a safe session error instead of issuing a burst of unauthorized dashboard requests.
- login, `/api/auth/session`, and refresh responses return the matching CSRF token for browser session storage while unsafe business writes still validate the CSRF cookie/header pair. `/api/auth/refresh` is intentionally recovery-only: it validates and rotates the path-scoped HttpOnly refresh token after the CORS allow-list has accepted the browser origin, allowing a reopened browser session to recover when its prior `sessionStorage` CSRF token is gone.

## Invoice Payment Tracking

Invoice records now persist `paidAmount`, derive `balanceDue`, and present `unpaid`, `part_paid`, `paid`, or `overpaid` status without introducing an external payment ledger. Apply the additive production migration before deploying the updated backend:

```bash
pnpm --filter @faako/dev-erp run db:deploy:prod
```

## Verify Changes

```bash
pnpm --filter @faako/dev-erp run test
pnpm --filter @faako/dev-erp run test:e2e
pnpm run monitoring:check
pnpm --filter @faako/dev-erp run typecheck
pnpm --filter @faako/dev-erp run build
```

## Deployment

The static frontend currently deploys through Cloudflare Pages with:

```bash
pnpm --filter @faako/dev-erp run build
```

The publish folder is `apps/dev-erp/dist`. Set Cloudflare Pages `VITE_API_BASE` explicitly to the deployed Railway API URL. For a same-site API hostname, add the custom domain to the Railway backend first, then point its DNS CNAME to Railway's provided target. Do not map the API hostname to the Cloudflare Pages frontend.

The backend deploys separately through Railway using the repo root `nixpacks.toml`. Set the Railway service env to `RAILWAY_WORKSPACE=@faako/dev-erp`; the root launcher will run the workspace build/start scripts. For a standalone backend start:

```bash
pnpm --filter @faako/dev-erp run start
```

## More Detail

- [module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/module-consolidation-plan.md)
- [finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/finance-consolidation-plan.md)
- [order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/order-payment-receipt-workflow-review.md)
