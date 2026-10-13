# Water modules: develop review and staging handoff — 2026-10-10

Verification completed/resumed 2026-10-11 (Africa/Accra).

Review branch: `feat/reebs-water-modules-stabilization`.
Target: **develop only**. No main promotion, deployment, migration or production
access is part of this handoff. Travel With Ease edits/documents are excluded.

## Included

- Actual REEBS sidebar with Dashboard, Sales, Orders, Customers and Stock routes;
  shared Portal sidebar CSS, Faako themes/cards/fields, responsive tables and dialogs.
- Current prices and editable cost/sale snapshots for both Water products.
- Develop's collection workflow, immutable payment records, partial balances,
  idempotency, stale-record checks and scoped transaction/audit protections.
- Shared settlement/reporting definitions; reversed collections do not fall back
  to stale paid flags; Water finances remain separate from Core rentals/events.
- Owners/admins manage pricing, costs and finance. Water operators handle sales
  and collections. Managers remain read-only; backend enforcement is authoritative.
- Mocked Water browser CI does not require Cloudflare hosting to be configured.

## Local verification

All checks use source, mocked APIs and explicit clean test environments. Temporary
builds use an unreachable loopback API and are **not deployment artifacts**.
No secret files or real environment values were read.

| Check | Result |
| --- | --- |
| Portal backend/source regressions | 528 passed, clean runner exit; test-only values and localhost HTTP fixtures |
| Water app/domain source tests | 22 passed, including collection-date reporting and reversed/legacy separation |
| Water browser scenarios | All 44 verified across runs: main run 42 passed / 2 cold-load timing failures; subsequent 3/3 permission and mobile/desktop module-navigation rechecks passed |
| Accessibility | No automated violations in tested light/dark login, restock and collection dialogs; keyboard date/select and focus-return checks pass |
| Lint | Portal: no errors, 10 existing warnings; Water and edited shared/backend scope: no errors |
| Shared TypeScript | UI and types checks pass |
| Prisma schema | Offline validation passes with explicit temporary config and dummy URL; no database contacted |
| Builds | Portal and Water production-mode builds pass using clean test environments |
| Repository gates | Secret-safe scan, security gate, hosting configuration, registry and workspace manifests pass; Water environment example contract passes |
| Merge | Conflict markers resolved; no unmerged index entries or whitespace errors |

The first broad rerun reported 528 successful assertions but exceeded its wrapper
timeout during shutdown. A lower-concurrency rerun completed cleanly. An initial
parallel Portal build also timed out; the final serialized build passed. These
timeouts are not recorded as successful runs. Browser cold-navigation assertions
now allow 15 seconds (30 for initial access denial), without automatic retries.

Water bundle comparison against the saved local pre-reconciliation checkpoint,
not a claimed original-production baseline: entry JS remains **324.53 kB /
101.22 kB gzip**. Lazy Water JS grows from **225.97 / 51.93 kB** to
**233.37 / 53.83 kB**, adding collections and retry/settlement safeguards. Build
warnings about stale Browserslist data and temporary output directories remain
nonblocking. The API/UI's real database and provider gates below remain open.

Visual review caught and corrected the Portal sidebar's higher stacking level
painting above standalone dialogs. Water's sidebar is now below the shared
modal/popover layers; hit-testing and both collection-dialog themes are covered.
The final collection/finance recheck passed all 3 scenarios, including mobile dark
and desktop light dialogs, preserved retry keys and partial-payment totals. Final
dialog screenshots were visually reviewed after the stacking correction.

## Review flow

The branch incorporates develop at `ba0a0963d`. Open a PR with **develop** as its
base after the branch push; do not use main. The local checkpoint and merge retain
all scoped Water/shared edits without staging the Travel With Ease documents.

```sh
gh pr create --base develop --head feat/reebs-water-modules-stabilization \
  --title "feat(reebs): stabilize standalone Water modules and collections" \
  --body "See docs/apps/reebs/water-modules-staging-handoff-2026-10-10.md for verification and required staging migration/hosting checks."
gh pr checks --watch
```

PR creation/merge is a manual follow-up, not part of the branch-only push.

## Manual staging setup

1. Review the PR against develop and complete CI before merging. Branch push alone
   does not run this repository's PR-only feature-branch checks. Confirm Railway
   deploy triggers so merging develop cannot unintentionally deploy production.
2. **Review migration state before starting the new API.** The existing migrations
   include `20261004120000_water_operational_integrity` and
   `20261007000000_current_water_product_prices`, plus shared payment prerequisites.
   The operational migration references `waterProductPrice`; current-price removes
   that table after copying current prices and selected history. If current-price
   has already run but operational-integrity has not, stop for an environment-scoped
   migration recovery plan. Do not blindly deploy, reset the database, edit applied
   checksums, or mark unapplied statements as complete. Take a restorable backup;
   retain a full export of historical/future schedules if required because the
   current-price migration does not preserve complete scheduled windows. Neither
   migration is newly executed or rewritten by this reconciliation.
3. Deploy the compatible shared API first, **only after** the approved migration
   prerequisite check. The new UI requires capabilities and collections in its DTO.
4. Create/configure a separate Cloudflare Pages Water project: repository root,
   build `pnpm --filter @faako/reebs-water build`, output `apps/reebs-water/dist`.
   Choose the staging Water hostname. Retain the supplied `_redirects` SPA fallback
   and `_headers`; test direct `/orders`, `/customers` and `/stock` refreshes.
5. Configure variable names in the correct environment:

   - Water frontend: `VITE_API_BASE_URL` points to the staging REEBS API.
   - Portal frontend: `VITE_WATER_APP_URL` points to the staging Water site.
     Do not rely on its deployed production-host fallback.
   - API: `APP_ENV`, `NODE_ENV`, and `CORS_ORIGINS_STAGING`; include the exact Water
     staging origin in the existing staging allowlist.
   - Review existing session-cookie settings for staging/production isolation;
     retain the established authentication model. Do not copy production secrets
     or broaden cookie/CORS scope merely to make login work.
   - Optional monitoring registry URL: `REEBS_WATER_BASE_URL`.
   Provider credentials stay on the API; none belong in the Water browser build.
6. Rebuild the frontends after public build-variable changes. Verify login/session,
   logout, 403 access denial, module navigation and both themes at 320px and desktop.
7. In isolated staging, test both products independently: customer creation, stock
   with entered purchase cost, configured current prices, backdated sale, authorized
   correction, partial/final collection, exact retry, stale second-tab edit, rejected
   oversell, archive protections and tenant isolation. Confirm Core totals unchanged.
8. Reconcile legacy paid records deliberately; do not fabricate collections to make
   totals match. A total below collected money needs a reviewed refund workflow.
9. Preserve the prior compatible artifacts and backup. Rollback must account for
   retired schedule-table dependencies; do not roll back to schedule-dependent API
   code after current-price migration. No automatic reverse migration is supplied.

## Still requires separate verification

Real PostgreSQL RLS, locking, concurrent requests, rollback and migration history;
provider callbacks/reversals; actual DNS, CORS and cookie behavior; legacy financial
reconciliation. Local mocked checks do not certify production readiness.

## Staging relocation follow-up — 2026-10-13

The operator reported moving Railway staging to a new space with a **new
database**. Unchanged public hostnames do not transfer accounts, sessions or
business records into a new database. The current login response has not yet
been supplied, so a missing account is a hypothesis, not a confirmed diagnosis.

- Verify the staging API custom domain targets the new service and that
  `/live` and `/ready` succeed before attempting account setup.
- In Railway, verify `DATABASE_URL` references the intended staging Postgres,
  never production. Review schema/migration and public-organization setup before
  account creation. Do not reset, seed or import production as a login workaround.
  `PUBLIC_ORGANIZATION_ID` (or `REEBS_PUBLIC_ORGANIZATION_ID`) must resolve to an
  existing organization in this new database; bootstrap does not create it.
- Verify `APP_ENV`, `NODE_ENV`, `USER_APP_SECRET` and `CORS_ORIGINS_STAGING`
  are configured for the new staging service. Retain exact Portal/Water origins
  and the existing cookie isolation; do not copy production secrets.
- If the configured organization has no users, use the **Portal** login page's
  “Create first administrator” flow, not the Water login page. It requires
  `REEBS_ADMIN_BOOTSTRAP_ENABLED` and `REEBS_ADMIN_BOOTSTRAP_SECRET`; follow
  [the staging setup instructions](../../../apps/reebs-portal/docs/STAGING.md).
  Use a unique setup secret of at least 32 characters, then remove it and disable
  bootstrap after creating the administrator. Create subsequent Water accounts
  through the existing authorized invitation flow.
- `VITE_API_BASE_URL` must be an absolute HTTPS API origin with no `/api` suffix.
  The Water example now includes the required scheme. `.env.example` is not
  loaded by Vite and does not configure Cloudflare; set the build variable in
  the applicable Pages environment and rebuild if its value changed.
- `VITE_WATER_APP_URL` belongs to the Portal build and controls only its Water
  navigation link. It does not fix login or create database accounts.

No live database, deployment configuration or credentials were accessed for this
follow-up. The dashboard copy removal does not change Water/Core data scoping.
