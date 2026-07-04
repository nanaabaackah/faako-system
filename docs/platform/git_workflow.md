# Faako Git Workflow

Use this terminal-first flow for every app in the Faako monorepo. The short path uses local Git aliases; the plain Git path is included when aliases are unavailable.

## Branches

| Branch | Purpose | Deploys |
| --- | --- | --- |
| `main` | Production | Production apps/APIs |
| `develop` | Staging | Staging apps/APIs |
| `feature/*` | Local feature/fix work | No automatic production deploy |
| `hotfix/*` | Critical production fix | PR to `main`, then back to `develop` |

Do not develop directly on `main` or `develop`.

## Daily Feature Flow

Start from current staging:

```bash
git checkout develop
git pull --ff-only origin develop
git new faako short-feature-name
```

Fallback without aliases:

```bash
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/faako-short-feature-name
```

Work locally, then check exactly what changed:

```bash
git status --short
pnpm run affected:apps
```

Run targeted checks for changed apps/packages:

```bash
pnpm --filter @faako/dev-erp run test
pnpm --filter @faako/dev-erp run lint
pnpm --filter @faako/dev-erp run typecheck
pnpm --filter @faako/dev-erp run build
```

Use the relevant workspace name for other apps, for example `@faako/stroane-web`, `@faako/faako-website`, `@faako/faako-api`, `@faako/reebs-portal`, or `@faako/bynana-portfolio`.

Commit and push:

```bash
git status --short
git ship feat dev-erp "add projects module"
```

Fallback without aliases:

```bash
git add <files>
git commit -m "feat(dev-erp): add projects module"
git push -u origin HEAD
```

Open the staging PR:

```bash
git pr
git checks
```

Fallback:

```bash
gh pr create --base develop --fill
gh pr checks --watch
```

## Merge to Staging

After CI passes and the PR is reviewed:

```bash
gh pr merge --squash --delete-branch
```

Then sync local staging:

```bash
git checkout develop
git pull --ff-only origin develop
```

Smoke-test the changed app on staging before releasing to production.

## Release to Main

Use this after a tested milestone, not after every tiny commit.

```bash
git checkout develop
git pull --ff-only origin develop
git release
git checks
```

Fallback:

```bash
git checkout develop
git pull --ff-only origin develop
gh pr create --base main --head develop --title "release: promote develop" --body "Promotes tested staging changes."
gh pr checks --watch
```

Merge the release PR after checks and final approval:

```bash
gh pr merge --squash
```

Sync both local branches:

```bash
git checkout main
git pull --ff-only origin main
git checkout develop
git pull --ff-only origin develop
```

## Milestone Push Block

After milestone changes, include this block in the final summary:

```bash
git status --short
pnpm run affected:apps
pnpm run monitoring:check
pnpm --filter <changed-workspace> run test
pnpm --filter <changed-workspace> run lint
pnpm --filter <changed-workspace> run build
git ship <type> <scope> "<message>"
git pr
git checks

# After staging approval
gh pr merge --squash --delete-branch
git checkout develop
git pull --ff-only origin develop
git release
git checks

# After release approval
gh pr merge --squash
git checkout main
git pull --ff-only origin main
git checkout develop
git pull --ff-only origin develop
```

Use `type` values like `feat`, `fix`, `chore`, or `docs`. Use app scopes like `dev-erp`, `stroane-web`, `faako-api`, `faako-website`, `reebs-portal`, `bynana-portfolio`, or `shared`.

## Database Changes

For migrations:

1. Create and test migrations locally.
2. Commit the migration file with the feature.
3. Apply to staging through the app's reviewed migration/predeploy command.
4. Smoke-test staging data flows.
5. Release to `main`.
6. Apply production migrations only through the reviewed production migration/deploy path.

Never point local development commands at production data.

## Multi-App or Shared-Package Changes

When a change touches shared packages or multiple apps, run broader checks before the staging PR:

```bash
pnpm run lint
pnpm run test
pnpm run build
pnpm run monitoring:check
```

Add `pnpm run project-registry:check` when app/project registry metadata changes, and `pnpm run hosting:check` when deployment or hosting config changes.

## Hotfix Flow

Use only for production-critical fixes:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b hotfix/short-fix-name
```

Open the hotfix PR to `main`, merge after checks, then immediately open a back-merge PR from `main` to `develop` so staging stays synchronized.

## Rules

- Keep feature branches small and named by app/scope.
- Commit migrations, docs, and tests with the feature they support.
- Prefer PRs to direct pushes for `develop` and `main`.
- Run targeted checks before every PR.
- Run broader checks before multi-app or shared-package releases.
- Smoke-test staging before promoting `develop` to `main`.
- Keep secrets out of commits and out of `VITE_*` variables.

Last updated: July 2026
