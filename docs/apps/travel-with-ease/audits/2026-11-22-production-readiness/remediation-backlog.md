# Remediation backlog

Prioritisation follows launch impact and dependency order rather than historical
sequence alone.

## Zero One — recover production deploy/API health

The first correction is operational diagnosis under Findings 10, 20 and 21, not
a speculative code patch. Obtain the failed Railway production deployment's
build/pre-deploy/start logs and exact deployed SHA without exposing secrets.
Confirm the PostgreSQL service reference, migration-role reference, certificate
chain and failing migration. Keep verified TLS; do not add `rejectUnauthorized:
false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, a copied database URL, or an unreviewed
migration bypass. Reproduce against an isolated equivalent, then submit the
smallest focused correction through normal review.

Exit evidence: successful production deploy record for the approved SHA,
responsive `/healthz` and `/readyz`, migration inventory/role checks, holding-page
decision, rollback reference and operator acceptance. Deployment still requires
separate approval.

## Next ordered work

1. Finding 13: prove Railway ingress/forwarding/origin topology, then design and
   test trusted proxy plus shared/provider rate limiting. Do not cherry-pick the
   conflicted historical branch.
2. Finding 09: inspect existing Railway backup schedule/coverage and perform an
   isolated restore drill. Do not build duplicate backup infrastructure.
3. Finding 01 and 08: capture Access negative/revocation and actual database role/
   tenant evidence.
4. Finding 07: obtain a business-approved retention/deletion policy, legal basis,
   audit requirements and recovery window before implementation.
5. Findings 15 and 16: make preview cleanup/coordination deterministic and
   multi-instance safe.
6. Findings 27 and 28: split review-heavy modules with characterisation tests and
   establish truthful semantic API type checking.
7. Finish authenticated CMS publish/rollback, email provider/mailbox, alert drill,
   accessibility/browser, analytics/privacy and TWE UAT acceptance.

Each implementation remains one cohesive issue per branch/PR. No item here grants
permission to deploy, mutate providers, run a production migration or merge.
