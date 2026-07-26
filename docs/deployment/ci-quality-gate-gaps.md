# CI quality-gate gaps

Date: 2026-07-26

The existing GitHub Actions workflow is Stroane-specific. It detects only `apps/stroane-web/**`, shared-package changes, and a small set of root files. It does not enforce the repository-wide commands introduced by the quality-gate repair.

## Current coverage

- dependency install with a frozen pnpm lockfile;
- Stroane Prisma generation and schema validation;
- Stroane lint;
- Stroane backend tests;
- two Stroane builds using storefront and portal environment selections.

## Material gaps

1. Dev ERP, Faako API, Faako ERP, Faako Website, Portfolio, REEBS Portal, REEBS Website, System Starter, and UI Workbench changes can merge without their standard gates.
2. Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm check` are not invoked.
3. Shared-package changes trigger only Stroane validation, even when another application is the affected consumer.
4. REEBS analytics has no Python 3.11 environment, dev dependency install, or pytest job.
5. Playwright is not run and no per-application service/database fixture strategy exists.
6. Dev ERP HTTP integration tests require loopback listener permission.
7. Environment-dependent builds lack a CI-owned matrix and test-safe values.
8. Vite reports `NODE_ENV=production` misuse in tracked environment configuration for Faako Website and Stroane.
9. Portfolio reports a chunk-size warning; REEBS Portal emits very large repeated CSS chunks.

## Recommended CI sequence

This task does not redesign CI. A follow-up should:

1. add a repository Node gate running install, lint, type-check, unit/integration tests, and build;
2. add a separate Python 3.11 REEBS analytics job using `services/reebs-analytics[dev]`;
3. retain application-specific Prisma/database preparation where needed;
4. add E2E jobs one application at a time only after isolated services and fixtures are defined;
5. run `sitemap:check` in the repository gate so a stale committed REEBS sitemap cannot merge.

The first CI implementation should consume the root commands rather than reproduce workspace lists in workflow YAML.

The former live-API sitemap build gap was resolved on 2026-07-26. The build now uses a tracked route snapshot; live inventory refresh is an explicit operation outside `pnpm build`.
