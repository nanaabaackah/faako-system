# Faako monorepo rules

These rules apply to the whole repository.

- Keep deployable applications in `apps/`, framework-neutral reusable code in `packages/`, Python or independently deployed services in `services/`, and durable decisions/runbooks in `docs/`.
- Astro is preferred for approved content-first public sites. React/Vite remains valid and preferred for current operational applications.
- Do not introduce Next.js without an approved Architecture Decision Record (ADR). Do not replace an authentication provider or session model without a separate approved roadmap.
- Preserve the approved boundaries: byNana Portfolio, Faako Website, and REEBS Website use Astro; Dev ERP, Faako ERP, REEBS Portal, and Stroane remain on their documented React/Vite architecture; Faako API and Faako Analytics remain services. The existing `services/reebs-analytics` path is a temporary compatibility location. TTNGH is deferred until a tracked application scaffold is approved.
- Reuse `packages/types`, `packages/validation`, `packages/api-contracts`, `packages/api-client`, `packages/security`, `packages/logger`, and existing design-system packages. Do not create overlapping packages or import framework/server/database types into framework-independent packages.
- Preserve compatible API contracts. New API errors use the shared categories and request IDs; adapters protect existing consumers during adoption.
- Backend permission and tenant enforcement is mandatory and authoritative. Frontend checks are UX only. Never broaden access silently, trust a client-supplied tenant without verification, or bypass organisation scoping.
- Keep server secrets, credentials, tokens, payment keys, and private environment data out of browser bundles and logs. Secrets must never be committed. Document environment-variable names only.
- Use structured, redacted logs and keep diagnostic logs distinct from audit events. Propagate the existing request ID instead of adding a competing correlation system.
- Validate external input at the boundary. Use the shared API client where appropriate, do not retry unsafe mutations automatically, and preserve idempotency controls.
- Major architecture, authentication, permission, payment, migration, or deployment changes require focused tests, applicable repository checks, documentation, and an ADR when the framework/boundary decision changes.
- Never run destructive E2E tests against production. Use local or isolated preview/test environments and mocked third parties where practical.
- Database migrations must be reviewed, environment-scoped, reversible where practical, and deployed before code that requires them. Never reset a shared database as a routine fix.
- Preserve public URLs or add tested redirects. Keep preview and production deployments independently verifiable and retain a rollback path.
- Update the relevant architecture, migration, security, or deployment document whenever implementation changes its claims.
- Advanced analytics is a shared platform capability. Do not create application-specific
  Python analytics services or duplicate metric calculations without reviewing
  `docs/architecture/shared-analytics-architecture.md`, the shared contracts, metric
  catalogue, data-quality standards, tenant/privacy boundary and ADR first.
- Use Python only when it materially improves an approved decision or analysis. Keep
  straightforward totals, filters and presentation in SQL, application code or BI.
  Never label heuristics as AI/ML, and never expose arbitrary query/code execution.
