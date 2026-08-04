# ADR: System Starter Future

- Status: Accepted
- Date: 2026-08-02
- Decision owner: Faako platform

## Context

`@faako/system-starter` is registered as an internal, private, non-production-sensitive application starter. Its README and implementation describe a small React/Vite shell using shared UI primitives, feedback, security states, analytics wiring, and application-system configuration. It contains no domain backend, authentication, persistence, or production workflow.

It is not an obsolete duplicate of Dev ERP or Faako ERP. Its purpose is to demonstrate the minimum shell contract without importing product business logic. UI Workbench has a different purpose: exhaustive shared component and theme verification.

## Decision

Retain System Starter as an internal scaffold/template.

- Keep it React/Vite.
- Keep it lightweight and domain-neutral.
- Do not deploy it as a customer-facing production application.
- Use it when creating an authenticated or interactive React application shell after an architecture decision has approved that framework.
- Do not use it to start Astro public sites.
- Do not add product modules, real credentials, sample personal data, or backend ownership.
- Keep its build in repository quality gates.
- Treat its monitoring registry entry as optional internal reachability, not a production SLO.

## Distinction from UI Workbench

| System Starter | UI Workbench |
| --- | --- |
| Minimal application scaffold | Component and design-system verification environment |
| Shows recommended shell wiring | Shows component variants and interaction states |
| Dependency-minimal | May depend on all framework-compatible shared UI/theme packages |
| Copied only through an approved scaffold workflow | Never copied as a product app |

## Consequences

The workspace remains in the monorepo and must continue to lint and build. It is not removed or renamed. Future changes should add tests only for durable scaffold behavior; product workflow tests belong in product applications.

Removal requires a new ADR with evidence that another maintained scaffold fully replaces its responsibilities and that all documentation/root commands have been updated.
