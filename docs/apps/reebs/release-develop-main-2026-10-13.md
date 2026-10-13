# Develop → main release checkpoint — 2026-10-13

Scope: latest committed REEBS Water follow-up and the user's Travel With Ease
foundation/code/documentation/lockfile work. Real environment files are excluded.

## Operator confirmations

- Include Travel With Ease in addition to Water.
- Production auto-deploy is active; the operator confirms the exact Water
  migrations were verified on staging and a restorable production backup exists.
- No Travel With Ease service auto-deploys from develop or main. Its deployed
  runtime remains explicitly disabled; this checkpoint is not TWE launch approval.

No production database, credentials or private environment files were inspected.
Pushing main can trigger the user's configured production deployment and existing
migration start command; no migrations are executed directly by this work.

## Changes and regression repair

- Water API example uses an absolute HTTPS origin; dashboard copy simplified.
- Preserve the TWE persistence, OIDC/session, content/media foundation and docs,
  with the staging/production startup guard intact.
- Mark only the disposable job-local PostgreSQL fixture URL as an intentional
  scanner exception; no security gate is disabled and no real secret is added.
- Develop CI run 38364949118 failed after a merge reintroduced retired Water
  schedule code and tests. Remove the undefined Settings references and obsolete
  schedule component/tests again. Current-price, backdated sale, permission,
  collection and stale-edit tests remain authoritative. No backend pricing,
  financial data or migration behavior is changed by this repair.
- Preserve Markdown hard line breaks using backslashes instead of trailing space.

## Local evidence

- TWE unit/HTTP/frontend tests: 23 passed; initial restricted loopback failures
  passed after rerunning with permitted local networking and synthetic data.
- TWE three-app lint, API syntax checks, Portal build/typecheck and Astro
  build/check passed. Builds used a source-only worktree without environment files.
- Focused Water/current-pricing/Settings regressions: 65 passed.
- Earlier Water follow-up: 9 tests, lint, build and secret-safe scan passed.
- Security gate, hosting policy, app/project registry and 36-package manifest
  checks passed; existing missing Water project metadata warning remains.
- Real PostgreSQL integration belongs to the new CI job's disposable database;
  mocked tests are not represented as database/provider acceptance.

Main promotion must wait for the release commit's develop CI, including the TWE
PostgreSQL integration job. Local checks do not establish hosted runtime health.
