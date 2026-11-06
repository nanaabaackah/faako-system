# TWE demo retirement and repository hygiene — 2026-11-06

## Scope and behaviour

This sweep retires synthetic TWE website/portal experiences, not authenticated
CMS previews, migration history, production data or other applications' features.
The root README inventory was checked against workspace manifests and commands.
Local approved public pages remain available with `pnpm run dev:twe`.
The ordinary local launcher deliberately does not load hosted identities or
database credentials: removing the fake workspace does not enable staff login.

Removed runtime files include the five `src/pages/demo*` Astro routes,
DemoWebsite, DemoClosing, DemoEnquiry, DemoEmailPreview, their three stylesheets,
demo collections/Tips, and the unreferenced Estimator, ReviewPlaceholder and
ApprovedPreviewPhoto prototypes. Retained TWE component files were checked for
references; Astro pages and the React entrypoint are framework entrypoints,
not orphaned components. No dependency was added.

The portal always uses the shared real API client. The old simulated adapter was
moved from `src/demo.js` to `test/fixtures/workspace.js`; Playwright intercepts
HTTP using `test/fixtures/browser-api.js`. These fixtures never enter the build.
Role-switch query parameters cannot grant a synthetic session.

Removed the staging demo enquiry route, its schema and repository write method.
Historical staging rows retain their explicit labels and mail-safety handling.
No tables or records are deleted. Real enquiries, authentication, staff roles,
section imagery, draft autosave, previews and publishing remain unchanged.

Website redirects preserve old demo landing/list links without republishing
sample offers. Synthetic detail links remain unavailable, rather than silently
becoming different real packages. The protected portal's old demo route remains
404, including when obsolete flags are supplied.

Obsolete configuration: `PUBLIC_STAGING_DEMO_ENABLED`,
`TWE_STAGING_PORTAL_DEMO_ENABLED`, `TWE_DEMO_ORIGIN`. Remove them from hosted
settings when convenient; they no longer enable a runtime capability.
Test examples may deliberately supply obsolete flags to prove this.

## Worktrees and generated files

- Pruned six stale Git registrations for already-missing temporary worktrees.
  This removes metadata only, not branches or user files.
- The obsolete `twe-drive-preview` worktree was verified merged, with no source
  changes, untracked user files or private environment files. Only generated
  dependency links differed; its branch/history are retained for recovery.
- The current cleanup worktree remains in use until its work is committed.
- Preserve `node_modules/.codex-worktrees/paystack`: it has an unmerged branch
  and genuine Dev ERP source changes. Do not remove it.
- Remove 1,583 tracked dependency artifacts and 77 generated Astro cache files from Git's index
  only. Installed files stay on disk and existing ignore rules prevent
  reintroduction. No lockfile changes or history rewrite are needed.

Historical docs, migrations, licensed fonts, approved photo provenance,
private preview/recovery tooling and test fixtures are deliberately retained.
Unused-by-one-page does not prove a shared package, media asset or other client's
component is obsolete. Unrelated TTNGH/Dev ERP working changes are preserved.

## Verification and release

Use TWE lint, type checks, builds, unit tests, shared UI checks, isolated PostgreSQL
tests and the foundation browser scripts. Tests exercise real public routes,
the real portal API transport against HTTP fixtures, and the absence of retired
runtime paths. Private Astro preview rendering remains separately tested.

Final local results:

- TWE lint/type/build passed; the regular checkout also built successfully after
  synchronisation. Its website and portal returned 200 on their existing ports.
- API 109, portal 14 and website 38 tests passed; shared UI lint/type checks and
  all 8 tests passed. The isolated PostgreSQL 17 drill passed all 10 tests,
  including restart persistence and logical restore. No shared DB was touched.
- Chrome passed content, onboarding, CMS management, collections/gallery,
  public follow-up and actual private Astro previews at 320/390/768/1440px.
  Public design/axe/reduced-motion/no-JavaScript checks also covered 375/1024px.
- Repository prerequisites, manifests, conflict markers, hosting checks,
  monitoring registry, documentation links, whitespace and hygiene passed.
  Existing warnings remain: TTNGH hosting is deferred and REEBS Water lacks
  project metadata. Neither was silently changed by this sweep.
- One API subprocess check timed out during concurrent local builds; the full
  API suite passed on rerun without changing a timeout or weakening a check.
  Browser checks were completed sequentially after real-transport fixture and
  session-wait corrections. Remote CI has not run for this cleanup.

The 99 scoped source/documentation paths were compared between the focused
worktree and regular checkout; they match. Unrelated edits and local branch
history were not reset. Historical demo guides now carry retirement notices.

Final build measurement: portal JS 493.22 → 477.40 KB, gzip 146.16 → 140.61 KB.
This removes about 15.82 KB raw / 5.55 KB gzip without a new dependency.
Portal CSS changed from 151.19 to 150.79 KB. Build output is not committed.

Read-only HTTPS observations, 2026-11-04: staging website 200, production website
200, staging API readiness 200, production API readiness 502. These observations
are not authenticated acceptance, deployment-SHA verification or evidence that
this cleanup is live. No production mutation or deployment is part of this sweep.

Merge through checked review into develop, then verify staging before a separate
production promotion. Preserve the previous verified release. Recover removed
source files from the preceding Git commit; recreate a merged worktree from its
retained branch if needed. Reinstall dependencies from the frozen lockfile.
Never reset databases as cleanup or recovery.
