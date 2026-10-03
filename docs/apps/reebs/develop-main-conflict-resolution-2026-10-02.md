# REEBS develop/main conflict resolution — 2026-10-02

Local working-tree reconciliation only. No Git commands, deployment, migration,
real environment-file access or database operations were performed.

## Decisions

- Retained the approved Dashboard composition, chart series, shared API client,
  partial-section errors, permission-filtered finance data, period-scoped activity,
  Faako controls, arrow actions and responsive Quick Access behavior.
- Retained product-scoped Water ledgers for the 15-pack and 30-piece sachet pack,
  separate Core/Water metrics, owner/admin-only purchase-cost and price correction
  permissions, and usable retail pricing when another tier is unconfigured.
- Invoice viewing keeps recorded totals, taxes, delivery and booking service fees.
  A legacy delivery recalculation survived automatic merging outside the conflict
  blocks; it was removed. Delivery is represented as one recorded charge, with an
  explicit arithmetic assertion added to the invoice-opening regression.
- Preserved the health OPTIONS allowlist and its database-free preflight tests.
- Kept TTNGH's main-side shared blur tokens, which are defined in its global theme
  and already used by adjacent components, instead of hardcoded pixel values.
- Retained the latest Water architecture and roadmap checkpoint documentation.

There were 28 conflicted files in the inspected source/document scope, including
three absent from the supplied list: TTNGH's home/partners stylesheet and the
two docs/apps/reebs Water/roadmap documents. Unconflicted surrounding content
was retained; this was not a whole-file replacement from one branch.

## Validation

- 114 distinct Node tests passed: 105 focused REEBS tests, six API server tests
  and three TTNGH configuration tests. The strengthened three-test invoice suite
  also passed on rerun. The first run exposed the auto-merged delivery declaration;
  this was corrected rather than masking the failing test.
- Scoped source ESLint and six resolved stylesheet syntax checks passed.
- The Portal production build passed (1,639 modules). The first attempt ran out
  of disk space copying public images; only three known agent-generated temporary
  build folders were removed, then the full build succeeded. No source/assets
  were deleted. An outdated Browserslist dataset remains a non-blocking warning.
- Security scan passed (3,082 non-ignored files); security gate passed.
- Browser suite: 53 of 54 cases passed initially. The Dashboard 768px case timed
  out during page navigation while the environment was under disk pressure; its
  isolated rerun passed without source changes (11.3 seconds). All 54 distinct
  cases passed across runs, covering Water, invoicing and Dashboard behavior,
  roles, themes, accessibility and mobile/tablet/desktop layouts.

Tests use mocked data and explicit test configuration with environment-file
loading disabled. No production readiness or database state is certified.

## Manual completion

First inspect the current operation and file list. If this is not the intended
merge on develop, stop rather than committing a different operation.

```bash
git status
git branch --show-current
git diff --name-only --diff-filter=U
git diff --check
```

Review the resolved files, then stage the exact paths (including the new invoice
regression assertion and this report):

```bash
git add -- \
  apps/reebs-portal/backend/functions/dashboardOverview.js \
  apps/reebs-portal/backend/functions/generateInvoice.js \
  apps/reebs-portal/backend/functions/getInvoiceDetails.js \
  apps/reebs-portal/backend/functions/water-dashboard.test.js \
  apps/reebs-portal/backend/functions/water.js \
  apps/reebs-portal/backend/modules/dashboard/dashboardRepository.js \
  apps/reebs-portal/backend/modules/dashboard/dashboardRepository.test.js \
  apps/reebs-portal/backend/modules/water/dashboardAccess.js \
  apps/reebs-portal/backend/server.js \
  apps/reebs-portal/backend/server.test.js \
  apps/reebs-portal/docs/WATER_ARCHITECTURE.md \
  apps/reebs-portal/src/app/roadmapModuleIntegrity.test.js \
  apps/reebs-portal/src/pages/AdminDashboard/AdminDashboard.css \
  apps/reebs-portal/src/pages/AdminDashboard/AdminDashboard.jsx \
  apps/reebs-portal/src/pages/AdminDashboard/useDashboardOverview.js \
  apps/reebs-portal/src/pages/AdminWater/AdminWater.css \
  apps/reebs-portal/src/pages/AdminWater/AdminWater.jsx \
  apps/reebs-portal/src/pages/AdminWater/components/WaterPricingCard.jsx \
  apps/reebs-portal/src/pages/AdminWater/components/WaterRestockCard.jsx \
  apps/reebs-portal/src/pages/AdminWater/waterPeriodUtils.test.js \
  apps/reebs-portal/tests/dashboard.spec.ts \
  apps/reebs-portal/tests/invoicing-responsive.spec.ts \
  apps/ttngh/src/styles/pages/about.css \
  apps/ttngh/src/styles/pages/error.css \
  apps/ttngh/src/styles/pages/events.css \
  apps/ttngh/src/styles/pages/home/partners-story-programmes.css \
  docs/apps/reebs/water-architecture.md \
  docs/apps/reebs/roadmap-process-integrity-audit.md \
  apps/reebs-portal/backend/functions/invoice-opening.test.js \
  docs/apps/reebs/develop-main-conflict-resolution-2026-10-02.md
git diff --cached --check
git diff --cached --stat
git diff --name-only --diff-filter=U
```

The last command must return no files. If it lists more files, do not commit:
they need review too. Review the full staged diff and CI before release.

```bash
git commit -m "merge: reconcile main with current REEBS develop changes"
git push origin develop
```

This updates the existing develop → main PR. It does not merge or push main.
Merging that PR may trigger production deployment and configured migrations;
this conflict-resolution pass does not authorize or verify those operations.
