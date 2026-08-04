# Dead-code audit and cleanup

Audit date: 2026-08-04. Usage was checked with repository search and workspace dependency resolution before removal.

## Removed safely

| Group | Removed | Evidence/impact |
| --- | --- | --- |
| REEBS obsolete runtime dependencies | `brew`, browser `fs` shim, npm `psql`, npm `railway` | No source imports existed. Database scripts use the system `psql` executable and deployments use repository Railway scripts, not these npm packages. Their removal eliminated multiple critical transitive advisories. |
| Vulnerable superseded versions | jsPDF 3/4.1, old `concurrently`, old PostCSS/React Router/Nodemailer resolutions | Replaced by compatible patched versions; targeted tests/builds are required before merge. |
| Stale TTNGH command | root `dev:ttngh` script | No tracked `apps/ttngh/package.json` or source exists, so the command could never select a workspace. Reintroduce it with the approved scaffold. |
| Commercial fetch duplication | direct/native fetch wrappers in the Batch 2 REEBS/Stroane pilot modules | Replaced by existing compatibility clients while preserving response contracts. |

No public route was deleted, so no new redirect was required in this cleanup group.

## Confirmed candidates, not removed

- `apps/ttngh/dist` may exist locally as an ignored artifact, but no tracked app exists. Do not treat generated output as a source scaffold; remove/recreate only when TTNGH work resumes.
- REEBS Portal still carries legacy public-page Playwright fixtures even though the public site is Astro. Separate portal-only specs before deleting anything because the current suite also supplies useful accessibility mocks.
- `react-tsparticles`/`tsparticles-engine`, `@fortawesome/react-fontawesome`, old animation helpers and React Helmet need import-by-import removal plus visual/browser verification.
- Generated Prisma clients must not be manually edited or classified as application source; regenerate them from the pinned Prisma toolchain.
- System Starter remains a scaffold/reference and UI Workbench remains internal design-system tooling per their ADRs. Neither is dead merely because it is not production-deployed.

## Future safe groups

1. Produce an import graph for each deprecated direct dependency; remove one application group at a time and run its lint/test/build.
2. Split old REEBS public E2E fixtures from portal tests, add deterministic portal auth fixtures, then remove public-only duplicates.
3. Continue converting legacy API calls to the shared client; delete adapters only after every consumer is verified.
4. Remove retired environment names only after deployment-platform inventories and preview/production logs prove they are unused.

