# Checkpoint and reconciled findings

## Synchronisation checkpoint

| Item | Audited state |
| --- | --- |
| Normal checkout | `/Users/Nana/Desktop/Developer/faako-system` |
| Baseline | `develop` at `a79703098cc8358cd52ee6a9a7dbd5be2131f645` |
| Remote baseline | `origin/develop` matched when the branch was created |
| Review branch | `audit/twe-readiness-cleanup-20261122` |
| Production branch observed | `main` / `origin/main` at `f1bd33c8b6ce86a1a595a5cb0658b9e10082868f` |
| Preserved local state | Existing stashes, branches, bundle and normal checkout retained; no stash applied |
| Open TWE PR code | Excluded from baseline; no open TWE PR appeared in the read-only PR inventory |

The untracked historical remediation record was recovered read-only from the
preserved pre-consolidation stash. Its changes were not applied. Recent TWE PRs
through #224 were reconciled as merged; #220 supplies the current CMS publication
and promotion baseline and #224 supplies renamed Pages-host verification.

## Preserved register

`FIXED` means repository correction exists and has local evidence; it does not
imply hosted deployment. `BLOCKED` means required hosted or operator evidence is
missing or a current launch gate fails.

| ID | Finding | Status at this audit | Reconciliation |
| --- | --- | --- | --- |
| 01 | Cloudflare Access/MFA policy verification | BLOCKED | Positive-path evidence exists historically; current negative, revocation and full production binding evidence is incomplete. |
| 02 | Installer/initial Owner lifecycle | FALSE POSITIVE | No unsafe repository installer remains; hosted one-time setup-variable cleanup is still an operator check. |
| 03 | Session persistence/token rotation | FIXED | Merged in PR #178; local tests cover repository behaviour. Hosted renewed-token acceptance is not separately verified. |
| 04 | Enquiry list privacy | FIXED | Merged in PR #183; list responses remain deliberately minimal and detail access is separate. |
| 05 | Sensitive information in enquiry notes | FIXED | Merged in PR #184 with boundary validation and focused tests. |
| 06 | Notification payload retention | FIXED | Merged in PR #185; terminal payloads are cleared and migration 016 enforces the invariant. Production migration state is unverified. |
| 07 | Enquiry retention/deletion | OPEN | Explicitly skipped during sequential remediation; no deletion policy or approved retention implementation is claimed. |
| 08 | Database least privilege/tenant isolation | BLOCKED | Code enforces organisation scope and checks unsafe roles; actual production grants and runtime identity need provider-side evidence. |
| 09 | Database backup/disaster recovery | BLOCKED | Railway backups are reported as configured and must be used, not duplicated. Schedule, coverage, retained points and a restore drill were not independently verified. |
| 10 | Migration integrity/deployment compatibility | BLOCKED | Staging deployment succeeded; latest recorded production deployment failed. Exact Railway pre-deploy failure evidence remains unavailable. |
| 11 | Legacy enquiry idempotency | FIXED | Current compatibility path and tests preserve mutation idempotency. |
| 12 | Secure staff invitation delivery | FIXED | PR #186 delivers email-only invitations bound to the Access-verified email. Hosted provider acceptance and mailbox delivery remain separate gates. |
| 13 | Trusted proxy/rate limiting | OPEN | An unmerged historical branch is migration-number-conflicted and assumes a solution before ingress topology is proven. Provider-first design is required. |
| 14 | CMS preview resource isolation | FIXED | Actor/organisation isolation, strict paths and preview CSP are implemented and tested. |
| 15 | Temporary preview file cleanup | OPEN | Cleanup runs opportunistically during preview creation; process exit/orphan recovery is not complete. |
| 16 | Multi-instance preview compatibility | OPEN | Preview state and build coordination are in-memory and per-process. |
| 17 | Enquiry email delivery worker | FIXED | Bounded PostgreSQL outbox worker exists; production scheduling and delivery acceptance are unverified. |
| 18 | Notification recovery/monitoring | FIXED | Retry/terminal handling exists; hosted alerts, acknowledgement and recovery drill remain unverified. |
| 19 | CMS publication/deploy verification/rollback | FIXED | PR #220 provides snapshot, deployment verification and rollback workflow. Authenticated provider acceptance remains unverified. |
| 20 | Health checks/alerts | BLOCKED | `/healthz` and `/readyz` exist; production health timed out and provider alert delivery is unverified. |
| 21 | Branch consistency/indexing | BLOCKED | Staging tracks current `develop`; latest production record failed and the production public site is still a noindex holding page. |
| 22 | Payments/booking scope | ACCEPTED | Payments and booking are outside the approved current scope and are not represented as launch capabilities. |
| 23 | Package/tier enquiry consistency | FIXED | Current package and group enquiry flows use shared validated mappings and focused acceptance tests. |
| 24 | Portal navigation persistence | FIXED | Current portal state/navigation behaviour is covered by local tests. |
| 25 | Accurate enquiry dashboard reporting | FIXED | Dashboard values come from persisted enquiry queries rather than demo counts; hosted acceptance is not inferred. |
| 26 | Reserved by historical register | ACCEPTED | Preserved to avoid renumbering later historical audit references. |
| 27 | Oversized modules | OPEN | Several API/portal modules remain costly to review and change; split only along stable responsibilities with behaviour-preserving tests. |
| 28 | API semantic typecheck | OPEN | The API `typecheck` script performs JavaScript syntax checks, not semantic TypeScript/JS analysis. |
| 29 | Reserved by historical register | ACCEPTED | Preserved to avoid reusing an already referenced number. |
| 30 | Unused lint suppressions | FIXED | Removed from the two public-site components in this branch. |
| 31 | Retired OIDC adapter and unused dependencies | FIXED | Deleted unreferenced adapter/config modules and removed `openid-client` and unused portal `react-router-dom`; Access/session enforcement is unchanged. |
| 32 | Invitation refresh hook dependency | FIXED | Stabilised the refresh callback and made the effect dependency-correct. |

No later finding number is assigned merely to restate an existing launch gate.
The production deployment/API failure is tracked under 10, 20 and 21 rather than
duplicated as a new finding.
