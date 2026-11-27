# TWE release preparation — 25 November 2026

## Current baseline

Staging candidate: `d3114b53d4dbc1c8be9ecdf62307b8710b3521ea` (P2 and refresh-race fix, PRs #255/#256). GitHub develop CI, TWE foundation, Notebook Impact and Notebook Sync passed. Railway staging API, notification worker and publication worker reported successful deployments on that SHA. The operator confirmed Cloudflare and live staging acceptance. This is staging evidence, not a production release or a recorded receipt of every email or analytics event.

| Gate | Evidence / remaining work |
| --- | --- |
| P0/P1/P2 implementation | Staging accepted; production-specific P0 gates below remain open. |
| P3-24 Documentation | Current operational guide and readiness gates supersede dated implementation claims. |
| P3-25 Cleanup | Retire obsolete demo-era browser entry points; retain real regression coverage, migrations and asset provenance. |
| P3-26 Regression | Require fresh CI for this branch and develop after merge; record hosted smoke evidence separately. |
| P3-27 Production preparation | Open: production API migration/runtime readiness, worker activation, backup/restore evidence and approved snapshot promotion. |
| P3-28 Cutover | Open: verified production publication, smoke and rollback readiness before retiring holding page. |
| P3-29 Software release versioning | Required: synchronize product version, verify deployed component identities, prepare release notes and register the first production tag after cutover. See [release versioning](./software-versioning.md). |

## Operating model

- Public Astro website, React/Vite CMS embedded by the Railway Express API, PostgreSQL, separate Railway notification and publication workers; Cloudflare Pages, Access and private R2; Resend for email.
- Superadmin (platform_admin), Owner and Editor permissions are enforced server-side. Editors draft/preview; authorised publishers publish. No separate staging approval queue after launch. Cloudflare Access session limits and MFA remain provider-managed; application sessions preserve the verified assertion expiry and revalidate on foreground return.
- Autosave persists drafts; Save draft is the fallback. Preview renders a short-lived private Astro snapshot. Publish queues one immutable publication job; the worker builds the pinned source, deploys to Pages and checks the artifact and custom domain before marking it live. Never equate Saved or Queued with Live.
- Pending CMS updates prompt for refresh, automatically refresh at 02:00 GMT when safe, and defer while work is unsaved or the session is unsafe. Use the shared Faako controls and approved icons, not emojis. Retain the approved website typography and mobile layout.
- General, service and package enquiry acknowledgements use contextual active templates with the applicable fallback. Draft email changes must be saved and activated; verify actual receipt separately from preview. The notification worker sends queued mail with environment-specific routing.
- GA4 is consent-controlled, excludes private questionnaire routes and does not accept visitor-supplied event fields. Verify actual reporting separately. Public discovery metadata follows the approved published content and environment indexing policy.

## Safe release sequence

1. From the reviewed staging SHA, capture the latest verified publication manifest, source SHA, content fingerprint and deployment marker. Verify the intended published content, rather than copying the staging database or unpublished drafts.
2. Inspect production Railway settings and the failed API predeploy diagnostics. Use existing provider references; do not duplicate variables, credentials or services. Keep migration and runtime roles distinct and verified TLS enabled. Confirm the API builds the embedded CMS, existing predeploy uses db:deploy, and both workers use the reviewed source and production-only settings.
3. Verify the current backup and a restore drill against an isolated database. Record recovery owner, time and tested recovery point. Never reset a shared database, edit an applied migration or restore over production as a routine fix.
4. In the intended production environment, run the existing read-only migration check before a separately authorised deployment. No initialization or migration writes at this gate.
5. Export the accepted staging snapshot through the existing promotion script, validate the private bundle offline, and reconcile the intended production target. Do not commit or publicly upload the bundle. Import only after explicit production authorisation; verified repeat imports are no-ops only if target state and receipt match. Preserve the holding page until cutover.
6. Verify the initial production job, exact source and deployment markers, assets, canonical URLs, indexing, Turnstile, consent, real enquiry delivery and authenticated roles. Retain the prior verified artifact. If verification fails, stop and reconcile before retrying; rollback the public artifact and verify its marker. Database recovery requires separate approval and data-loss assessment.

Commands (from the repository root, in the explicitly intended environment):

```bash
pnpm --filter '@faako/travel-with-ease-*' run lint
pnpm --filter '@faako/travel-with-ease-*' run typecheck
pnpm --filter '@faako/travel-with-ease-*' run build
pnpm --filter '@faako/travel-with-ease-*' run test
pnpm --filter @faako/ui test
pnpm --filter @faako/travel-with-ease-api test:db:isolated
pnpm --filter @faako/travel-with-ease-api db:deploy --check-only
pnpm --filter @faako/travel-with-ease-api promotion:import /secure/path/twe-launch.json --dry-run
```

The first six commands are local/isolated checks; the last two are separate diagnostic gates. Do not run them with shared production credentials during CI. The migration check requires the intended configured database; dry-run validates the bundle offline, not target readiness. No live writes, provider changes, backup restoration or production promotion are authorized by this document.

## Regression coverage

The existing [TWE foundation workflow](../../../.github/workflows/travel-with-ease-foundation.yml) is the comprehensive test entry point. It includes lint, typecheck, frozen-lockfile builds, embedded CMS build, unit tests, shared UI compatibility, role-based CMS navigation/editor/template tests, responsive update notices, real Astro public routes, consent/privacy, keyboard and axe accessibility, private preview, local workspace, isolated PostgreSQL integration and registry checks. Use synthetic fixtures and loopback-only browser tests; never submit real customer enquiries in CI. Historical local scripts that assume retired demo pages or pre-Stepper layouts are superseded by the active scripts.

Hosted acceptance records must distinguish code/CI evidence, provider deployment, operator-confirmed staging testing, actual email receipt, GA4 reporting and backup/restore. Do not infer one from another or increase a readiness score without supporting evidence.

Related: [readiness check](./readiness-check.md), [production hardening](./release-hardening-2026-11-24.md), [publication and promotion](./cms-publishing-and-production-promotion-2026-11-20.md), [client CMS guide](./client-cms-guide.md).
