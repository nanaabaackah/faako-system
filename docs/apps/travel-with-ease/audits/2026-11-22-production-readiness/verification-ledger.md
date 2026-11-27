# Verification ledger

All commands are run from baseline `a79703098cc8358cd52ee6a9a7dbd5be2131f645`
plus this branch's documented cleanup. This ledger must be updated with final
results before merge. `NOT RUN`, `BLOCKED` and provider-unverified checks are not
passes.

| Check | Environment | Result | Evidence / reproduction |
| --- | --- | --- | --- |
| Git synchronisation and baseline | Normal checkout, read-only fetch | PASS | `develop` and `origin/develop` matched at branch creation; existing stashes/worktrees were not applied or altered. |
| Skill frontmatter | Local Ruby YAML parser | PASS | Parses concise `SKILL.md`; name and description validated. |
| Frozen install | Local | PENDING | `CI=true pnpm install --frozen-lockfile --ignore-scripts`. |
| TWE lint | Local | PENDING | `pnpm --filter '@faako/travel-with-ease-*' run lint`. |
| TWE typecheck | Local | PENDING | `pnpm --filter '@faako/travel-with-ease-*' run typecheck`; API limitation remains Finding 28. |
| Unit tests | Local | PENDING | Run each TWE workspace; an initial sandboxed portal run passed 33/34 and only local-listener setup failed with `EPERM`, so it must be rerun with listener permission. |
| Builds | Local | PENDING | Run all three TWE workspace builds. |
| PostgreSQL integration/isolated | Disposable local PostgreSQL only | PENDING | Never target a shared or production URL. |
| Foundation browser suites | Local isolated servers/browser | PENDING | Reproduce workflow suites, including 320/375/390/428/768/1024/1440 where defined. |
| Security/dependency/hygiene checks | Local | PENDING | Repository scripts, manifest/conflict checks, `git diff --check`, dependency triage. |
| Staging public site | Public HTTPS, 2026-11-22 | PASS (reachability only) | Returned 200 through Cloudflare; this is not authenticated CMS/UAT acceptance. |
| Staging API health | Public HTTPS, 2026-11-22 | PASS (liveness only) | `/healthz` returned 200 from Railway edge. |
| Production public site | Public HTTPS, 2026-11-22 | BLOCKED | Returned the intentional holding page with `X-Robots-Tag: noindex`. |
| Production API health | Public HTTPS, 2026-11-22 | FAIL | `/healthz` timed out after 15 seconds. |
| Latest staging deployment record | GitHub read-only, 2026-11-22 | PASS | Latest `twe / staging` deployment for baseline SHA recorded success. |
| Latest production deployment record | GitHub read-only, 2026-11-22 | FAIL | Latest `twe / production` record for `main` recorded failure. |
| Access/MFA, delivery, backups, alerts, UAT | Hosted authenticated | BLOCKED | No authenticated provider/dashboard or live-user acceptance performed in this audit. |

Local test fixtures, intercepted browser requests and synthetic PostgreSQL are
not production evidence. Exact failure output belongs in CI/PR logs; reports must
not copy secrets, cookies, Access assertions or customer records.
