---
name: faako-application-readiness
description: Audit and safely remediate a Faako application for production readiness, provider overlap, cleanup, security, cost, and release evidence. Use for a named Faako app or bounded set of app paths; do not use for ordinary feature work.
---

# Faako Application Readiness

## Inputs

Establish these before classifying findings:

- target application and shared-consumer paths;
- baseline branch and pinned commit;
- local, CI, staging, and production environment matrix;
- prior audit sources and finding-ID namespace;
- provider-access and mutation limits;
- approved design, business, architecture, and scope constraints.

If an input cannot be recovered, record it as unverified and continue from repository evidence. Never invent provider state or restart an existing finding register under new IDs.

## Workflow

1. Preserve the current checkout and synchronize safely. Inventory worktrees, stashes, local changes, branches, pull requests, and deployment evidence before creating a normal review branch. Do not reset, force-push, deploy, or alter live providers without explicit authority.
2. Map entrypoints, routes, jobs, migrations, assets, tests, deployment configuration, dynamic consumers, and relevant shared packages. Read [audit domains](references/audit-domains.md) for the selected application surfaces.
3. Build the provider capability and environment-variable inventories before recommending infrastructure. Prefer verified Railway, Cloudflare, GitHub, and existing-service capabilities; retain application controls needed for business logic, authorization, integrity, or defense in depth.
4. Reconcile prior findings and assign new IDs only after the highest preserved ID. Use the evidence schema in [findings and evidence](references/findings-and-evidence.md).
5. Audit first, then prioritize. Apply the smallest cohesive correction per finding, with focused tests and current documentation. Do not weaken a test or security boundary to obtain a pass.
6. Separate local/CI evidence from hosted acceptance. Apply the decision rules in [release gates](references/release-gates.md); unexecuted or unauthenticated checks remain `NOT VERIFIED` or `BLOCKED`.

## Provider-first rules

- Confirm whether a provider feature covers the same requirement and threat model before removing custom code.
- Railway-provided metadata and reference variables should replace manually copied deployment/service values when their scope matches.
- Treat configured Railway backups as existing capability; verify schedule, retention, coverage, restore points, and drill evidence instead of adding generic backup jobs.
- Distinguish Cloudflare edge controls from application authorization, tenant enforcement, CSRF, validation, idempotency, and database constraints.
- Identify an ambiguously named service from repository/provider evidence before assessing overlap. If identity is unresolved, preserve it and mark it unverified.
- Never expose credentials, provider exports, customer data, tokens, cookies, or private logs in reports.

## Completion

Deliver a linked audit register, provider and variable inventories, cleanup results, verification ledger, release decision, rollback notes, and remaining operator actions. A `GO`, `CONDITIONAL GO`, or `NO-GO` must follow the release gates, not schedule pressure.
