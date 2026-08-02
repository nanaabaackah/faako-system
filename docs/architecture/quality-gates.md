# Repository quality gates

Date: 2026-07-26

## Contract

The repository-level JavaScript/TypeScript contract is:

- `pnpm lint`: static linting for every active pnpm workspace.
- `pnpm typecheck`: TypeScript or Astro diagnostics for every workspace where a type checker is currently applicable.
- `pnpm test`: unit and integration tests only. Browser E2E is deliberately excluded.
- `pnpm build`: every workspace with a build artifact or an intentional no-compilation API build check.
- `pnpm check`: runs lint, type-check, unit/integration tests, and build in that order and stops on the first failure.
- `pnpm test:e2e`: separate Playwright orchestration; use targeted workspace commands when services or fixtures differ.
- `pnpm test:python`: REEBS analytics tests using its isolated Python environment.

An em dash in the inventory means that no applicable check or test asset currently exists. It does not mean that Turbo silently skips a known suite.

## Workspace inventory

| Workspace | Lint | Type-check | Unit/integration test | Build | E2E |
| --- | --- | --- | --- | --- | --- |
| `@faako/bynana-portfolio` | `eslint .` | `astro check` | SEO and generated-output Node tests | Astro static build and image optimization | — |
| `@faako/dev-erp` | `eslint .` | `tsc --noEmit` | `node --test` | Prisma generate and Vite build | Playwright, separate |
| `@faako/faako-api` | `eslint .` | —; JavaScript | `node --test` | Intentional no-compilation check | — |
| `@faako/faako-erp` | `eslint .` | —; JavaScript | `node --test` | Vite build | — |
| `@faako/faako-website` | `eslint .` | `astro check` | `node --test tests/*.test.mjs`; production Playwright smoke script | Astro static build plus CSP finalizer | — |
| `@faako/reebs-portal` | `eslint .` | —; JavaScript application | `node --test` | Vite build | Playwright, separate |
| `@faako/reebs-website` | `eslint .` | —; JavaScript application | —; none found | Sitemap generation and Vite build | Script exists, but no specs/config were found |
| `@faako/stroane-web` | `eslint .` | `tsc -b` | `node --test` | Prisma generate and Vite build | Playwright, separate |
| `@faako/system-starter` | `eslint .` | —; JavaScript | —; none found | Vite build | — |
| `@faako/ui-workbench` | `eslint .` | —; JavaScript | —; none found | Vite build | — |
| `@faako/audit` | `eslint src` | —; JavaScript | `node --test` | —; source-consumed | — |
| `@faako/api-client` | `eslint src test` | `tsc --noEmit -p tsconfig.json` | Node test with native TypeScript stripping | —; source-consumed | — |
| `@faako/api-contracts` | `eslint src test` | declaration check with `tsc --noEmit` | `node --test` | —; source-consumed | — |
| `@faako/config` | `eslint src` | `tsc --noEmit -p tsconfig.json` | `node --test` | —; source-consumed | — |
| `@faako/core` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; none found | —; source-consumed | — |
| `@faako/email-kit` | `eslint src` | —; CommonJS | —; none found | —; source-consumed | — |
| `@faako/finance` | `eslint src` | —; JavaScript | `node --test` | —; source-consumed | — |
| `@faako/layout` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; none found | —; source-consumed | — |
| `@faako/logger` | `eslint src` | —; JavaScript | —; none found | —; source-consumed | — |
| `@faako/notifications` | `eslint src` | —; JavaScript | `node --test` | —; source-consumed | — |
| `@faako/offline-sync` | `eslint src` | —; JavaScript/JSX | `node --test` | —; source-consumed | — |
| `@faako/org-settings` | `eslint src` | —; JavaScript | `node --test` | —; source-consumed | — |
| `@faako/security` | `eslint src` | —; JavaScript with consumer declarations | —; none found | —; source-consumed | — |
| `@faako/theme` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; none found | —; source-consumed | — |
| `@faako/types` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; type-only | —; source-consumed | — |
| `@faako/ui` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; none found | —; source-consumed | — |
| `@faako/utils` | `eslint src` | `tsc --noEmit -p tsconfig.json` | —; none found | —; source-consumed | — |
| `@faako/validation` | `eslint src test` | declaration check with `tsc --noEmit` | `node --test` | —; source-consumed | — |
| `reebs-analytics` | Python tooling applies | Python/Pydantic import-time checking only | `python -m pytest` through `pnpm test:python` | Docker/Python service; outside Turbo | — |

`apps/ttngh` is not listed as an active workspace because it has no source manifest. The three manifest-less package placeholders are also outside the executable gate.

## Type-check design

The root `tsconfig.package.json` is the baseline for source-consumed TypeScript packages. Package-local `tsconfig.json` files provide correct source roots. `@faako/config` is transitional mixed JS/TS: TypeScript checks its TypeScript entry and module resolution while `allowJs` prevents untyped JavaScript exports from being mistaken for missing modules. Astro uses `astro check`, and application-specific TS projects retain their own configuration.

## Unit versus E2E policy

`test` means deterministic unit or integration tests that do not require a browser, long-running application stack, or external fixture setup. Playwright commands remain under `test:e2e`. This prevents the ordinary test gate from unexpectedly launching browsers while ensuring all existing Node suites are discovered.

Dev ERP's four HTTP integration assertions in `backend/http/app.test.js` create an ephemeral HTTP server on `127.0.0.1`. That listener is necessary because the tests verify the composed Express application through real HTTP semantics. The managed filesystem sandbox rejects the bind with `listen EPERM`; the unchanged tests pass with ordinary local/CI loopback permission. They must not be skipped or weakened.

## Python isolation

REEBS analytics is intentionally outside the pnpm workspace. Use:

```sh
python3 -m venv services/reebs-analytics/.venv
services/reebs-analytics/.venv/bin/python -m pip install -e 'services/reebs-analytics[dev]'
pnpm test:python
```

On Windows, use `services/reebs-analytics/.venv/Scripts/python.exe`. `REEBS_ANALYTICS_PYTHON` may name another project-isolated interpreter. Do not install pytest globally. The current machine blocker is exact and reproducible: the available system `python3` reports `No module named pytest`.

## Turborepo behavior

- `lint` is cacheable and declares no outputs.
- `typecheck` depends on dependency type-checks and declares no generated outputs.
- `test` is not cached because existing suites read environment files and runtime state.
- `test:e2e` is not cached.
- `build` depends on dependency builds, hashes build-time environment inputs and package-local environment files, and declares `dist/**` by default.
- Dev ERP and Stroane builds remain uncached because Prisma generation writes outside the declared application artifact.
- Faako API overrides the default build output with an empty output list because its build is a no-compilation check.
- `dev` remains persistent and uncached.

Unsafe build and test caching remains disabled deliberately. The detailed cache contract is documented in `docs/architecture/turbo-build-system.md` and `docs/deployment/build-determinism.md`.

## Validation result

On 2026-07-26:

- `CI=true pnpm install --frozen-lockfile --ignore-scripts` passed against the updated lockfile;
- `CI=true pnpm install --offline --frozen-lockfile --ignore-scripts` also passed across all 29 workspace projects after the workspace links were refreshed;
- the aggregate `pnpm check` command passed end to end;
- lint passed in 28 workspaces, with existing React hook/fast-refresh warnings;
- type-check passed in all 13 applicable workspaces;
- the standard test gate passed in all 15 test-bearing workspaces with ordinary loopback permissions;
- the Dev ERP onboarding regression file passed 7/7;
- build passed in all 10 build-capable workspaces;
- REEBS analytics could not start because the local Python interpreter lacks pytest.
