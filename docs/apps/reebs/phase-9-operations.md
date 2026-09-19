# REEBS Phase 9 operations and release readiness

Last reviewed: 2026-08-29

This document describes the implementation that exists in this repository. It does not claim that external Railway, Cloudflare, monitoring, or database-backup settings were changed or verified.

## Deployment architecture

```text
GitHub change
  -> Monorepo CI prerequisite checks and frozen install
  -> REEBS Portal/API and REEBS Website checks in parallel
  -> reviewed production migration (currently invoked by API startup for compatibility)
  -> Railway REEBS API deploy
  -> Cloudflare Portal deploy
  -> Cloudflare REEBS Website deploy
  -> read-only release smoke
  -> existing Faako monitoring registry
```

The API is the only database-owning REEBS component. The Portal is a React/Vite application. The public Website is an Astro static site with limited React islands. Water is a standalone domain behind the REEBS API and database; Water readiness never contributes revenue or cost to core rental/event health or metrics.

## Environments

| Environment | Frontends | Backend | Database/config | Deployment and monitoring |
| --- | --- | --- | --- | --- |
| Local development | `http://localhost:5174`, `http://localhost:5173` | `http://localhost:8888` | `.env` plus `.env.development`; `DATABASE_URL_DEVELOPMENT`; isolation guard | Local processes; `/live`, `/ready`, `/health/water` |
| Hosted development | Not verified to exist | Not verified | Not verified | Do not treat a preview deployment as a durable environment without recording its URLs and database boundary |
| Production | `https://portal.reebspartythemes.com`, `https://reebspartythemes.com` | `https://api.reebspartythemes.com` | Railway environment variables and production Postgres; values are not documented here | Railway API, Cloudflare Pages frontends, Faako monitoring registry |

There is no verified REEBS staging environment. The presence of an env file or a branch name does not create one.

Compare key names without reading or printing values:

```bash
pnpm run env:contract:reebs
pnpm --filter @faako/reebs-portal run env:drift:dev
node scripts/check-env-contract.mjs apps/reebs-portal/.env.example --target /safe/path/to/exported-production-key-names.env
```

## Migration flow

Before Phase 9, Prisma commands directly selected environments through shell prefixes and the production server ran `generate -> migrate deploy -> start` on every process startup. That remains the deployed compatibility path because changing it requires a verified Railway pre-deploy/release command.

Now all migration commands pass through `scripts/runPrismaCommand.mjs`. Production deploy requires production context plus either Railway's production environment marker or `REEBS_ALLOW_PRODUCTION_MIGRATION=true`. Development reset has a separate explicit opt-in. Commands do not print database URLs.

```bash
pnpm --filter @faako/reebs-portal run db:validate:dev
pnpm --filter @faako/reebs-portal run db:generate
pnpm --filter @faako/reebs-portal run db:status:dev
pnpm --filter @faako/reebs-portal run db:deploy:dev

# Controlled production release job only:
REEBS_ALLOW_PRODUCTION_MIGRATION=true pnpm --filter @faako/reebs-portal run db:deploy:prod
pnpm --filter @faako/reebs-portal run db:status:prod
```

Never use development reset against shared data. Never use `migrate resolve --applied` until the database schema has been compared with the migration SQL and the failed migration is known to be fully represented.

Remaining migration risk: Railway startup still runs the production migration once per starting instance. Before separating it, configure and verify a single Railway pre-deploy migration command, then change the application start to `server:prod`. Until that manual platform change is ready, keep one deploying instance and do not roll out concurrent API replicas during migrations.

## CI and repository gates

The monorepo workflow now fails early on tooling prerequisites, invalid or duplicate package manifests, merge-conflict markers, a frozen-lockfile install, environment-contract format, security scan/gate, and monitoring registration. Shared-package and root tooling changes trigger REEBS checks. Portal CI uses an isolated Postgres service for Prisma validation, generation, migration status, read-only consistency checks, tests, lint, build, and Water smoke. Website CI runs lint, Astro typecheck, tests, build, route/sitemap validation, and focused browser smoke.

App registration rule: a deployable directory under `apps/` with its own `package.json` must provide the platform `appSystem.js` contract. Deferred names or non-package directories are not applications. Security tooling scans the filesystem through `rg`; it does not depend on Git state.

## Runtime health and dependencies

| Endpoint | Meaning | Status behavior |
| --- | --- | --- |
| `GET /live` | Process is responding | 200 while the process is alive |
| `GET /health` | Safe service/build/database summary | 200 with `ready` or `degraded` status |
| `GET /ready` | Database-backed traffic readiness | 200 ready; 503 unavailable |
| `GET /health/water` | Database plus Water commercial configuration | 200 ready; 503 unavailable; no prices or costs returned |

Database checks use `SELECT 1`, a one-connection pool, and a bounded timeout. Health output includes only service, safe build reference, timestamp, and dependency status. Set `REEBS_BUILD_REFERENCE` to a safe commit SHA or release identifier.

Dependency classification:

| Dependency | Criticality | Behavior |
| --- | --- | --- |
| Postgres | Critical | Blocks readiness and production operations |
| Water commercial config | Critical to Water only | Blocks Water readiness; does not change core REEBS health or metrics |
| Brevo email | Degraded | Request-bound, 10-second timeout, no automatic write retry; completed transactions are not rolled back for booking email failure |
| Water MoMo webhook | Critical only when that payment route is enabled | Shared-secret authentication and repeat-safe state assignment; provider end-to-end verification remains manual in non-production |
| Maps/geocoding | Optional/degraded | Map/geocoding functions may be unavailable without blocking API readiness |
| Analytics service | Optional/degraded | Bounded timeout; core operations remain available |
| Browser storage/offline sync | Client-local | Server remains authoritative when queued actions reconnect |

Production startup fails if the database configuration or a 32-character `USER_APP_SECRET` is missing. Optional integrations degrade at their feature boundary.

## Monitoring

The existing Faako registry includes the Portal, public Website, API health/readiness, public catalogue routes, and Water readiness. Railway must use `/ready` as the traffic health check. Suggested alerting is three consecutive failures over roughly three minutes for API readiness, storefront, and Water readiness; tune to the capabilities of the existing monitor. Keep health samples active during maintenance windows while suppressing expected deployment notifications.

Alert-to-incident association and database-provider backup alerts are not verifiable from repository code. Configure them in the existing monitoring system; do not create a second monitor. Deduplicate incidents by monitor/site plus active outage window.

Dependency status should be read as:

```text
Storefront -> REEBS API
REEBS Portal -> REEBS API
REEBS API -> Postgres (critical)
REEBS API -> email/maps/analytics (degraded or optional)
Water -> REEBS API -> Postgres + Water config (standalone critical path)
```

## Background work and reliability inventory

No server cron scheduler, durable worker, or distributed queue was found in the REEBS apps.

| Job/action | Current mechanism | Idempotent | Multi-instance safe | Risk | Next action |
| --- | --- | --- | --- | --- | --- |
| API GET retry | Request-bound, max two retries with backoff | Yes, GET only | Yes | Low | Retain bounded policy |
| API concurrency queue | Process-local request admission | N/A | Each instance has its own limit | Medium under scale-out | Reassess per-instance limits before adding replicas |
| Analytics call | Request-bound with abort timeout | Read-only | Yes | Low | Monitor degraded responses |
| Booking email and manager notification | Request-bound after transaction commit | No persistent email idempotency | Duplicate sends possible on repeated business requests | Medium | Add an outbox/idempotency record during booking module review |
| Invoice email | Request-bound | No persistent send key | Manual repeat may duplicate | Medium | Add delivery record/idempotency during invoicing review |
| Water MoMo notification | Request-bound webhook assigning current payment state | Effectively repeat-safe for the same sale/reference | Yes at database row level; no unique provider-reference constraint | Medium | Add provider event ledger/unique event ID in Water/payment review |
| Offline POS/payment/inventory/booking queues | Browser-local queue | Partial; server validation and existing keys remain authoritative | Not a server worker | Medium if browser storage is lost | Review each queue with its owning module |
| Prisma migration | Deployment task | Prisma migration history | Unsafe if multiple starts race operationally | High until separated | Configure a single Railway pre-deploy step |
| Imports/backfills/seeds/maintenance | Manual scripts | Script-specific | Not generally safe concurrently | Medium/high | Run only from documented operator procedure with dry-run where available |

Email, messaging, and provider failures are bounded and logged without provider response bodies. There is no automatic retry of unsafe mutations. Some older handlers still use direct `console` calls; migration to the structured logger is deferred to the owning module rather than a broad rewrite.

## Structured logs and shutdown

The API assigns or safely accepts `X-Request-Id`, returns it in responses, and forwards it to function adapters. API adapter, startup, fatal error, and shutdown records include time, numeric level, application, component, environment, and safe request context. Logger redaction covers credentials, auth headers/cookies/tokens, database URLs, API keys, and Water cost fields.

`SIGTERM` and `SIGINT` stop accepting new connections, close the server and health pool, and enforce a bounded grace period. Unhandled rejections and uncaught exceptions are logged as fatal shutdown triggers rather than silently swallowed.

## Commercial configuration and read-only reconciliation

`release:data-check:dev` and guarded `release:data-check:prod` execute a read-only transaction. They report counts only and never repair data. Checks cover invalid order totals, orphan payments, negative active inventory, Water sales without Water product scope, missing REEBS selling prices, missing Water selling/cost configuration, order subtotal/balance discrepancies, and Water transaction snapshot discrepancies.

Invoice documents currently calculate totals from JSON line items and do not persist a paid/balance ledger in the invoice table, so an independent invoice balance reconciliation is not possible. Reconcile invoice documents against their linked order/booking and payment ledger manually until the invoicing module owns a durable balance model.

Delivery-fee, tax, and deposit configuration must also be reviewed manually because their applicability is workflow-specific. A missing required selling price is a release blocker; Water cost remains internal and Water revenue remains separate from core rental/event totals.

## Backup, restore, RPO, and RTO

Repository code does not prove that Railway backups are enabled, their frequency, retention, or owner. Treat backup status as **unverified and blocking for production-readiness claims** until an operator records provider evidence.

- Backup owner: TBD
- Provider backup frequency: TBD / verify in Railway
- Retention: TBD / verify in Railway
- Approved RPO: TBD
- Approved RTO: TBD
- Last successful restore test: not recorded

Restore procedure:

1. Declare the incident, freeze writes if required, and record the requested restore point.
2. Preserve the affected database and logs; do not reset or overwrite it as a routine fix.
3. Restore the provider snapshot into an isolated database first where supported.
4. Point an isolated API instance at it, run Prisma validation/status, then the read-only consistency command.
5. Validate users/auth, customers, bookings, inventory, payments, invoice documents, and core financial totals.
6. Separately validate Water products, selling price, cost price under authorized access, orders, inventory, expenses, payments, and Water-only finance/report totals.
7. Confirm Water data has not been merged into core revenue/profitability.
8. Approve either provider promotion, controlled connection switch, or a forward fix. Record downtime and lost-data window.
9. Run release smoke and monitoring checks, then re-enable writes.

Do not consider backups operationally proven until this restore checklist has succeeded and the evidence/date/owner are recorded.

## Deployment matrix

| Component | Platform | Build | Deploy | Health check | Manual steps |
| --- | --- | --- | --- | --- | --- |
| REEBS Portal frontend | Cloudflare Pages | `pnpm --filter @faako/reebs-portal build` | Pages deploy | `/login`, `/admin` route smoke | Root directory, Node/pnpm versions, API URL, output `apps/reebs-portal/dist` |
| REEBS API | Railway/Nixpacks | root `railway-service.mjs build` -> Prisma generate | root start currently selects `server:with-migrate` | `/live`, `/ready` | Set `RAILWAY_WORKSPACE`, secrets, production DB, health path; separate migration before scale-out |
| REEBS Website | Cloudflare Pages | `pnpm --filter @faako/reebs-website build` | Pages deploy | home/catalogue/product/cart/checkout smoke | Root directory, Node/pnpm, API URL, output `apps/reebs-website/dist` |
| Database | Railway Postgres | Reviewed Prisma migration | Controlled `db:deploy:prod` | API `/ready`, migration status, consistency check | Verify backup/restore, single migration runner, approval |
| Water critical path | Portal/API/Postgres | Included above | Backend before frontend | `/health/water` plus authorized browser smoke | Verify role, commercial config, Water-only finance, test payment notification |

Deploy compatible backend changes before frontends. Remove deprecated API compatibility only in a later, separately verified phase.

## Hard blockers and soft warnings

Hard blockers: invalid package JSON, conflict markers, frozen-lockfile failure, security scan/gate failure, Prisma validation or migration failure, build failure, required test/smoke failure, unavailable database, missing mandatory production config, missing required REEBS/Water selling price, missing Water internal cost where profitability is required, or unreviewed destructive migration.

Soft warnings: optional analytics/maps/email degradation where the affected feature is explicitly disabled or communicated, a small reviewed bundle regression, or one transient latency sample below the alert threshold. A warning becomes blocking when it affects checkout, payment confirmation, required notifications, Water operations, auth, or data integrity.

## Manual external-platform actions

- Railway: verify `RAILWAY_WORKSPACE=@faako/reebs-portal`, Node/pnpm build path, restart policy, production variables, `/ready` health path, and a single pre-deploy migration command before decoupling startup migrations.
- Cloudflare: verify each project root, build command, `dist` output, Node/pnpm versions, production API URL, redirects, and headers.
- Database: verify backups, retention, owner, restore capability, and conduct an isolated restore drill.
- Monitoring: apply thresholds, incident deduplication, maintenance-window policy, and any required monitor secrets.
- Payment/email/maps: use non-production provider credentials for validation; never perform real charges or send test messages to customers.

Feature flags found: `VITE_ENABLE_GA_IN_DEV` (local analytics owner: storefront/platform; remove only if local analytics testing is retired) and `VITE_ENABLE_APP_UPDATE_NOTICE` (local testing override; production is enabled automatically). No new flag platform is introduced.
