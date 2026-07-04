# Dev ERP System Status

## App purpose

Dev ERP is a fully live operational ERP with a Vite frontend, Express backend, and Prisma database for organizations, projects, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, email workflows, AI/productivity endpoints, and integrations.

## Current status

Fully live system with real operational data. Treat all changes as production-sensitive unless they are clearly isolated to local-only tooling.

## Stable modules/features

- Shared ERP shell, sidebar, topbar, and mobile-safe layout conventions.
- Backend composition through focused route slices.
- Cookie-based session boot from `/api/auth/session`.
- Secure cookie-session support for separately hosted frontend/API deployments, including the current direct Railway API hostname. Login verifies the issued session before opening the dashboard. A same-site custom API hostname is required for reliable Safari persistence because Safari blocks third-party cookies by default. CSRF token handoff remains in authenticated responses, unsafe business writes keep server-side cookie/header validation, and refresh-cookie recovery supports reopened sessions.
- Capability middleware, organization scoping, and shared API client behavior.
- Frontend route guards for restricted module users are aligned with backend module capability keys, with the rent-only dashboard landing preserved.
- Additive invoice `paidAmount`, derived balance-due, and manual partial-payment presentation.
- GHS display currency normalization for financial figures, with optional backend currency API hydration through `CURRENCY_API_URL`/`CURRENCY_API_KEY` and non-secret fallback rates through `CAD_TO_GHS_RATE`/`VITE_CAD_TO_GHS_RATE`. Persisted source currencies remain unchanged.
- Registry-complete site/API monitoring with bounded concurrent fetches. API surfaces, including the Dev ERP Railway/custom API host, render in System Status only; website and portal page health excludes API/internal surfaces. Optional internal apps remain visible as `Not configured` until hosted URLs exist.
- Projects module for org-scoped personal and external project management, with a Kanban board, drag/drop stage movement, button-based stage movement, and authenticated `/api/projects` CRUD.
- Accounting-to-Invoicing handoff for manual revenue entries. Accounting creates persisted invoice drafts/paid invoices and line items; expense entries remain payables and cannot create invoices.
- Standalone Reports, System Health, and Audit Logs Insights modules. Reports manages scheduled email workflows; Audit Logs owns event filtering, analytics, incidents, CSV export, Railway webhook diagnostics, terminal-style live log streams, and the legacy `/api/reports/summary` compatibility alias capability.
- Productivity Coach AI fetches remain backend-only through `/api/ai/productivity-coach`, with auth, Dashboard capability, CSRF, AI rate limit, server-side key checks, prompt validation, timeout handling, and sanitized errors.
- Shared `AppUpdateNotice` in the app shell prompts for a user-controlled refresh when a newer deployed frontend bundle exists. It must not replace backend maintenance/read-only controls for migrations or risky live-data work.

## In-progress modules/features

- Operational dashboards, projects, rent, accounting, invoicing, appointments, reports, user access, alerts, and integration refinements.
- Shared shell and form styling alignment with other ERP-style apps.
- Backend route hardening and deployment readiness.
- Paystack invoice/payment foundation planning. Current work is config/documentation only and does not generate payment links, verify webhooks, create receipts, or mutate payment/invoice records.
- Proposal persistence, preview, secure client view, lightweight client responses, audit logging, and invoice draft handoff. Current `/proposals` work supports private authenticated proposal records, lightweight versioning, internal preview routing, secure-token preparation/sharing, `/proposal/view/:token` client viewing, approve/request-changes responses for `shared` proposals, and editable invoice drafts for approved proposals. It does not expose drafts/internal-review proposals, generate Paystack links, create digital signatures, send approval notifications, or run AI generation.

## Experimental modules/features

- Any local-only workflow prototypes until explicitly reviewed for production use.
- New integrations, alerts, AI/productivity endpoints, and automation jobs until validated against live-system safety expectations.

## High-risk areas

- Auth, sessions, CSRF, API permissions, capability middleware, and organization scoping.
- Operational records, rent records, payment records, customer/client data, reports, and data exports.
- Prisma migrations, database schema changes, production data targeting, and environment-specific database isolation.
- Environment variables, OAuth token encryption, email workflows, third-party integrations, and AI/productivity endpoints.
- CAD-to-GHS display conversion depends on the backend rate endpoint. Keep currency API keys server-side only, monitor provider failures, and keep fallback rates current enough that dashboards, PDFs, public invoice views, reports, and emails do not disagree badly during provider outages.
- Railway log visibility depends on `RAILWAY_WEBHOOK_SECRET` being set on the Dev API service and the Railway project webhook posting to `/api/webhooks/railway` with the matching secret. Missing or mismatched webhook config means Railway events will not appear in Audit Logs even when the rest of the API is healthy.
- Paystack keys, payment references, webhook signature verification, invoice paid-state reconciliation, manual payment fallback, receipt ownership, and future payment-provider audit logging.

## Production sensitivity

High. Dev ERP is fully live and contains real operational data. Auth, API permissions, customer/client data, operational records, rent/payment records, reports, email workflows, AI/productivity endpoints, environment variables, and database migrations must be treated as production-sensitive.

## Before-every-deploy questions

- Does this change affect auth, API permissions, capabilities, organization scoping, sessions, or CSRF?
- Does this change affect operational records, customer/client data, rent, payments, accounting, invoicing, appointments, reports, email workflows, AI/productivity endpoints, or integrations?
- Does this change require a Prisma migration, database schema change, seed, import, backfill, or production data update?
- Is database isolation enforced for local and development work?
- Are encryption keys and secrets configured only in server-side env vars?
- Does this change involve Paystack, payment links, webhook handling, payment references, invoice paid status, receipt generation, or manual payment fallback?
- Has the affected workflow been manually tested with realistic user capabilities?
