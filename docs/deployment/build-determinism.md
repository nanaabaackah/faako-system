# Build determinism

Date: 2026-07-26

## Determinism rules

A cached build is valid only when its source files, internal dependency sources, shared root build helpers, relevant environment variables, and package-local environment files are unchanged.

Turbo hashes environment values but this documentation records names only. Secrets and environment values must remain in local ignored files or deployment-provider configuration.

## Build-time environment names

`NODE_ENV`, `VITE_*`, and `PUBLIC_*` are declared on the root build task. Explicit `VITE_*` hashing complements Turbo's framework inference and also covers Astro React islands and source-consumed packages. No application currently references a `PUBLIC_*` build variable, but the prefix is declared for Astro-safe future additions.

The application-specific names currently referenced by frontend source or build plugins are:

| Application | Build-time environment-variable names |
| --- | --- |
| Portfolio | `VITE_CONTACT_SUBMIT_ENDPOINT`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_TRUST_STATS_ENDPOINT` |
| Dev ERP | `APP_ENV`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `VITE_API_BASE`, `VITE_AUTH_CSRF_COOKIE_NAME`, `VITE_CAD_TO_GHS_RATE`, `VITE_DEFAULT_ORG_SLUG`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID` |
| Faako API | None; its build command does not compile or generate artifacts |
| Faako ERP | `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT`, `VITE_FAAKO_ERP_DEMO_ACCESS_MODE`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID` |
| Faako Website | `VITE_API_BASE_URL`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_ERP_DEMO_URL`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID` |
| REEBS Portal | `VITE_API_BASE_URL`, `VITE_BACKEND_BASE_URL`, `VITE_CURRENCY_API_KEY`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_EXCHANGE_API_KEY`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_GOOGLE_MAPS_KEY`, `VITE_REEBS_WEBSITE_URL` |
| REEBS Website | `VITE_API_BASE_URL`, `VITE_BACKEND_BASE_URL`, `VITE_CURRENCY_API_KEY`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_EXCHANGE_API_KEY`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_GOOGLE_MAPS_KEY`, `VITE_REEBS_ATTENDANT_RATE`, `VITE_REEBS_PORTAL_URL` |
| Stroane | `APP_ENV`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `VITE_ADMIN_PORTAL_URL`, `VITE_API_BASE_URL`, `VITE_APP_SURFACE`, `VITE_BACKEND_BASE_URL`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_PORTAL_BASE_URL`, `VITE_STOREFRONT_BASE_URL` |
| System Starter | `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID` |
| UI Workbench | `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID` |

`VITE_API_PROXY_TARGET` and `FAAKO_API_PROXY_TARGET` configure development proxies rather than production artifacts. The conservative `VITE_*` wildcard still hashes the former. Runtime-only backend variables are not build inputs.

## Environment files

For each workspace, the build input set includes:

- `.env`;
- `.env.*`;
- Turbo's normal tracked package inputs.

This covers ignored local environment files and mode-specific files such as development, staging, production, and local variants. CI should provide the same variable names through its environment rather than committing provider values.

The root manifest, lockfile, workspace definition, and `scripts/vite/**` are global dependencies. Changes to shared analytics injection or manual chunk logic therefore invalidate affected cached work.

## Deterministic REEBS catalogue and sitemap

The REEBS Website build does not perform a live inventory request. Astro generates its sitemap from tracked file routes and a committed public-only catalogue snapshot.

Normal flow:

1. `src/content/public-catalogue.json` is a committed snapshot generated from the public inventory API.
2. The snapshot generator uses an explicit public-field allowlist and stable slugs.
3. Astro generates `sitemap-index.xml` and `sitemap-0.xml` from tracked routes.
4. `pnpm sitemap:check` validates catalogue route uniqueness and, after a build, required sitemap routes.
5. The build reads only committed source and finishes with a deterministic CSP/redirect finalizer.

Inventory refresh is explicit:

```sh
pnpm --filter @faako/reebs-website run catalogue:refresh
pnpm --filter @faako/reebs-website run sitemap:check
pnpm --filter @faako/reebs-website run build
```

The refresh command may use `VITE_API_BASE_URL`, `REEBS_API_BASE_URL`, `BACKEND_BASE_URL`, or `VITE_BACKEND_BASE_URL`. It is intentionally outside the build task. Review the changed snapshot before committing.

## Cache safety

Cached:

- Astro/Vite builds that produce only `dist/**`;
- Faako API's no-compilation build result, with no declared artifact;
- REEBS Website now that its sitemap input is tracked and network-independent.

Uncached:

- Dev ERP and Stroane builds, because their existing build scripts run Prisma generation and write generated client state outside `dist/**`;
- tests, E2E, development servers, database operations, and deployment side effects.

Remote caching may be enabled later without changing these correctness rules. Dev ERP and Stroane should remain uncached until Prisma generation is separated into an explicit, safely modelled task or its complete outputs are declared.

## Local and CI contract

Use the pinned package manager and lockfile:

```sh
CI=true pnpm install --frozen-lockfile
pnpm build
```

CI and local builds must:

- start from the same commit and lockfile;
- provide the same build-time environment names when equivalent artifacts are expected;
- avoid editing generated inputs during the build;
- avoid live APIs in cached tasks;
- retain Turbo strict environment mode;
- inspect `--dry-run=json` when adding variables, outputs, or internal dependencies.

A changed build environment value must produce a different Turbo task hash. An unchanged second build should restore safe applications from cache while Dev ERP and Stroane execute again.

## Validation result

Validated on 2026-07-26:

- frozen-lockfile resolution passed with lifecycle scripts disabled;
- lint passed in all 28 active workspaces;
- type-check passed in all 13 applicable workspaces;
- tests passed in all 15 test-bearing workspaces, including all 202 Dev ERP tests and the API client and validation package suites;
- a clean build passed in all 10 build-capable applications;
- a repeated build restored all eight safely cached application builds and re-executed Dev ERP and Stroane;
- changing a representative `VITE_*` value changed the resolved Turbo build hash;
- `sitemap:check` passed with 24 deterministic routes.

The managed sandbox initially prevented Prisma from updating its user-level engine cache. The same unchanged build passed with ordinary filesystem permission; this is a tooling-sandbox limitation, not a repository build failure.
