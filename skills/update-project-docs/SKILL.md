---
name: update-project-docs
description: Keep Faako monorepo documentation aligned with code changes. Use when Codex changes app code, shared packages, backend behavior, data flows, deployment configuration, environment variables, tests, or cross-app conventions and must update README files, docs/apps notes, platform progress logs, status docs, or package docs as part of the same work.
---

# Update Project Docs

## Workflow

1. Identify the scope of the code change before editing docs.
   - Run `git status --short` and inspect the changed app/package paths.
   - Use `rg` to find existing docs that mention the touched feature, route, env var, command, model, helper, or package.
   - Read the current app README plus any matching files under `docs/apps/<app>/` and `docs/platform/`.

2. Update the closest docs, not only the newest log.
   - App code changes: update `apps/<app>/README.md` and relevant `docs/apps/<app>/progress-log.md`, `system-status.md`, `implementation-notes.md`, `pre-deploy-checklist.md`, `api.md`, `database.md`, or `security-notes.md`.
   - Shared package changes: update the package README and `docs/platform/platform-progress-log.md`.
   - Cross-app behavior: update `docs/platform/platform-status.md` and the affected app READMEs.
   - Missing `docs/apps/<app>/` folder: update the app README and platform log instead of inventing a large docs tree unless requested.

3. Preserve the change trail.
   - Add a dated progress-log entry with what changed, why, files changed, data impact, security impact, testing done, rollback notes, and next step.
   - Rewrite stale current-state sections when behavior changed. Historical entries may remain historical, but status and implementation notes must describe the app as it works now.
   - Do not document secrets. Name env vars only and state whether they are server-only or browser-visible.

4. Use the Faako docs map when selecting files.
   - Read `references/faako-doc-map.md` when unsure which documentation files belong to an app or package.

5. Validate the doc pass.
   - Run `rg` for stale names, routes, env vars, and moved paths.
   - Run `git diff --check` at minimum.
   - Run relevant type/lint/test/build commands when code changed, and record failures or skipped checks honestly.

## App Update Notice Rule

When adding or changing a browser app shell, document and preserve the shared `AppUpdateNotice` convention:

- Import it from `@faako/ui`.
- Enable it in production and optionally in development through `VITE_ENABLE_APP_UPDATE_NOTICE=true`.
- Keep it user-controlled: it may prompt for refresh, but it must not auto-reload and interrupt active forms, carts, admin edits, checkout, or queued offline work.
- Style it through shared `--sys-*` tokens rather than app-specific hardcoded colors.

## Documentation Style

Keep entries concise and operational. Include enough context for future Codex work to avoid re-discovery, but do not turn docs into chat transcripts. Prefer precise file paths, commands, env var names, and current behavior over broad statements.
