# ADR: Travel With Ease application foundation

Date: 2026-09-27
Status: Accepted for Phase 0/1

## Context

Travel With Ease needs public search discovery and a private, security-sensitive operations system. The repository standard assigns Astro to content-first public sites and React/Vite to operational applications. Existing authentication implementations are app-specific and may not be copied implicitly.

## Decision

Use separate Astro storefront, React/Vite portal and Node/Express API workspaces. Use one PostgreSQL operational database with logical domain schemas; provider/repository ports isolate external services and persistence. Keep travel domain code app-owned. Use integer minor units and decimal-string rates. AI remains draft-only behind a tested data-minimisation boundary. Offline storage uses an explicit allowlist.

## Consequences

Public deployments contain no CRM code or secrets, and independently testable API authorization protects private records. Three deployments add coordination overhead. Phase 1 uses an explicitly non-production local repository and development bearer gate so persistence and identity selection can be reviewed separately. Production is blocked until PostgreSQL and approved authentication are connected and tested.
