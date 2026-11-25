# Travel With Ease — release readiness check

Reviewed 2026-11-25. Current source: [P3 release preparation](./release-preparation-2026-11-25.md). Staging acceptance is operator-confirmed on the P2 correction baseline `d3114b5`; this does not certify production.

## Current gates

| Concern | Executable/current rule | Acceptance |
| --- | --- | --- |
| API startup | Environment identity, checksummed migrations, persistent repositories and Access | Staging deployment successful; latest observed production API deployment failed |
| PostgreSQL | Distinct runtime/migration roles, verified TLS, read-only predeploy check and isolated integration tests | Production migration and backup/restore evidence open |
| Source provenance | Reviewed Git-linked SHA, exact publication artifact and marker | Staging accepted; production marker open |
| Portal | Embedded React CMS on protected same-origin hostname; verified server session | Staging accepted; production role and Access smoke open |
| Workers | Separate notification and publication workers on matching source | Both staging workers successful; production activation unverified |
| Roles | Superadmin (platform_admin), Owner and Editor; backend enforcement | Staging accepted; production smoke open |
| Public release | Approved published snapshot, controlled worker deployment; consent and indexing policy | Staging accepted; production content promotion and cutover open |
| Operations | Existing provider references, least privilege, backup and recovery | Actual email receipt, GA4 reporting and production restore/cutover evidence open |

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
- Environment-specific non-production test routing and production customer notification routing; verify actual receipts separately.
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
