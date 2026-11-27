# Audit domains

Read only the sections relevant to the selected application, but do not omit a surface the application actually owns.

## Repository and architecture

- Pin the baseline and compare the target branch, production branch, open pull requests, deployment records, and prior audit artifacts.
- Trace framework entrypoints, routes, workers, scheduled commands, migrations, configuration, assets, tests, documents, and shared-package consumers.
- Preserve the architecture recorded in repository guidance. Require an ADR for a changed framework, authentication model, major boundary, or deployment architecture.

## Provider and cost

- Matrix: capability, provider, native feature, application implementation, variables, duplication, necessity, action, cost, and security implication.
- Railway: services, Git source, variables/references, private networking, health checks, predeploy commands, restarts, replicas, workers, jobs, metrics, logs, PostgreSQL, backups, PITR, restore, and egress.
- Cloudflare: Pages projects/branches, deployment path, custom domains, DNS/TLS, Access, Turnstile, R2, caching, headers, redirects, analytics, rollback, and deployment history.
- GitHub and other services: CI, environments, deployment records, Resend delivery, monitoring, analytics, and any named existing integration.
- Report measured cost separately from estimates. Do not introduce a paid service when current infrastructure meets the verified requirement.

## Application and data

- Frontend/public site: content mapping, routes, SEO, indexing, accessibility, responsive/touch/keyboard/no-JS/reduced-motion behavior, performance, analytics, and broken links.
- Portal/CMS: authentication, authorization, editing, autosave, conflict handling, drafts, preview, publication, revisions, media, errors, and responsive behavior.
- API: boundary validation, permissions, tenant enforcement, sessions, CSRF/CORS/origin handling, proxy trust, rate limits, error contracts, logging, integrations, jobs, idempotency, and timeouts.
- PostgreSQL: migration order/integrity, constraints, indexes, transactions, runtime/migration roles, environment identity, retention, backup/restore, and compatibility.
- Communications: complete enquiry/invitation/notification lifecycle, recipient isolation, retries, uncertain delivery, terminal data minimization, monitoring, and provider acceptance.

## Cleanup

Trace static and dynamic consumers before classifying code as unused. Check dead files, imports/exports, dependencies, routes, assets, compatibility adapters, duplicated validation/business logic/provider integrations, styles, oversized modules, and lint suppressions. Split only when cohesion or testability materially improves.

## Security

Use current framework-specific guidance. Cite exact file and line evidence; distinguish application controls from edge assumptions. Never infer protection from a similarly named provider feature.
