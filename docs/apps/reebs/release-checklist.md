# REEBS release checklist

## Before deployment

- [ ] Approved code is merged by the operator; scope and affected shared packages are recorded.
- [ ] `pnpm run release:prerequisites` passes.
- [ ] `pnpm install --frozen-lockfile` passes. If it fails, regenerate the lockfile from reviewed manifests in a separate change; do not edit it by hand.
- [ ] Portal tests, lint, build, Prisma validate/generate/status, and Water browser smoke pass.
- [ ] Website tests, lint, typecheck, build, route/sitemap checks, and focused browser smoke pass.
- [ ] Security scan, security gate, hosting check, and monitoring registry check pass.
- [ ] Migration SQL is reviewed; backup/forward-fix implications and the one-time migration runner are identified.
- [ ] Production variable **names** match both `.env.example` contracts; values are verified in their provider, never copied into notes.
- [ ] REEBS selling prices and workflow-specific delivery/tax/deposit settings are verified.
- [ ] Water selling price, internal cost, permissions, inventory, payment route, expenses, and standalone finance/report scope are verified.
- [ ] Backup status, rollback target, and release owner are recorded.

## Deployment

- [ ] Use a maintenance window if the migration/deploy could cause expected alerts; retain health sampling.
- [ ] Run the reviewed production migration once and verify migration status.
- [ ] Deploy the backward-compatible API and confirm `/live`, `/ready`, and `/health/water`.
- [ ] Deploy the Portal, then the Website.
- [ ] Run `pnpm run release:smoke:reebs` with the three production base URLs set.
- [ ] Run authorized Portal checks: login, dashboard, bookings, customers, inventory, invoices, settings, and mobile.
- [ ] Run authorized Water checks: navigation, roles, product/pricing, cost visibility, sale/order capability, inventory, payments, expenses, finance/reports, and mobile.
- [ ] Validate storefront homepage, catalogue, product, SEO/structured data, cart, checkout start, customer login, analytics consent, and mobile.
- [ ] Validate payment in provider test/sandbox mode where available; do not charge a real payment method.
- [ ] Confirm monitoring is green and no duplicate incident was created.

## Release notes template

```text
Release: <safe build reference and date>
User-visible changes: <concise summary or none>
Operational changes: <health, CI, deployment, monitoring>
Migrations: <names and additive/destructive classification or none>
Configuration keys: <names only or none>
Known limitations: <specific>
Rollback/forward-fix: <selected approach and previous deploy>
Validation: <checks and operator>
```

## Rollback

- Frontend: restore the previous known-good Cloudflare deployment.
- Backend: restore the previous known-good Railway deployment only if it remains schema-compatible.
- Configuration: restore the previously recorded provider configuration version; do not paste secret values into tickets or logs.
- Database: do not assume rollback is safe. Prefer a forward fix for additive migrations and all payment/financial corrections. Restore only through the provider runbook with an approved restore point.
- After rollback/forward-fix: rerun health, release smoke, Water validation, payment validation, and monitoring checks.
