# Water historical pricing — handoff and manual Git flow

> Historical handoff, superseded on 2026-10-07. Scheduled pricing has since
> been removed in favor of current product prices and informational audit
> history. Do not use the implementation steps below as current instructions.

## Scope and findings

The Settings payload builder and commercial configuration API rejected past dates
even though sale creation/edit correctly resolved prices at the sale date.
Historical Water product schedules are now accepted; generic commercial rules
retain their existing date restriction. No migration or automatic data change is
needed. Nothing has been deployed, committed or pushed by this task.

See [historical pricing behavior and staging checks](water-historical-pricing.md)
for exclusive date boundaries, preserved future periods, transaction snapshots,
quantity tiers, auditing and remaining live-database verification.

## Changed files

- API scheduling: `backend/functions/_shared/commercialConfig.js`,
  `backend/functions/commercial-config.js` (both under `apps/reebs-portal`).
- Safe missing-price guidance: `backend/modules/water/actionErrors.js`.
- Settings: `src/pages/AdminSettings/AdminSettings.jsx`, `AdminSettings.css`,
  `commercialSettings.js`, new `WaterPricePeriodFields.jsx`.
- Tests: shared `commercialConfig.test.js`, new `commercial-config.history.test.js`,
  new `water-historical-sales.handler.test.js`, Settings `commercialSettings.test.js`,
  new `tests/water-price-history.spec.ts`.
- Documentation: portal `docs/WATER_ARCHITECTURE.md`, repository
  `docs/apps/reebs/water-architecture.md`, `water-historical-pricing.md` and this handoff.

Sale-handler business logic is unchanged. The new real-handler tests exercise
historical create/edit, retail→bulk→retail, channel and date changes, price-only
overrides, denied overrides, missing prices and coherent totals/costs/payments/
stock/dashboard summaries. Schedule-handler tests prove there are no sale writes,
future/older records survive, and owner/admin permissions and tenant/product/type
scoping are preserved. These database fixtures are isolated, not live PostgreSQL.

## Validation results

- **99 focused Node tests passed**, including existing pricing, permissions,
  restock, dashboard, error-adapter and Settings regressions.
- **6 mocked browser tests passed**: 320px, 768px and 1440px, light/dark themes.
  Covered both scheduling forms, date selection, keyboard open/Escape/focus return,
  historical notice, payload, save feedback, expired-history visibility and control
  bounds. Fixed nested price-field/tablet overflow using the available panel width.
- Focused ESLint passed for changed JavaScript/JSX files; portal Vite production
  build passed. The build reported an existing outdated Browserslist dataset warning.
- All commands used an explicit clean environment and skipped environment files;
  no real database, provider credential or external API was required.
- Full repository CI and real PostgreSQL/staging workflows were **not** run.
  Complete the staging checklist after the develop deployment; create genuine
  historical schedules there rather than assuming this code seeds any prices.

## Manual Git flow to develop

Run these yourself from the repository root. Do **not** use the old merge-commit
snippet in the October 2 conflict-resolution document for this new feature.

First inspect state (these commands do not print file contents or secrets):

```sh
git branch --show-current
git status
git diff --name-only --diff-filter=U
```

Continue below only if the branch is `develop`, no merge/cherry-pick/rebase is
in progress, and there are no unmerged files. If not, stop and reconcile the
existing operation first; do not reset/discard your working changes. The current
branch has not been checked by this task.

Create a new branch carrying the working changes:

```sh
git switch -c fix/reebs-water-historical-pricing
```

Stage only this fix, not secret files, build output, browser artifacts or unrelated
work. Do not use `git add .`:

```sh
git add \
  apps/reebs-portal/backend/functions/_shared/commercialConfig.js \
  apps/reebs-portal/backend/functions/_shared/commercialConfig.test.js \
  apps/reebs-portal/backend/functions/commercial-config.js \
  apps/reebs-portal/backend/functions/commercial-config.history.test.js \
  apps/reebs-portal/backend/functions/water-historical-sales.handler.test.js \
  apps/reebs-portal/backend/modules/water/actionErrors.js \
  apps/reebs-portal/src/pages/AdminSettings/AdminSettings.jsx \
  apps/reebs-portal/src/pages/AdminSettings/AdminSettings.css \
  apps/reebs-portal/src/pages/AdminSettings/commercialSettings.js \
  apps/reebs-portal/src/pages/AdminSettings/commercialSettings.test.js \
  apps/reebs-portal/src/pages/AdminSettings/WaterPricePeriodFields.jsx \
  apps/reebs-portal/tests/water-price-history.spec.ts \
  apps/reebs-portal/docs/WATER_ARCHITECTURE.md \
  docs/apps/reebs/water-architecture.md \
  docs/apps/reebs/water-historical-pricing.md \
  docs/apps/reebs/water-historical-pricing-handoff-2026-10-04.md

git diff --cached --stat
git diff --cached --check
```

Confirm the staged list contains only intended changes. Existing staged work or
unrelated edits within those files need separate review before committing.

```sh
git commit -m "fix(reebs): support historical Water price schedules"
git fetch origin
git merge origin/develop
```

If the merge reports conflicts, stop here and resolve/test them before proceeding.
Do not select one entire side blindly. Do not force-push.

```sh
git push -u origin fix/reebs-water-historical-pricing
gh pr create --base develop --head fix/reebs-water-historical-pricing \
  --title "fix(reebs): historical Water pricing" \
  --body "Allow historical Water-only schedules, preserve future periods and sale snapshots, add history UI and regression coverage. No migration required."
gh pr checks --watch
```

When required CI checks pass, review and merge that PR **into develop**, then
perform the staging checks linked above. Without GitHub CLI, use GitHub's
“Compare & pull request” with base `develop` and the new branch as compare.
This flow does not push/merge `main` or intentionally trigger a production release;
merging develop may trigger the existing staging deployment workflow.
