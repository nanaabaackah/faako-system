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
- Shared payment settlement uses Water's canonical `momo` key and marks partially settled Water orders pending, not fully paid. The payable balance respects existing application history after repricing.
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

No full repository security scan was run: scanners that traverse secret files
would conflict with the strict no-secret-read rule. No live-provider or database
test result is implied by the mocked tests.

## Remaining release gates and follow-up work

1. **Environment wiring:** independently verify Water static hosting, API origin, exact staging CORS origin and session-cookie behavior in an approved isolated environment. Portal currently defaults to the production Water host when not local; configure `VITE_WATER_APP_URL` explicitly for staging/preview. No deployed URL or environment value was inspected here.
2. **Database prerequisites:** review/apply the existing payment foundation and current-price migrations through the approved environment-scoped release process before dependent code. No migration state or real PostgreSQL locking/concurrency behavior was verified here. `/ready` is only database `SELECT 1`, not a Water business-readiness certificate.
3. **Legacy/manual collections:** records without payment applications still derive collections from their legacy paid status. Repricing such a paid sale cannot reconstruct the original cash received. A reviewed legacy-capture and manual partial-collection workflow is still required; this pass does not claim immutable historical cash accounting.
4. **Archiving and reversals:** Water sale archival and legacy stock/expense undo require further financial-history review, including settled-sale reversal/refund rules. Do not treat archive as a refund. No automatic refund or new bulk financial archive was introduced.
5. **Save safety:** durable Water sale/restock idempotency, stale-tab version checks, real transaction rollback/race tests and provider replay rehearsals remain outstanding. After an ambiguous save error, inspect the ledger before retrying.
6. **Reporting:** current collection summaries follow the selected sale/stock period, not collection-date cashflow. Dedicated Water exports and formally labelled consolidated reporting remain separate work.
7. **Incremental cleanup:** runtime defensive schema work and the large Water page remain. Do not remove either without migration adoption evidence and focused contract tests.

The local fixes do not authorize production access or deployment. Keep user
changes intact and continue with these explicit gaps rather than declaring the
whole Water business flow complete.
