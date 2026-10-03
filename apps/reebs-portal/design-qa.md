# REEBS Module 3 — design and implementation QA

## Follow-up: local restart and Dashboard controls (2026-10-02)

- Dashboard View affordances now use arrows. Shared migrated action controls
  use rounded, theme-filled backgrounds, retaining 44px targets and responsive
  labels. This does not certify every legacy Portal button.
- System Health has an explicit disclosure chevron, keyboard focus and reduced-
  motion support. Screenshot review caught a nested glass-card border/shadow;
  the inner content now shares the outer card surface. Regression assertions
  cover the absence of a second border/shadow.
- Five focused Dashboard browser checks passed after the final refinement:
  desktop/mobile action sizing, keyboard disclosure and accessibility,
  light/dark themes, and 320px overflow. Scoped ESLint and a production Vite
  build passed. Tests use synthetic data and disable environment-file loading.
  Two additional desktop-light/mobile-dark capture checks passed; both verify
  Space-key closure and no horizontal page overflow. The resulting screenshots
  were inspected after removing the nested card surface.
- Local API and Portal listeners initially occupied ports 8888 and 5174; both
  were absent on the later read-only check. No process was stopped. Restart
  manually with `pnpm --filter @faako/reebs-portal run dev:backend` and, in a
  separate terminal, `pnpm --filter @faako/reebs-portal run dev:frontend`, then
  refresh. These commands avoid the migration-running `dev:reebs` wrapper.
  The real authenticated local chart response still requires user verification.
- No Git operation, deployment, migration or real database access was performed.

## Follow-up: action controls, Water and invoice opening (2026-10-02)

This section supersedes the action-button and native-period-control details in
the original report below. The [follow-up implementation notes](../../docs/apps/reebs/portal-actions-water-invoice-followup.md)
document scope, button conventions, API fixes and remaining legacy adoption.

- Fresh local screenshots confirmed the text-only View/Open actions and unused
  space below activity. Icons now use accessible action names; a permission-
  scoped Operational snapshot fills that space without adding metrics or mixing
  Water into Core. The skeleton retains the new section's card surface.
- Shared Faako select/calendar controls replace the Dashboard native period
  select and three Commercial effective-date fields. Water schedule management
  and the touched action controls follow the documented desktop/mobile policy.
- **79 distinct focused Node tests passed across runs**, including Water
  permissions/corrections, pricing resolution, invoice detail opening and health
  OPTIONS allowlist behavior. A final 49-test Water/commercial rerun also passed
  with the real resolver's missing-record error category represented in fixtures.
- **54 distinct browser cases passed across runs**: Dashboard, Water and
  invoice register/editor, mobile widths down to 320px, themes, roles, saved-cost
  correction, permitted sale-price edits and action label/44px target behavior.
  The first 51-case run passed 48; a stale native-select test and invalid summary
  definition-list markup were corrected, then all three affected cases passed.
  The added operational skeleton surface also required updating the expected
  glass-card count from three to four in the loading regression.
  An added booking-opening test initially searched for a reference not displayed
  in the register; it now opens the displayed Booking #42 and passes.
- Scoped ESLint, security scan (3,080 files at the final check) and security gate passed.
  The production Vite build passed (1,639 modules). No real database was used.
- Invoice screenshot evidence confirms the booking editor opens with its action
  controls. Backend fixtures verify saved fees/totals, tenant parameters and
  applied payment amounts; browser tests do not establish real ledger accuracy.
- Visual review additionally caught undersized card-level View icons and a
  leftover full-width mobile Add row. Icons are explicitly 20px and the mobile
  period/refresh/add controls now share a compact row. This was found by looking
  at fresh screenshots, not just by checking document overflow.

Release remains conditional: API and Portal changes are local, not deployed.
The user's production Water product/date/quantity schedule is not inspected.
This pass does not certify every older Portal action control or PDF/email flow.

Started: 2026-10-01; verification continued 2026-10-02. Scope: approved Dashboard / Quick Access composition, not a
site-wide redesign or production certification. All browser evidence uses
synthetic accounts/data, external requests blocked, and local Vite with
environment-file loading disabled. Only public production health endpoints were
probed; no production business records were inspected or modified.

## Reference and fidelity

Reference: [approved layout](../../docs/ux-audits/reebs-dashboard-revamp/04-layout-proposal.png).
The supplied banking image informs hierarchy only. The approved concept is not
an instruction to replace native Faako button shapes, shadows, typography or
Sidecar. Native bubble/glass cards, Iconsax and current theme tokens are retained.

- Desktop: existing Sidecar, secondary top Quick Access/account, compact header,
  KPI–collections–KPI grid, recent activity and attention.
- Tablet: chart gets full width before supporting cards; lower regions stack.
- Mobile: priority-stacked sections, fixed safe-area bottom Quick Access, central
  larger POS and existing Sidecar mobile controls. Account stays out of the bar.
- Operational roles lose unauthorized data/actions rather than gaining filler
  links. Role-specific Water/driver navigation remains distinct.
- The activity table uses existing sort controls/pagination and an internally
  scrollable, keyboard-focusable region. Financial/history records have no archive.

## Review findings and corrections

1. Removing the old broad stylesheet import initially broke dark surfaces.
   Quick Access now imports the shared admin stylesheet directly. Light/dark
   browser theme and contrast checks cover the corrected output.
2. Legacy table rules compressed mobile text despite passing document-overflow
   checks. Scoped minimum table width and wrapped cells restore readable text.
   A second check caught intrinsic grid expansion; the container now explicitly
   shrinks and keeps scrolling inside the region, not the page.
3. Replaced the generic Dashboard loader with the actual card composition using
   shared skeleton shimmer and reduced-motion rules; retained card backgrounds.
4. Small-screen chart tick labels were enlarged and moved outside the plot so
   the line cannot cross them. Compact axis amounts avoid overlong money labels;
   exact amounts and interval timestamps remain keyboard-accessible under View
   chart data.
5. Removed the unsupported “session uptime” implication from health samples;
   the label is now “checks healthy”. Health is manual/on-demand, not a monitor.
6. Preserved concurrent user edits to the welcome heading, operational wording
   and page width; updated browser assertions instead of reverting that work.
7. Server-side review found financial order fields were returned even when cards
   were hidden. Unauthorized overview responses now omit balance/reconciliation
   values, with a server-boundary regression test.
8. Tablet screenshots showed Sidecar covering the left end of bottom Quick
   Access despite passing bounding-box checks. The fixed bar now uses the
   existing inherited sidebar/modal offset. Regression hit-tests check that
   every link's centre is actually unobstructed, not merely in the viewport.

## Validation evidence

- Node: **502 tests passed**, 107 files, zero failures/skips. Covers existing
  Portal units/handler fixtures plus new Dashboard aggregation/permissions and
  safe Water error-adapter tests. No SQL database was connected.
- Scoped ESLint: passed for changed Dashboard, Quick Access, routing and backend
  sources. This is not a claim that repository-wide lint debt is cleared.
- Repository security scan and security gate: passed; sensitive file contents
  excluded. These checks do not constitute a full penetration test.
- Browser: 19 distinct Dashboard cases passed across the focused runs. The final
  affected-case rerun passed all eight: seven widths (320, 375, 390, 430, 768,
  1024, 1440) plus staff financial/technical visibility. It checks document/body/
  Dashboard overflow, header gaps, top/bottom placement, centred larger POS and
  minimum 44px Quick Access targets. Earlier passing cases cover loading/reduced
  motion, retry, empty/partial states, sorting/pagination, themes and four roles.
  The earlier full run failed before the containment correction and had one
  browser timeout; these are not hidden as a clean full-suite run.
- Final navigation rerun: **7/7 passed**, now also hit-testing every Quick
  Access link against overlapping elements at each width.
- Final captures: **5/5 passed**, at 1440/light, 375/light, 320/dark, 768/light and
  1024/dark. No critical/serious axe violations in the Dashboard, no document
  overflow, and unobstructed centred POS. Screenshots were visually compared
  with the approved concept; tablet Sidecar overlap is corrected. See
  [saved screenshots](../../docs/ux-audits/reebs-dashboard-revamp/README.md#implemented-screens--2026-10-02).
- Final production build: **passed**, 1,637 modules. Dashboard JS 19.37 kB
  (6.15 kB gzip), Dashboard CSS 15.71 kB (3.13 kB gzip). Quick Access JS 2.49 kB
  (1.15 kB gzip); its shared-admin CSS chunk remains 270.21 kB (42.73 kB gzip).
  No comparable pre-change baseline was measured. The only tool warnings were
  the existing outdated Browserslist dataset and the deliberately external
  temporary output directory not being emptied.

## Release limitations / manual checks

- Real Postgres aggregation execution and reconciliation with isolated-staging
  ledgers, historical refunds and linked-invoice balances remain unverified.
- New calculations are Core GHS cash receipts, not earned revenue or profit.
  Existing order balance and stock summary definitions are not generalized into
  all receivables or rental-date availability. See RI-012 and RI-018 in the roadmap.
- Physical-device keyboards, iOS safe areas and every source-module modal above
  bottom navigation still require real-device smoke checks. No production E2E.
- The production Water response is confirmed `MISSING_WATER_PRICE`; no matching
  effective retail candidate was found. Its actual schedule records were not
  inspected. Owner/admin must verify product, quantity threshold and dates in
  Settings → Commercial. No invented default or authorization bypass was added.
- The Water fix improves safe error guidance and request-ID diagnostics only;
  it does not populate production configuration or resolve the incident by itself.
- No new dependencies or image assets. Existing shared admin CSS remains large;
  no before/after performance saving is claimed without a comparable baseline.

Overall design gate: **PASS for the scoped, mocked Dashboard/Quick Access
experience**. Production release remains conditional on the manual data and
configuration checks above. No deployment or Git operations were performed.

See the [20-part handoff and changed-file list](../../docs/apps/reebs/dashboard-quick-access-revamp.md).
