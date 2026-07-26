# E2E prerequisites
Playwright is intentionally separate from `pnpm test`. Install JavaScript dependencies first with `pnpm install --frozen-lockfile`, then install or configure a Chromium browser.

If Playwright-managed browsers are installed:

```sh
pnpm exec playwright install chromium
```

If using an existing Chrome/Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. All local E2E runs need permission to bind loopback ports.

## Dev ERP

Command: `pnpm --filter @faako/dev-erp test:e2e`

- Playwright starts the Vite frontend at `http://127.0.0.1:4176`.
- Tests that cross the API boundary require the Dev ERP backend and its configured database/environment to be available separately.
- Use non-production test data and the app's documented local environment variables.

## REEBS Portal

Command: `pnpm --filter @faako/reebs-portal test:e2e`

- The config does not start a web server.
- The standard script targets `http://localhost:5174`; start the portal frontend and required API/database services first.
- `TEST_ENV=live` changes the target to the live public hostname and must be used only for explicitly safe, read-only checks.
- Existing specs cover pages and accessibility.

## REEBS Website

The manifest exposes an E2E command, but no Playwright config or spec files are currently present in this workspace. `test:e2e:all` starts the REEBS backend, portal frontend, and website frontend, but it is not yet a meaningful automated gate. Add public-site specs and a workspace config before enabling it in CI.

## Stroane

Command: `pnpm --filter @faako/stroane-web test:e2e`

- Playwright starts Vite at `http://127.0.0.1:4175`.
- The suite selects storefront or portal behavior through the Stroane environment contract.
- Authenticated, inventory, order, and database-backed flows require a dedicated test database, Prisma client/schema readiness, API configuration, and safe fixture users.
- Never point mutation-capable E2E runs at production.

## Root orchestration

`pnpm test:e2e` asks Turbo to run each available workspace E2E script. Because these applications have different service and fixture prerequisites, targeted workspace runs are the reliable default until CI supplies isolated stacks for each application.
