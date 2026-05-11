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
- the backend is organized into focused vertical slices while `backend/server.js` owns runtime composition
- `src/config/adminModules.js` contains the Dev ERP admin module registry for home, dashboard, rent, appointments, customers/organizations, payments, reports, users, profile, and settings.
- `src/app/navigation.js` adapts that registry into the existing sidebar and mobile navigation, preserving current labels, links, module-access filtering, rent-only navigation, and legacy `/users -> /user-control` behavior.
- Module registry entries now carry `visibility` and `state` metadata. Hidden modules are ignored by navigation; disabled, internal, coming-soon, and experimental modules can render subtle visual badges/classes while preserving routes and existing page behavior.
- Module consolidation planning is documented in [docs/apps/dev-erp/module-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/module-consolidation-plan.md). It is planning-only and does not change routes, auth, schema, redirects, public access, or live workflows.
- Team consolidation remains pending for Dev ERP because User Control and Profile have different access assumptions. No Dev ERP navigation behavior was changed for this Team-only phase.
- Settings consolidation was reviewed and left unchanged for Dev ERP because `/settings` is the only current settings/config route. System Health and Audit Logs remain Reports-owned until a separate live capability review.
- Bookings/Rentals/Schedule consolidation was reviewed and left unchanged for Dev ERP because `/bookings` is already nested under Rent as Appointments, and no separate rentals or schedule route exists to safely group under a new Bookings module in this low-risk phase.
- Finance consolidation planning is documented in [docs/apps/dev-erp/finance-consolidation-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/finance-consolidation-plan.md). It is planning-only and does not change accounting entries, invoices, rent payments, public invoice views, reports, backend capabilities, routes, APIs, migrations, or permissions.
- Finance grouping remains pending for Dev ERP. Accounting and Invoicing stay separate visible routes, Rent Payments stay under Rent, Reports stay under Reports, and public invoice views stay outside authenticated navigation until live workflow and capability behavior are reviewed.
- Rent payments, accounting paid state, invoices, public invoice links, report-adjacent finance behavior, missing dedicated receipt source of truth, and balance calculations are mapped in [docs/apps/dev-erp/order-payment-receipt-workflow-review.md](/Users/Nana/Desktop/Developer/faako-system/docs/apps/dev-erp/order-payment-receipt-workflow-review.md). This review is documentation-only and should be used before any shared payment/receipt/order runtime package work or before expanding `@faako/finance` beyond constants, helpers, and presentation utilities.
- `@faako/finance` is used only for Dev ERP Rent and Invoicing currency display. It does not change rent payment persistence, invoice persistence, accounting behavior, reports, public invoice links, backend APIs, permissions, or database schema.
- `@faako/offline-sync` is used only for the Dev ERP topbar online/offline indicator. It does not queue rent payments, invoices, accounting changes, reports, public-token actions, or any production sync.
- The registry uses shared helpers from `@faako/config`; it has no required environment variables, setup steps, migrations, database impact, billing behavior, SaaS plan gating, or access-control enforcement changes.
- Known limitation: the registry now drives navigation metadata, but route guards, API permissions, backend capabilities, and database-backed module toggles remain manual and unchanged. Org-level module config, permissions integration, SaaS plan gating, and visual grouped navigation remain future work.
- Known limitation: shell placeholder support for offline/sync/notifications/org switching is structural only; live notification polling, offline handling, auth, and backend capabilities remain unchanged.
- Known limitation: Dev ERP does not currently have a REEBS-style order/POS source of truth or dedicated immutable receipt flow in the reviewed paths. Future shared payment/receipt work must preserve rent payment, accounting, invoice, report, and public-token behavior.
- Testing notes: verify the sidebar, mobile tabs, topbar spacing, hidden-module filtering in registry adapters, disabled-module visual state, Settings route access, Rent/Appointments route access, rent-only user view, Rent/Invoicing currency display, online/offline indicator visibility, invoice route lookup, and legacy `/users` target before future registry wiring.

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
- Dev ERP is production-sensitive. Treat auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, and AI/productivity endpoints as live-data risk areas.

## Auth And API

- the frontend boots from `/api/auth/session`
- session state is cookie-based rather than browser-readable token storage
- backend access is enforced by capability middleware and organization scoping, not only by frontend route visibility
- the shared API client in `src/api/client.ts` handles credentials, CSRF headers, JSON parsing, and normalized API errors

## Verify Changes

```bash
pnpm --filter @faako/dev-erp run test
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
