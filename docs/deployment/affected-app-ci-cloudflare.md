# Affected-application CI and Cloudflare Pages deployments

This monorepo uses `scripts/workspace-graph.mjs` as the source of truth for workspace relationships, including explicit `workspace-links.json` build dependencies.

## GitHub Actions

The `monorepo-ci.yml` detector now compares the PR base/head or push before/head with complete git history. It resolves directly edited applications and **transitive workspace dependents**.

- JavaScript quality gates use Turbo's `--affected` task selection.
- DEV ERP, REEBS Water, Faako Website and REEBS Website browser suites run only when their application is affected. REEBS Portal changes additionally run the Water **integration** suite (but do not imply a Water deployment).
- The TWE foundation workflow is gated by the dependency graph for any of TWE web/portal/API; cross-app TWE acceptance remains intentionally grouped because it exercises integration of those surfaces.
- The shared Python analytics job runs for its service or common CI/workspace config changes.
- Repository hygiene and the stable required-check aggregator continue to run on every PR, including documentation-only edits. Skipped application jobs are accepted by the required gate.
- Root lockfiles, workspace config, `turbo.json`, shared build scripts, and workflow changes deliberately trigger broader checks. Treating those as app-specific could miss a regression.
- Changed/deleted files are considered. Missing refs cause detection to fail closed rather than silently claim that nothing was affected.

Inspect the decision for a local PR:

```bash
node scripts/ci/affected-surfaces.mjs --base origin/develop --head HEAD
node --test scripts/ci/affected-surfaces.test.mjs
```

CI changes **do not deploy** any application. A successful CI check is separate from promotion to staging/production.

## Cloudflare Pages: per-project Build watch paths

Git-connected Cloudflare Pages projects normally build on any Git push to their repository, independent of GitHub CI. To limit each Pages project:

1. Run `node scripts/ci/cloudflare-watch-paths.mjs --app @faako/dev-erp` from the monorepo root, replacing the package name for your Pages project. Omit `--app` to see settings for all app workspaces.
2. In **Cloudflare Dashboard > Workers & Pages > [project] > Settings > Build > Build watch paths**, set **Include paths** to this app's output `include` entries.
3. Leave **Exclude paths** empty unless there is a specifically audited exception. Verify production branch is `main` and preview branch is `develop` where appropriate.
4. Repeat for **each** Git-connected Pages project (including separately configured staging/production projects); changing a GitHub Actions file alone cannot update Cloudflare project settings.
5. Verify with one app-only staging commit and the Pages deployment history for all neighboring projects. Inspect the shared-package case and confirm all affected projects rebuild.

The generated paths include the application's own `apps/<app>/*`, its **transitive `packages/<dependency>/*`**, and shared root build/lockfile inputs. They **do not** include unrelated app folders, unrelated shared packages, or docs-only changes.

Cloudflare's wildcard `*` includes nested directories. In the event of an empty push, a very large change set (3000+ files), or 20+ commits, Cloudflare may **bypass watch-path filtering and build anyway**. Cloudflare also limits Pages projects per repository (consult the current account limits).

### Important boundaries

- These generated settings are **recommendations**, not a live Cloudflare API update: they still need to be applied in the Cloudflare dashboard. No hosting tokens are stored in this repo.
- **CMS publication hooks** (e.g. TTNGH Sanity/Cloudflare or TWE reviewed publication) are separate from Git watch paths; their own scoped trigger and artifact rules must remain in place.
- **Railway backends** have separate deploy triggers and must be configured independently. Do not redeploy all API services when one backend changes.
- A single workspace that builds two Pages surfaces (e.g. Stroane storefront and admin) will still rebuild both on workspace-level changes until their source/build surfaces are separated sufficiently for reliable path filtering.
- A runtime relationship doesn't necessarily mean an app must be redeployed: for example, the REEBS Portal to REEBS Water relationship is tested in CI, while Water's Pages build watches its own actual source dependencies.
- Cloudflare Pages monorepo settings require supported Build System versions and repository-project limits; verify the actual Pages project configuration.

Reference: https://developers.cloudflare.com/pages/configuration/build-watch-paths/ and https://developers.cloudflare.com/pages/configuration/monorepos/
