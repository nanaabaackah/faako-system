# REEBS release-readiness evidence — 2026-08-29

This is repository/local-development evidence, not approval to deploy production.

| Area | Status | Blocking? | Action |
| --- | --- | --- | --- |
| Package JSON | Pass — 26 manifests | No | Keep prerequisite check first in CI |
| Conflict markers/tooling | Pass — 2,821 files; Node/pnpm/rg present | No | Keep prerequisite check first in CI |
| Lockfile | Pass — frozen install, already up to date | No | Never edit lockfile by hand |
| Lint | Pass — 0 errors; Portal 95 warnings, Website 8 warnings | No | Remove legacy disable/hook warnings gradually in owning modules |
| Typecheck | Pass — Website 139 files, 0 diagnostics | No | Portal has no separate TypeScript check |
| Unit tests | Pass — Portal 92, Website 8 | No | Retain in CI |
| Build | Pass — Portal Vite and Website Astro (1,125 pages) | No | Retain route/sitemap audits |
| Security scan | Pass — 2,217 files | No | Requires `rg`; filesystem based, no Git dependency |
| Security gate | Pass | No | App contract applies to package-backed apps |
| Prisma validate/generate | Pass | No | Run before deployment |
| Migrations | Pass — 56 found, development schema up to date | Manual production gate | Do not apply production migration from local; separate Railway migration runner before scale-out |
| API health | Pass — `/live`, `/ready`, DB ready | No locally | Configure Railway health path `/ready` |
| Portal smoke | Pass — local route smoke and login/auth unit coverage | Production verification required | Run authorized post-deploy workflow checks |
| Storefront smoke | Pass — routes, hydration, keyboard navigation, 404 | Production verification required | Run post-deploy smoke with production URLs |
| Water smoke | Pass — 12 browser tests plus Water readiness | Production verification required | Run authorized Water workflow and finance-scope check after deploy |
| Override without reason | Pass — browser records override with no reason field | No after backend restart | Restart the currently running old local backend once |
| Payment smoke | Partial — checkout start and webhook auth pass; no direct Paystack initialization exists | Manual if payment route is enabled | Run provider sandbox notification/reconciliation without a real charge |
| Monitoring | Repository registration pass | External verification required | Apply thresholds, `/ready`, incident deduplication, maintenance behavior |
| Backup | Unverified | **Yes** | Verify provider backup, retention, owner, and evidence |
| Restore procedure | Documented; not tested | **Yes** | Complete isolated restore drill and record evidence |
| Commercial config/data | **Fail — 11 active REEBS products missing a positive selling price** | **Yes** | Review and correct through approved product configuration; do not guess prices |
| Reconciliation | **Fail — 2 order subtotal discrepancies** | **Yes** | Investigate order/line snapshots; do not auto-correct financial history |
| Water commercial config | Pass in development readiness/data check | Production verification required | Confirm authorized selling/cost configuration without exposing values |
| Rollback/forward fix | Documented | No | Record actual prior deployments and migration choice per release |

REEBS must not be described as production-ready while the backup/restore evidence, 11 missing REEBS selling prices, and 2 order subtotal discrepancies remain unresolved. Water stayed separate throughout these checks; no Water revenue, cost, customer, or profitability data was folded into core REEBS checks.
