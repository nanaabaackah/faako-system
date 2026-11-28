# Provider capability and responsibility assessment

This is a responsibility and duplication matrix, not evidence that every listed
provider feature is configured. Repository controls remain necessary where they
enforce business integrity, authorisation, privacy or tenant isolation.

| Capability | Primary provider/control | Application responsibility | Evidence and decision |
| --- | --- | --- | --- |
| DNS, edge TLS, public caching | Cloudflare | Correct canonical origins, cache-safe responses and redirect tests | Public origins resolve through Cloudflare. Dashboard configuration was not changed. |
| Public web hosting | Cloudflare Pages | Build deterministic reviewed Astro artifacts; publication marker and approved content | Staging is live. Production currently serves the noindex holding page. Pages deployment verification/rollback is reused. |
| Staff edge identity and MFA | Cloudflare Access | Validate signed Access assertions, authorise role/tenant server-side, bind invitations to verified email | Do not replace Access or treat it as application authorisation. Negative/revocation acceptance is blocked. |
| Bot challenge | Cloudflare Turnstile | Verify token server-side, validate enquiry input, rate-limit and preserve idempotency | Edge challenge supplements rather than replaces API controls. |
| API/worker compute | Railway | Health/readiness, bounded timeouts, graceful shutdown, job idempotency, business retries | Staging API answered; production API timed out. Exact production failure requires Railway logs. |
| PostgreSQL | Railway PostgreSQL | Migrations, constraints, organisation scope, least-privilege roles and safe transactions | Use explicit service reference variables. Production role/grant evidence is blocked. |
| Database/volume backups | Railway backups | Retention approval, coverage inventory, restore drill, data validation and RPO/RTO record | Existing provider backups are authoritative. Do not add a duplicate cron/`pg_dump`/R2 system by default. |
| Deployment identity | Railway `RAILWAY_GIT_COMMIT_SHA`; Pages build metadata | Compare API/worker/publication source and reject mismatches | Repository already consumes Railway Git SHA. Do not maintain a copied release-SHA variable. |
| Media object storage | Cloudflare R2 | Private object keys, rights metadata, publication selection and authorisation | Separate from PostgreSQL backup responsibility; unauthenticated/private acceptance remains operator evidence. |
| CMS publication transaction | Application plus Pages API | Immutable snapshot, job locking, content digest, exact deployment confirmation, audit and rollback intent | This is business state and cannot be delegated entirely to Pages. Reuse Pages upload/rollback instead of creating a second host. |
| Email transport | Resend | Minimal payload, outbox, idempotency, environment recipient rules, retry/reconciliation | Provider acceptance differs from mailbox delivery; production evidence is blocked. |
| CI and review | GitHub Actions/environments | Targeted tests, migration review, protected approvals and exact-SHA evidence | CI is evidence, not deployment acceptance. |
| Monitoring and alerts | Provider/native tools where configured | Meaningful application signals, ownership, acknowledgement and drills | Actual alert rules/delivery were not authenticated and remain blocked. |
| “Zero One” | Unidentified | None can safely be removed or delegated until identity and scope are proven | No scoped repository evidence identified this service or responsibility. Preserve and mark NOT VERIFIED. |

## Railway decisions

- `DATABASE_URL` and `TWE_MIGRATION_DATABASE_URL` should be explicit references
  to the correct environment's PostgreSQL service. The migration identity remains
  distinct even when it uses the same database endpoint.
- Railway's injected `PORT` and `RAILWAY_GIT_COMMIT_SHA` should be consumed in
  hosted services. Manually copying either creates drift.
- `TWE_DATABASE_TLS=require` is redundant because the code defaults to verified
  TLS. Keep `TWE_DATABASE_CA` absent unless provider certificate-chain evidence
  proves a private CA is required. Never disable certificate verification.
- Railway backups currently document daily retention of six days, weekly
  retention of 27 days and monthly retention of 89 days. Configuration and
  actual recovery points must be checked in the project; documented defaults are
  not project evidence. Restores must target an isolated recovery volume/service.

## Proxy and rate-limit decision for Finding 13

The staging API response identifies the Railway edge directly, while Express
currently sets `trust proxy` to `false` and the in-memory limiter keys `req.ip`.
That can collapse requests onto a proxy address, while multiple replicas would
hold independent counters. Cloudflare rate limiting cannot be assumed to protect
a directly reachable Railway origin.

Do not merge the historical Issue 13 branch as-is. First document the supported
Railway forwarding headers and origin reachability, then choose a bounded trusted
proxy function and/or a shared store or provider limiter. Preserve application
limits for sensitive routes as defence in depth. Add tests for forged forwarded
headers and multi-instance semantics before rollout.

## Provider references

- [Railway reference variables](https://docs.railway.com/variables/reference)
- [Railway variable references](https://docs.railway.com/variables)
- [Railway platform best practices](https://docs.railway.com/platform/best-practices)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway backups](https://docs.railway.com/volumes/backups)
- [Cloudflare Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [Cloudflare Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Cloudflare Access MFA requirements](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/)
