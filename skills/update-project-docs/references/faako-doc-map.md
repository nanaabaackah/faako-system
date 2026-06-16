# Faako Documentation Map

Use this map when updating documentation after code changes.

## Shared / Platform

- Platform status: `docs/platform/platform-status.md`
- Platform progress log: `docs/platform/platform-progress-log.md`
- Security status: `docs/platform/security-status.md`
- Architecture and boundaries: `docs/platform/architecture.md`, `docs/platform/faako-client-app-boundaries.md`
- Shared UI package docs: `packages/ui/README.md`
- Shared config package docs: `packages/config/README.md`

## Apps With Docs Under `docs/apps`

- Dev ERP: `apps/dev-erp/README.md`, `docs/apps/dev-erp/*`
- Faako API: `apps/faako-api/README.md`, `docs/apps/faako-api/*`
- Faako ERP: `apps/faako-erp/README.md`, `docs/apps/faako-erp/*`
- Faako Website: `apps/faako-website/README.md`, `docs/apps/faako-website/*`
- REEBS Portal: `apps/reebs-portal/README.md`, `docs/apps/reebs-portal/*`
- Stroane Web: `apps/stroane-web/README.md`, `docs/apps/stroane-web/*`

## Apps With README-Only Docs Today

- By Nana Portfolio: `apps/bynana-portfolio/README.md`
- REEBS Website: `apps/reebs-website/README.md`
- System Starter: `apps/system-starter/README.md`
- UI Workbench: `apps/ui-workbench/README.md`

For README-only apps, update the README and add a platform progress-log entry for cross-app changes. Create `docs/apps/<app>/` only when the app needs durable app-specific status, implementation, API, database, security, or pre-deploy notes.
