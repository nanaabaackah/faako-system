# Release decision and operator runbook

## Decision: NO-GO

The production deployment failure and unavailable production API are hard gates.
The noindex holding page is not the approved launch site. Authenticated staging/
production Access, least-privilege database, backup restore, notification delivery,
monitoring acknowledgement, CMS rollback and business UAT evidence are incomplete.

Repository fixes and local green tests cannot override those facts.

## Recovery sequence

1. Pin the intended production commit and preserve the current failed deployment,
   previous working deployment and database recovery references.
2. Read the failed Railway build/pre-deploy/start logs and identify the exact
   phase. Export only redacted error evidence to the PR.
3. Verify `DATABASE_URL` and `TWE_MIGRATION_DATABASE_URL` reference the intended
   production PostgreSQL service and distinct roles. Omit redundant
   `TWE_DATABASE_TLS`; use a CA only with provider evidence.
4. Review the migration plan and production migration history. Reproduce the
   failure against an isolated equivalent database before changing code.
5. Review and test the smallest correction. Migrations deploy before dependent
   code and require an explicit production approval.
6. After approved deployment, record exact SHA/provider deployment, `/healthz`,
   `/readyz`, migration/role checks and rollback target. Do not create customer
   enquiries during verification.
7. Complete signed-out denial, invited-user MFA, revocation, CMS publish/rollback,
   Resend provider plus mailbox, monitor acknowledgement and TWE UAT checks.
8. Confirm the intended launch content and switch from holding/noindex only under
   approved release control. Verify canonical, robots, sitemap, analytics consent,
   links and responsive/accessibility acceptance.

## Backup/restore acceptance

Inspect the already-configured Railway backups for the correct production service,
schedule, retained recovery points, permissions and failure visibility. Restore a
selected point into a new isolated target, validate migrations/table counts/
constraints/application reads and record measured RPO/RTO. Never restore over the
live database during a drill. Railway backup deletion/volume replacement effects
must be reviewed before any destructive action.

## Rollback

- Application: retain and identify the previous verified Railway deployment;
  roll back only when schema compatibility has been confirmed.
- Public site: use the previously verified Pages deployment/artifact and validate
  its marker and canonical host.
- Database: prefer compatible forward fix. A restore requires explicit approval
  of target, data-loss window, downtime and post-restore reconciliation.
- Content: use immutable CMS revision/publication history; do not rewrite audit
  history or silently publish newer drafts.

## Final gate

Refetch `develop` and `main` immediately before approval. If TWE code, migrations,
lockfile, hosting workflow or provider state drifted, rerun affected inspection
and tests. A later `CONDITIONAL GO` or `GO` must link every gate to current evidence,
not to this dated assessment alone.
