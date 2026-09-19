# REEBS concise operations runbooks

## Deployment failure

Stop the rollout, identify whether build, migration, API, Portal, or Website failed, and preserve request/build IDs. Keep the last healthy components serving when contracts remain compatible. For a migration failure, do not rerun blindly. Compare `_prisma_migrations`, migration SQL, and actual schema; choose a reviewed resolve, forward fix, or restore. Rerun checks before resuming.

## Database unavailable

Confirm `/live` is alive and `/ready` is unavailable, then check Railway database status, connection limits, SSL settings, and recent deploy/migration activity without printing the URL. Pause writes if partial connectivity risks duplicate operations. Recover connectivity, run migration status plus read-only consistency checks, then validate core and Water separately.

## Payment provider or notification issue

Disable or communicate the affected payment route without changing recorded financial history. Preserve provider reference, REEBS request ID, sale/order ID, and timestamps—never credentials. For Water MoMo, replay the same provider event only after confirming the target sale and amount; the current update is repeat-safe but lacks a durable provider-event ledger. Reconcile provider records to REEBS before marking paid. Use forward corrections, not destructive reversal.

## Storefront outage

Confirm Cloudflare status and the public home, catalogue, product, cart, and checkout routes. If the API is healthy and only the frontend failed, restore the previous Pages deployment. If the API contract caused the outage, restore a compatible frontend or forward-fix the backend first. Validate SEO routes and checkout after recovery.

## Water module outage

Check API `/ready`, then `/health/water`. Verify Water role permissions, `waterProductConfig`, selling price, internal cost, inventory product linkage, and recent Water migrations. Do not substitute core REEBS price/revenue data. Restore the last compatible API/Portal or forward-fix configuration, then run authorized Water smoke and confirm core metrics remain unchanged.

## Commercial pricing misconfiguration

Block the affected transaction path; do not fall back to guessed or hardcoded prices. Run the read-only consistency check and inspect authorized configuration. Correct configuration through the existing controlled settings/Water flow with audit permissions. Verify selling price, internal Water cost, delivery/tax/deposit rules, and transaction snapshot behavior. Never expose Water cost publicly.

## Migration failure

Keep new code from serving if it requires the failed schema. Record the migration name and database error without credentials. Determine whether no SQL, some SQL, or all intended SQL applied. Do not reset a shared database. Review backup/forward-fix choices; use Prisma resolve only after schema evidence proves the selected state. Verify status, API readiness, core records, and Water records before continuing.
