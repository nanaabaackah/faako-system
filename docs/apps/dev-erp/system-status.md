# Dev ERP System Status

## App purpose

Dev ERP is a fully live operational ERP with a Vite frontend, Express backend, and Prisma database for organizations, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, email workflows, AI/productivity endpoints, and integrations.

## Current status

Fully live system with real operational data. Treat all changes as production-sensitive unless they are clearly isolated to local-only tooling.

## Stable modules/features

- Shared ERP shell, sidebar, topbar, and mobile-safe layout conventions.
- Backend composition through focused route slices.
- Cookie-based session boot from `/api/auth/session`.
- Capability middleware, organization scoping, and shared API client behavior.

## In-progress modules/features

- Operational dashboards, rent, accounting, invoicing, appointments, reports, user access, alerts, and integration refinements.
- Shared shell and form styling alignment with other ERP-style apps.
- Backend route hardening and deployment readiness.

## Experimental modules/features

- Any local-only workflow prototypes until explicitly reviewed for production use.
- New integrations, alerts, AI/productivity endpoints, and automation jobs until validated against live-system safety expectations.

## High-risk areas

- Auth, sessions, CSRF, API permissions, capability middleware, and organization scoping.
- Operational records, rent records, payment records, customer/client data, reports, and data exports.
- Prisma migrations, database schema changes, production data targeting, and environment-specific database isolation.
- Environment variables, OAuth token encryption, email workflows, third-party integrations, and AI/productivity endpoints.

## Production sensitivity

High. Dev ERP is fully live and contains real operational data. Auth, API permissions, customer/client data, operational records, rent/payment records, reports, email workflows, AI/productivity endpoints, environment variables, and database migrations must be treated as production-sensitive.

## Before-every-deploy questions

- Does this change affect auth, API permissions, capabilities, organization scoping, sessions, or CSRF?
- Does this change affect operational records, customer/client data, rent, payments, accounting, invoicing, appointments, reports, email workflows, AI/productivity endpoints, or integrations?
- Does this change require a Prisma migration, database schema change, seed, import, backfill, or production data update?
- Is database isolation enforced for local and development work?
- Are encryption keys and secrets configured only in server-side env vars?
- Has the affected workflow been manually tested with realistic user capabilities?
