# Water stabilization checkpoint — 2026-10-09

This is a local source and mocked-test checkpoint, **not production readiness
certification**. This requested handoff file was absent when work resumed; the
findings below are based on the current checkout, not recovered unstaged history.
At the original checkpoint no Git commands were performed. The subsequent
2026-10-10 handoff authorizes a feature branch for develop. Secret-file reads,
database connections, migrations, deployments and production checks remain out of scope.

## Preserved decisions

- Preserve the accepted [standalone Water ADR](../../decisions/reebs-water-standalone-app.md): React/Vite Water app, shared REEBS API/session/tenant, no separate database or authentication system.
- Preserve the latest current-price model: retail, company and bulk prices belong to the selected product. Historical schedules are retired; sale price snapshots remain editable through authorized sale corrections. Zero selling prices are valid, but purchase costs must be positive.
- Preserve both `gwater-15pk` and `sachet-water-30pk`; stock, prices, expenses, collections and financial projections are organisation/product scoped.
- Owners/admins manage costs, pricing, stock and finance. Water staff handle sales. Managers are read-only. The API remains authoritative.
- Water stock, revenue, costs and profitability are excluded from Core metrics by default.

## Changes in this stabilization pass

### Collections and permissions

- Completed missing `loadWaterCollections` / `projectWaterSales` integration called by the Water dashboard. This is a read-only projection of existing Water payment records/applications, not a new payment ledger or a Core posting.
- Existing applied GHS Water collections override legacy sale payment flags. Partial collections show the actual collected amount and remaining balance without adding payment amounts to sales revenue. Reversed applications retain zero-collection authority instead of falling back to a stale paid flag.
- Shared settlement retains Water's canonical sale-method keys and marks partially settled orders `partially_paid`, not fully paid. Collections use the shared payment ledger's normalized method labels. The payable balance respects application history after repricing.
- New MoMo sales default pending; choosing MoMo does not initiate or confirm a provider charge. Legacy reads do not rewrite recorded payment facts.
- Added explicit `canRecordSales` to the API permission DTO and Water UI. Managers no longer see sale submission/edit/archive controls. Missing permission data fails closed in the UI: deploy compatible API code before the frontend.
- Removed the blanket undefined-name lint suppression from `water.js` so missing helper integration is detected by lint.

### Faako presentation and navigation

- Restored Portal-compatible light/dark tokens, shared font use, readable elevated surfaces, and responsive sizing without redesigning the Water layout.
- Fixed sale and ledger dialogs to use shared Faako modal/header/body classes, opaque theme surfaces, padded scrollable content, and 44px close controls.
- Standardized local action classes for rounded touch controls and labelled icon-only mobile actions, including sign-out; pagination retains accessible Previous/Next names. Corrected legacy search selectors to style the shared Faako input without nested borders.
- Preserved product switching and Portal sidebar/quick-access external Water entry points. Water's breadcrumb now reads `REEBS Water` and points to `/`, rather than the nonexistent standalone `/admin` page. The brand uses client-side home navigation. Shared breadcrumb defaults remain `Admin` / `/admin` for other apps.
- Water route code is lazy-loaded; the login screen still receives shared form styles before the Water chunk loads.
- Missing selling prices remain empty instead of becoming `0.00`; actual zero prices remain editable. Missing purchase costs stay blank and required.

## Verification approach

### Follow-up: standalone module navigation and field/table fixes

The user clarified that Water needs **modules**, not in-page navigation. The
standalone app now uses the actual REEBS sidebar layout, with its styles shared
through `@faako/ui/reebs-sidebar.css` (also consumed by Portal), with these routes:

| Module | Route | Content |
| --- | --- | --- |
| Dashboard | `/` | Water KPIs and financial breakdown permitted by the API |
| Sales | `/sales` | Record a sale; read-only message when sales permission is absent |
| Orders | `/orders` | Searchable, sortable, paginated Water order ledger and editor |
| Customers | `/customers` | Water-scoped directory and existing authorized customer creation |
| Stock | `/stock` | Stock summary, movement ledger, current prices, authorized restock/expense/correction forms |

These are distinct route contents, not anchor links. Customer directory reads
retain the existing `scope=water` API filter and 200-record limit, disclosed in
the UI; customer creation uses the existing Water action. Navigation is only a
UX permission filter; API authorization remains authoritative. Module changes
retain the mounted product workspace and sales drafts. A full browser reload
still resets unsaved drafts, as before. The mobile sidebar is an accessible
disclosure in normal page flow, not an overlay obscuring forms.

Legacy form selectors no longer style the shared select/date native fallback
controls. They remain invisible even when disabled/loading, preventing a second
input/select box beneath the Faako trigger. Ledger cards now own a single
outer frame; nested table wrappers no longer add another card border/shadow.
Sorting buttons use inherited table typography and theme colors, retaining
sorting, pagination, totals and the existing mobile row layout.

Use source-only Node tests, mocked API browser tests and explicit clean child
environments. `REEBS_SKIP_ENV_FILES` disables Vite environment-file loading.
Browser tests reject live mode and start their own localhost server with an
unreachable loopback backend fallback. Do not run the normal development
predeploy command for these checks: it can connect to a configured database.

- 185 focused Node tests passed: Water handlers/domain/pricing, shared payment service/provider behavior, Core dashboard separation, Portal navigation hierarchy and route compatibility.
- Scoped ESLint passed for Water and the edited shared/backend files. Shared `types` and `ui` TypeScript checks passed.
- The complete mocked Water browser suite passed 39 tests, covering 320–1440px layouts, both products, customer creation, editable restock costs, current/zero prices, read-only managers, restricted operators, partial collections, standalone navigation and light/dark login/dialog accessibility.
- Visual review then identified invisible light-mode pagination arrows and inherited mobile modal bottom clearance. Corrected locally using `currentColor` Iconsax arrows and Water-specific modal spacing, with explicit regression assertions. All seven targeted pagination/navigation/dialog rechecks passed, including keyboard focus return, save-action reachability and light/dark accessibility scans.
- Four final ledger/dialog checks also passed after removing the double search border. Screenshots were inspected in light and dark modes; the dark undo action uses the existing accent token for readable contrast.
- Local Vite production-mode build passed with environment-file loading disabled and a deliberately unreachable loopback API. The temporary build is verification-only, **not a deployment artifact**. The lazy split keeps Water workspace code separate from login; no reliable before-turn bundle baseline is available.

The later 2026-10-10 checkpoint used the repository's path-filtered security
scanner after confirming sensitive paths are rejected before content reads.
No live-provider or database test result is implied by mocked tests.

## Develop reconciliation — 2026-10-10

The user authorized a new review branch containing REEBS Water/shared changes
only, reconciled with develop before pushing. The integration retains develop's
collection ledger, durable mutation keys, transactions, stale-record checks,
archive protections and Prisma relation correction, together with the five
standalone modules and shared REEBS sidebar. Unrelated Travel With Ease work is
excluded. This is not permission to merge main or deploy.

- `Record collection` is available to authorized sales users on Orders. Manual
  collection records money already received; it does not initiate a provider charge.
- Shared `@faako/water-domain/waterSettlement` and `waterReporting` define payment
  projections and summaries for API/UI. Portal shared-path compatibility exports
  protect existing consumers; the standalone app does not import Portal business UI.
- Payment-date collections are separate from sale-date revenue. Live outstanding
  balances and stock are not constrained to a historical stock period. Reversed
  payment applications retain their authoritative zero rather than restoring
  a legacy paid flag.
- Legacy paid records are disclosed separately from verified collections. They
  require reconciliation before another collection or total-changing correction.
  Corrected totals below collected money require a reviewed refund first.
- Water commands roll back rejected operations and their retry markers. Browser
  retries retain the same key after an ambiguous server/network failure. No
  automatic unsafe mutation retry was added.
- Resolved an automatic-merge regression that reintroduced the retired Water
  date-period controls inside Core settings. Current-price browser coverage lives
  in the standalone Water app; obsolete Portal schedule tests/components were
  removed. Backdated sales remain covered by actual-handler current-price tests.
- Added isolated Water browser CI; it requires no Cloudflare deployment.

Final check results and manual setup are recorded in the
[2026-10-10 staging handoff](water-modules-staging-handoff-2026-10-10.md).
The 2026-10-11 continuation completed 528 Portal tests, 22 Water app/domain
tests, offline schema/type checks, both production-mode builds and security/
hosting/registry checks. All 44 browser scenarios passed across the main run
and targeted cold-navigation rechecks; the handoff records initial timeouts
separately. No live deployment readiness is implied.

## Remaining release gates and follow-up work

1. **Environment wiring:** independently verify Water static hosting, API origin, exact staging CORS origin and session-cookie behavior in an approved isolated environment. Portal currently defaults to the production Water host when not local; configure `VITE_WATER_APP_URL` explicitly for staging/preview. No deployed URL or environment value was inspected here.
2. **Database prerequisites:** review existing payment, operational-integrity and current-price migrations before dependent code. If current-price is already applied but operational-integrity is pending, STOP: the earlier migration references the now-retired price table. Review the actual migration state in an approved isolated environment and plan targeted recovery; do not reset, recreate historical data or mark unexecuted work applied. No database state or real PostgreSQL locking/concurrency behavior was verified here. `/ready` is only database `SELECT 1`, not a Water business-readiness certificate.
3. **Legacy reconciliation:** manual partial/final collections now exist, but a reviewed capture/reconciliation workflow for legacy paid records is still required. Existing flags do not prove immutable historical cash receipts.
4. **Archiving and reversals:** settled sales are protected. Do not treat archive as a refund; no automated refund or new bulk financial archive was introduced. Reversal/provider settlement rehearsal remains a staging gate.
5. **Save safety:** idempotency, transactions and stale-tab checks have mocked regression coverage. Real PostgreSQL rollback, RLS and concurrent-request tests remain required before live use.
6. **Reporting:** collection-date cashflow now uses shared definitions. Dedicated Water exports and explicitly labelled consolidated reporting remain separate work.
7. **Incremental cleanup:** runtime defensive schema work and the large Water page remain. Do not remove either without migration adoption evidence and focused contract tests.

The local fixes do not authorize production access or deployment. Keep user
changes intact and continue with these explicit gaps rather than declaring the
whole Water business flow complete.
