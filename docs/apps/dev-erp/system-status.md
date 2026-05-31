# Dev ERP System Status

## App purpose

Dev ERP is a fully live operational ERP with a Vite frontend, Express backend, and Prisma database for organizations, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, email workflows, AI/productivity endpoints, and integrations.

## Current status

Fully live system with real operational data. Treat all changes as production-sensitive unless they are clearly isolated to local-only tooling.

## Stable modules/features

- Shared ERP shell, sidebar, topbar, and mobile-safe layout conventions.
- Backend composition through focused route slices.
- Cookie-based session boot from `/api/auth/session`.
- Secure cookie-session support for separately hosted frontend/API deployments, including the current direct Railway API hostname. A same-site custom API hostname remains an optional browser-compatibility hardening step. CSRF token handoff remains in authenticated responses, unsafe business writes keep server-side cookie/header validation, and refresh-cookie recovery supports reopened sessions.
- Capability middleware, organization scoping, and shared API client behavior.
- Additive invoice `paidAmount`, derived balance-due, and manual partial-payment presentation.

## In-progress modules/features

- Operational dashboards, rent, accounting, invoicing, appointments, reports, user access, alerts, and integration refinements.
- Shared shell and form styling alignment with other ERP-style apps.
- Backend route hardening and deployment readiness.
- Paystack invoice/payment foundation planning. Current work is config/documentation only and does not generate payment links, verify webhooks, create receipts, or mutate payment/invoice records.
- Proposal persistence, preview, secure client view, and lightweight client response foundation. Current `/proposals` work supports private authenticated proposal records, lightweight versioning, internal preview routing, secure-token preparation, `/proposal/view/:token` client viewing, and approve/request-changes responses for `shared` proposals. It does not expose drafts/internal-review proposals, create invoices, generate Paystack links, create digital signatures, send approval notifications, or run AI generation.

## Experimental modules/features

- Any local-only workflow prototypes until explicitly reviewed for production use.
- New integrations, alerts, AI/productivity endpoints, and automation jobs until validated against live-system safety expectations.
- Proposal Generator client-view/response MVP until server-owned approval records, digital signatures, approval audit logs, version locking, server PDF rendering/storage, invoice conversion, Paystack links, expiry-management UI, view tracking, notifications, and AI boundaries are reviewed.

## High-risk areas

- Auth, sessions, CSRF, API permissions, capability middleware, and organization scoping.
- Operational records, rent records, payment records, customer/client data, reports, and data exports.
- Prisma migrations, database schema changes, production data targeting, and environment-specific database isolation.
- Environment variables, OAuth token encryption, email workflows, third-party integrations, and AI/productivity endpoints.
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
