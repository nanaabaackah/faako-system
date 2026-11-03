# Travel With Ease — release readiness check

Reviewed 2026-11-01. Source of truth:
[implementation status, hosted evidence and recovery gates](./completion-status-2026-11-01.md).
The feature-completion brief is **not complete or production-certified**.

## Current gates

| Concern | Executable/current rule | Acceptance |
| --- | --- | --- |
| API startup | Both staging and production supported only with verified environment/organisation, migration checksums, persistent repositories and Access configuration | Staging health/readiness observed HTTP 200; production API checks timed out |
| PostgreSQL | Actual server version is diagnostic, not an exact major-version gate; isolated CI uses PostgreSQL 17 | Runtime non-superuser/no BYPASSRLS, least privileges and matching identity still required |
| Source provenance | Reviewed full `TWE_RELEASE_SHA` required by publication enqueue, not unrelated API startup | Exact deployed artifact/source marker must be verified; current public markers returned 404 |
| Portal | Built React CMS can be embedded in the same Railway API process on the protected portal hostname; separate host/proxy remains optional | Both portal roots redirect to sign-in; authenticated workflow acceptance pending |
| Browser API | Hosted `VITE_API_BASE_URL` empty; same-origin protected API routes | Do not fix sessions using public cross-origin tokens or bypass Access |
| Workers | Publication and notification commands still reject hosted environments via their local-only guard | Complete reviewed hosted orchestration before enabling automatic deployment/delivery |
| Roles | Explicit current matrix in `src/auth/permissions.js` | New Superadmin/Owner/Editor policy differs; implementation/test changes pending |
| Public release | Only approved snapshot content; indexing requires production plus explicit indexable flag | Package/tip/advanced Journal/native intake/visual preview/autosave/automation gaps remain |
| Operations | Separate credentials/resources, least privileges, approved migrations, recovery artifact | Live email receipt, monitoring, backup restore, UAT and release approval not verified |

## Security controls to retain

- Known APP_ENV values; no development/test adapters with production NODE_ENV.
- Explicit HTTPS origins, environment-specific Access issuer/audience and MFA,
  verified subject binding, provisioned identities and secure server sessions.
- No hosted legacy bearer-token/file fallback or OIDC-provider replacement.
- Backend permission, organisation and record enforcement; CSRF on mutations.
- Migration checksums, environment identity and non-superuser runtime role.
- Private R2 credentials, rights/alt metadata, bounded image imports and immutable
  derivatives. No credentials in client bundles, docs, screenshots or logs.
- Immutable publication manifests, pinned source SHA, exact artifact and marker
  confirmation; retries must not republish an obsolete snapshot.
- Fixed non-production testing recipient and production customer/notification CC.
- Rate limits, validated inputs, redacted request-ID diagnostics and audit records.

Read-only `preflight:hosted`, HTTP 200 and successful synthetic CI do not prove
MFA policy, authenticated staff access, provider delivery, UAT or restore recovery.
Do not remove fail-closed guards just to make the new completion checklist green.

## Release and rollback

Use the detailed [release gates and recovery procedure](./completion-status-2026-11-01.md#release-gates-and-recovery):
reviewed feature branch → green develop PR → staging acceptance → separate main
promotion/release approval → migration-first deployment → non-destructive smoke.
Record provider SHA/artifact and content publication marker independently.

On deployment failure retain the last verified live artifact. Restore it through
the provider, check marker/health, then reconcile publication state. Do not reset
a shared database or rebuild old content with unreviewed current code. Database
restore requires separate approval and a data-loss assessment.

## Historical decisions

These remain dated records, not active contradictory startup requirements:

- [Staging activation, 24 October](./staging-activation-2026-10-24.md)
- [Hosted startup correction, 25 October](./hosted-startup-2026-10-25.md)
- [Public release and PostgreSQL compatibility, 26 October](./public-release-2026-10-26.md)
- [Single-service hosting, 28 October](./single-service-staging-2026-10-28.md)
- [Cloudflare Access and restricted Platform Admin](./access-platform-admin-2026-10-23.md)
- [Media and image changes](./drive-r2-sync.md)
- [Migration and grants](./predeploy-migrations-2026-10-27.md)

No deployment, provider configuration change, database write, real enquiry or
email was performed in this documentation review.
