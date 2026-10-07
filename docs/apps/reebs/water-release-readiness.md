# Water release readiness — 2026-09-27

## Decision

The completed automated checkpoints below pass, including the final theme/dialog
rerun. **Production use is not yet cleared.** Complete the
isolated staging checks below before promotion. The repository security gate now
passes after completing the owner-authorized TTNGH metadata. No live database,
credentials, provider, deployment or Git operation
was accessed/performed in this review. Build output uses dummy API addresses and
is verification output, not a release artifact.

Water remains separate from Core rentals/events. The public Shop/Booking pause
does not pause internal Water sales. Faako cards, navigation and theme were not
redesigned. Financial/history registers received no new bulk archive.

Pricing note (2026-10-07): the former Water price-schedule flow has been removed.
Current Retail, Company and Bulk prices now live in `waterProductConfig`;
`waterPriceChange` is audit-only. The new migration must be reviewed and applied
before the current-price API is deployed. The prior scheduling verification
below records historical evidence and does not certify this newer migration.

## Verified locally

| Check | Evidence |
| --- | --- |
| Portal unit/handler suite | 495 passed, fresh test environment, dummy database/provider values |
| Water browser suite | 21 passed, mocked API, 320–1440px; new/restated costs, sales-only staff, missing costs, loading and ledgers |
| Additional theme/dialog audit | Final 7/7 rerun passed: both Water themes, nested select Escape/Tab, focus wrap/return, Payments 320px, Booking desktop/mobile/expense linkage, Reports |
| Prior combined browser checkpoint | 23 passed: Water, Rentals and Reports; separate operational/Directory and modal checks recorded in process audit |
| Public commerce pause | API early-rejection tests, 390/1440px browser checks, browse/structured-data check; enabled-commerce tests intentionally skipped |
| Builds | Portal 1,632 modules; Astro storefront 1,125 pages |
| Storefront verification | 23 tests; 1,125 HTML routes (22 rental and 1,045 shop details); 1,119 sitemap URLs |
| Lint/types | Portal zero errors/11 existing warnings; website zero errors/one existing warning; shared UI and Astro typechecks pass |
| Secret-safe scan | Passed, 2,980 non-ignored workspace files; sensitive paths are rejected without opening their contents |
| Security gate | Passed after completing the existing TTNGH app metadata; security checks were not disabled |
| Hosting readiness | Passed for non-deferred apps; TTNGH alone is explicitly deferred because Cloudflare is not configured |
| TTNGH/hosting regression checks | Six focused tests passed, including the two secret-path scanner tests; changed JavaScript lint and registry checks pass |

The broader post-dialog run initially passed 30/32: a Payments cold-load timeout
during simultaneous builds and a Water SelectField fast-Tab timing issue failed.
The Tab path was fixed for both trigger and listbox focus; the isolated **7/7**
rerun includes both affected cases. Those earlier failures are not counted as
passes. Light and dark mobile restock screenshots were visually reviewed.
`@faako/types` also passes typecheck after documenting nullable cost/finance DTOs.

The root scanner now classifies credential-named data exports by path and stops
before content reads if such a path is present. Its two regression tests pass.
Its file list is non-ignored workspace files, **not** the Git index; separately
review staged filenames before committing. No secret file was opened or changed.

### Water fixes made during readiness review

- Shared purchase-cost/COGS calculations keep missing historical costs unknown in
  both API and Portal. New empty stock ledgers require explicit purchase cost.
  Reads do not fill old sale costs from current prices or a compatibility amount.
- Cost/pricing helpers now enforce owner/admin only, matching the backend action
  policy and private response projection. Water staff retain sales operations.
- Legacy MoMo callbacks use the error-aware database client, stop backfilling
  unrelated sale references, and cannot settle archived sales. Handler tests
  cover exact replay, tenant mismatch, wrong/missing amount and wrong currency.
- Removed an unused linked-product price fallback that referenced an undefined
  constant. Vendor linkage remains separate from authoritative Water prices.
- At this checkpoint, the Water health probe checked effective `waterProductPrice`
  tiers and the Water discount rule. The current-price implementation replaces
  this with checks of the three current prices in `waterProductConfig`.
- Summary labels use existing Faako text tokens for contrast. The refresh button
  is labeled, and Water's existing modal layout reuses the shared dialog lifecycle
  for initial/return focus, Tab containment, scroll lock and Escape. Select/date
  popovers receive the first Escape; SelectField has a linked listbox and returns
  focus on Tab. No branding or layout was replaced.

### Final bundle inspection

Raw emitted asset totals, not a user's per-page download: Portal JS **2,863.4 KiB**
versus **2,840.7 KiB** before this table/public-pause pass (+22.7 KiB), CSS
**5,653.4 KiB** versus **5,651.9 KiB** (+1.5 KiB). Website JS **981.0 KiB** versus
**976.2 KiB** (+4.8 KiB); CSS unchanged at **919.2 KiB**. PDF/maps remain separate
chunks. Portal entry remains **86.8 KiB**, above the 80 KiB review budget. This is
a correctness/accessibility pass, not a bundle reduction; repeated CSS output is
still debt.

## Required manual staging checks

Use isolated staging accounts/data. Do not run destructive tests in production,
copy production credentials, or create real payment charges for this checklist.

1. **Release identity and data:** confirm Railway API and Cloudflare Portal use
   the intended reviewed revision, staging API origin and staging-only database.
   Review migration status, including the previously reported failed Water
   migration. Take/verify a backup and rollback plan before any approved migration.
   Do not reset the database or mark a failed migration applied without checking
   every statement. No new migration was introduced by this readiness pass.
2. **Health:** `/live` means HTTP process alive. `/ready` performs a bounded
   database `SELECT 1`. `/health/water` additionally looks for at least one
   organisation with exactly one current GHS price for each retail/bulk/company
   tier and one current Water discount rule. It rejects missing/overlapping rows
   in that candidate set and returns status only. It does **not** verify every
   tenant, stock, historical costs, provider connectivity or migration history.
3. **Correct organisation:** sign in to the intended organisation. Verify current
   and current Retail, Company and Bulk prices on the Water page, plus the Water
   discount limit. Owner/admin
   must see purchase-cost and finance controls; a Water-only account must not see
   them or write stock/expense/adjustment/pricing changes via forged API requests.
   Another organisation's record IDs must not read/change Water records.
4. **Stock and cost:** record test stock with its real test purchase cost; reload
   and verify quantity and cost. Record a sale, then correct that restock cost and
   reload both views. Confirm snapshots/profit change while stock quantity and
   payment facts remain unchanged. Adding a later restock must not rewrite older
   cost snapshots. Old unknown snapshots remain unavailable until a reviewed,
   explicit correction; never silently backfill from a guessed value.
5. **Arithmetic fixture (isolated data only):** 100 packs at GHS 22.50, then a paid
   cash sale of 3 at GHS 27.00 yields stock 97, revenue GHS 81.00, COGS GHS 67.50
   and gross profit GHS 13.50. Correcting purchase cost to GHS 23.00 yields COGS
   GHS 69.00/gross profit GHS 12.00. Add a GHS 5.00 Water expense: net profit
   GHS 7.00. Core totals must remain unchanged. These are examples, not settings.
6. **Payments:** cash paid, credit unpaid, MoMo pending and subsequent confirmed
   collection must survive reload without being relabeled by GET. Selecting MoMo
   in the form records a Water payment state; it does not itself launch Paystack.
   If using the legacy callback, test signed/authorized test payloads, exact
   amount/currency, duplicate delivery, archived sale rejection and other-tenant
   references. If using shared Payments, verify the `WATER_ORDER` application stays
   Water-scoped and creates no Core order/journal/receipt.
7. **Real database boundaries:** test simultaneous sales against the last stock,
   stale edits, transaction rollback and row-level tenant security in staging.
   In-memory handler tests do not establish PostgreSQL locking/RLS behavior.
8. **Devices:** verify the deployed app on an actual phone and desktop, in light
   and dark modes, including restock/sale editing, keyboard focus, modal selects,
   validation messages, ledger scrolling, sorting and pagination.
9. **Public pause:** deploy the guarded API before/together with the storefront.
   In staging, old cached client requests and direct legacy/versioned purchase or
   booking submissions must be rejected while catalogue detail URLs still work.
   Do not infer deployed protection from local disabled buttons.

### Provider variable names only

- `WATER_MOMO_WEBHOOK_SECRET`: required only for the legacy Water callback.
- `PAYSTACK_SECRET_KEY`: required for provider-backed shared Payments features,
  not for the Water form's cash/credit/manual ledger entries.
- No Water-specific provider credential is needed merely for the general API
  process to start. Use the staging runbook for infrastructure/auth/origin names.
  A missing callback/provider credential blocks that feature, not `/ready`.

### Known operational limits

- New Water sale/restock creation has no durable idempotency key. If a save times
  out with an unknown result, **reload and inspect the ledger before retrying**.
  Do not blindly retry or enable an offline automatic mutation queue.
- Runtime defensive DDL/vendor-link backfills remain legacy debt. A working
  dashboard is not proof of clean migration history.
- Existing historical data may need an owner-reviewed reconciliation. No data
  audit, correction or seed was run here.
- CRM global sorting/segments/customer archive, Directory customer pagination,
  Accounting/nested registers and mobile-card sort controls remain unfinished.
  See [table checkpoint](public-commerce-and-table-controls.md). RI-012 linked
  settlement and RI-018 combined-cart delivery distance remain open; the public
  pause is not a fix for those contracts.

## Manual Git flow — do not execute blindly

These commands are for the owner. None were run by the agent. The current branch,
index, merge state and uncommitted history have not been inspected using Git.

First identify state using filename/status output only:

```sh
git status
git branch --show-current
git diff --name-only
git ls-files --others --exclude-standard
```

If a merge/cherry-pick/rebase is already in progress or unmerged paths remain,
stop and resolve that specific operation before starting a new flow. Do not
discard changes, automatically pick ours/theirs, reset, or switch away from work.

With no in-progress operation, preserve the current work on a new review branch
(choose another name if this already exists):

```sh
git switch -c fix/reebs-water-readiness-tables
```

Review code changes and stage deliberately. Do **not** use `git add .`, `git add
-A`, or add entire app roots/data directories. Do not stage environment files,
credential exports, private keys, generated builds or local test screenshots.
Use `.env.example` only if it contains reviewed placeholder documentation.

For tracked code changes, review each patch rather than blindly accepting all:

```sh
git add -p -- apps/reebs-portal/src apps/reebs-portal/backend apps/reebs-portal/shared apps/reebs-portal/tests apps/reebs-portal/docs
git add -p -- apps/reebs-website/src apps/reebs-website/tests apps/reebs-website/package.json
git add -p -- packages/config/src packages/ui/src packages/types/src scripts docs/apps/reebs pnpm-lock.yaml
```

Interactive patch staging does not add new files. From the filename list above,
add each reviewed new source/test/document by its explicit path. This pass's new
paths include `src/components/TableControls` (Portal), the public pause components
and policy, Water webhook handler tests, table/browser tests, these runbooks and
the scanner path helper/tests. Use the [process audit](roadmap-process-integrity-audit.md)
and [table matrix](public-commerce-and-table-controls.md) to check scope; unrelated
local work belongs in a separate reviewed commit. Ensure new imported files and
the workspace lockfile are included together.

Also review and include the owner-authorized TTNGH metadata/CI follow-up. These
explicit paths include new files that patch staging alone would miss:

```sh
git add -- apps/ttngh/appSystem.js apps/ttngh/appSystem.test.js apps/ttngh/package.json
git add -- scripts/hosting-policy.mjs scripts/hosting-policy.test.mjs scripts/check-cloudflare-railway-readiness.mjs
git add -- .github/workflows/monorepo-ci.yml docs/apps/ttngh/deployment.md docs/apps/ttngh/README.md
git add -- docs/apps/reebs/water-release-readiness.md docs/apps/reebs/roadmap-process-integrity-audit.md
```

Review each file first, including any unrelated local edits. TTNGH's existing
Astro implementation must accompany its metadata when it is first added; select
reviewed source files explicitly, never include local secret or generated files.

```sh
git diff --cached --name-only
git diff --cached --check
pnpm run security:scan
pnpm run security:gate
pnpm run hosting:check
node --test apps/ttngh/appSystem.test.js scripts/hosting-policy.test.mjs
```

**The TTNGH security-gate blocker is resolved.** Only its not-yet-configured
Cloudflare readiness is explicitly deferred; security checks remain mandatory.
Do not merge or promote if any required gate fails on the staged/merged revision.
After the staged set is reviewed, commit before integrating the destination branch:

```sh
git commit -m "fix(reebs): harden Water readiness and standardize table controls"
git fetch origin
git merge origin/develop
```

If conflicts occur, resolve files individually, rerun checks and finish the merge
with a normal commit. If no conflicts, rerun applicable tests/builds on the merged
tree as well. Keep secret files out of all conflict resolution output.

Review `git diff --name-only origin/develop...HEAD` before opening the PR: starting
from a different branch can bring unrelated committed history into the comparison.
Do not merge/promote an unexpectedly broad diff just to get these changes released.

```sh
git push -u origin fix/reebs-water-readiness-tables
```

Open a PR **into `develop`**, not `main`. Confirm the staging build revision and
complete the checks above. Promote reviewed `develop` to `main` through a separate
PR only after staging sign-off. Keep the previous compatible API/Portal/website
deployment available; do not reverse a database migration as routine rollback.

```sh
gh pr update-branch \
  --base develop \
  --head fix/reebs-process-integrity-audit \
  --draft \
  --title "fix(reebs): process integrity audit and regression fixes" \
  --body "See docs/apps/reebs/roadmap-process-integrity-audit.md for fixes, verification and remaining release blockers."
```
