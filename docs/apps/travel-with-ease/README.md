# Travel With Ease documentation

Latest implementation: [staging API activation — 2026-10-24](./staging-activation-2026-10-24.md).

Staff login deployment: [portal hosting preparation](./portal-hosting-preparation-2026-10-23.md).

## Start here

1. [Product baseline](./Travel_With_Ease_Solution_Roadmap.md) — October scope; Prompt 02 confirms MVP requirements, while client legal/commercial approvals remain separate.
2. [Design and engineering standard](./design-engineering-standard.md) — governing public, portal, backend, environment and delivery rules.
3. [Repository audit — 2026-10-11](./repository-audit-2026-10-11.md) — current/target architecture, code-backed gap matrix, fresh screenshots, API/data model, security register, infrastructure status and approval decisions.
4. [Implementation plan](./implementation-plan.md) — verified Trello task mappings, detailed Prompt 03/04 slices, acceptance/tests, effort and critical path. Planning does not authorize implementation or production release.

## Supporting references

- [Cloudflare Access and Platform Admin](./access-platform-admin-2026-10-23.md) — authentication ADR, role matrix, bootstrap, MFA checklist and release blockers.
- [Media, branding and discovery follow-up](./media-sharing-followup-2026-10-23.md) — approved photo inventory, local QA and outstanding live-service checks.
- [Staging operations and ownership](./staging-operations.md) — Baaba/Faako/TWE responsibilities, manual setup, publication, mail and recovery gates; no deployment claimed.

- [Prompt 03 implementation record](./foundation-implementation.md) — current changes, migration commands, dependency decision and outstanding gates; not a completion report.
- [Architecture](./architecture.md) — preserved historical foundation and current-scope precedence.
- [Environment contract](./env.md) — local/staging/production isolation and current deployed-mode gaps.
- [Security architecture](./security.md) — classifications and target controls; see the newer audit for implemented versus missing controls.
- [Implementation notes](./implementation-notes.md) — existing scaffold behaviour.
- [Historical roadmap and decisions](./roadmap.md) — earlier phases are not current launch requirements; its decision IDs are not Trello card IDs.
- [Visual audit — 2026-10-10](./audits/2026-10-10/visual-audit.md) — original screenshot-supported design audit, preserved as dated evidence.
- [Progress/change log](./progress-log.md) — dated work and actual verification results.

Current verified status: local foundation; no verified staging/production deployment. Production startup remains blocked pending reviewed persistence/authentication. Use [Prompt 03 handoff](./implementation-plan.md#prompt-03-handoff-scope) for the next authorized implementation task.

The public website uses the shared consent-controlled GA4 integration. The user-supplied TWE stream is configured locally through `PUBLIC_GA_MEASUREMENT_ID` and was verified in the local build on 2026-10-23. Do not add a second inline Google tag: the existing loader loads it after analytics consent and respects Do Not Track. Set the same variable in the **public website's build environment**, then rebuild/deploy the approved site and complete `docs/architecture/google-analytics-architecture.md`'s hosted verification checklist. Production analytics receipt has not been verified. Do not configure tracking on the staff portal or reuse another Faako site's measurement ID.
