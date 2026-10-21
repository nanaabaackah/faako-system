# Travel With Ease documentation

## Start here

1. [Product baseline](./Travel_With_Ease_Solution_Roadmap.md) — October scope; Prompt 02 confirms MVP requirements, while client legal/commercial approvals remain separate.
2. [Design and engineering standard](./design-engineering-standard.md) — governing public, portal, backend, environment and delivery rules.
3. [Repository audit — 2026-10-11](./repository-audit-2026-10-11.md) — current/target architecture, code-backed gap matrix, fresh screenshots, API/data model, security register, infrastructure status and approval decisions.
4. [Implementation plan](./implementation-plan.md) — verified Trello task mappings, detailed Prompt 03/04 slices, acceptance/tests, effort and critical path. Planning does not authorize implementation or production release.

## Supporting references

- [Prompt 03 implementation record](./foundation-implementation.md) — current changes, migration commands, dependency decision and outstanding gates; not a completion report.
- [Architecture](./architecture.md) — preserved historical foundation and current-scope precedence.
- [Environment contract](./env.md) — local/staging/production isolation and current deployed-mode gaps.
- [Security architecture](./security.md) — classifications and target controls; see the newer audit for implemented versus missing controls.
- [Implementation notes](./implementation-notes.md) — existing scaffold behaviour.
- [Historical roadmap and decisions](./roadmap.md) — earlier phases are not current launch requirements; its decision IDs are not Trello card IDs.
- [Visual audit — 2026-10-10](./audits/2026-10-10/visual-audit.md) — original screenshot-supported design audit, preserved as dated evidence.
- [Progress/change log](./progress-log.md) — dated work and actual verification results.

Current verified status: local foundation; no verified staging/production deployment. Production startup remains blocked pending reviewed persistence/authentication. Use [Prompt 03 handoff](./implementation-plan.md#prompt-03-handoff-scope) for the next authorized implementation task.

The public website has the shared consent-controlled GA4 integration, but no local `PUBLIC_GA_MEASUREMENT_ID` is configured and no production analytics receipt is verified. Create a Travel With Ease-specific GA4 web stream only when the public deployment is approved, configure that public ID in the hosting environment, and complete `docs/architecture/google-analytics-architecture.md`'s hosted verification checklist. Do not reuse another Faako site's measurement ID.
