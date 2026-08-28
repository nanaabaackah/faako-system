# Remaining technical debt

## Highest priority

1. **REEBS recovery privacy:** replace public account-state/personal-email setup responses with administrator-issued expiring setup challenges.
2. **Session invalidation:** invalidate sessions on password change, user disablement and material permission changes across authenticated apps.
3. **Astro/sharp security upgrade:** adopt an Astro release that officially supports patched `sharp`, then compare image output/builds.
4. **Tenant deployment verification:** run two-organisation staging tests and confirm production RLS/database grants, not only application helpers.
5. **Critical browser workflows:** add deterministic local Playwright journeys for portal login/logout, customers, products, stock, orders, bookings, invoices and payments.

## Platform/security

- Shared-store rate limits for horizontally scaled APIs.
- Complete CSRF/write-route matrix.
- Private FastAPI docs/host allow-list.
- Finish shared logger/request-ID adoption in legacy serverless handlers.
- File-upload quarantine/scanning.
- Production-only CSP tightening.
- Provider-neutral exception/release/source-map readiness before choosing monitoring.
- Resolve remaining development-tool audit findings through upstream releases; do not use unsafe blanket major overrides.

## Architecture/adoption

- Continue API-client migration in small verified groups.
- Continue shared domain/validation adoption without replacing proven business logic.
- Convert more byNana static content from the full React island to Astro.
- Add first-class Stroane browser specs and deterministic REEBS Portal web-server/auth fixtures.
- Decide whether Faako ERP graduates from fixture/demo to an authoritative application before adding backend complexity.
- Keep System Starter aligned with scaffold conventions and UI Workbench aligned with the design-system packages.
- Complete the deployment/directory rename from the REEBS compatibility path to
  `faako-analytics` only after service URLs, environment aliases and rollback are verified.
- Add the authorised Dev ERP operational-health snapshot producer and minimal dashboard
  only after its backend permission key and business metric owner are confirmed.
- Assign business owners and approve provisional analytics formulas/thresholds before
  targets, automated actions, external reporting or cross-application comparisons.
- Evaluate a tenant-isolated analytics store/scheduler only when history-dependent use
  cases justify its operating and privacy cost; current service remains stateless.
- Replace the legacy REEBS wildcard analytics credential with a caller-scoped entry in
  `FAAKO_ANALYTICS_SERVICE_TOKENS`; until then, constrain it with
  `REEBS_ANALYTICS_TENANT_IDS` wherever the compatibility endpoint is deployed.
- Add approved minimum-group suppression before any cross-tenant aggregate is designed.

## Public/content

- Manual assistive-technology and contrast testing per release.
- Media/CDN optimisation for REEBS and Stroane product assets.
- Verified editorial owners, review dates and evidence for public claims.
- TTNGH scaffold, payment boundaries, safeguarding/privacy content, analytics and donation/event tests only after the paused project is explicitly resumed.
