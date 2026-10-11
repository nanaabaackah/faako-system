# ADR: REEBS Water standalone application

- **Status:** Accepted
- **Decision date:** 2026-10-07
- **Apps affected:** REEBS Portal, REEBS Water

## Context

Water was implemented as a route inside the REEBS Portal, but it must also be
deployable and directly accessible at `https://water.reebspartythemes.com`.
Water remains part of the REEBS business domain and must retain the existing
authentication, tenant, permission, API and audit boundaries.

## Decision

Deploy Water as an independent React/Vite application in `apps/reebs-water`.
Keep the existing Portal API as the authoritative backend. Reuse shared
`@faako/auth`, API-client and Water-domain packages; do not create a separate
Water identity, role system, database owner or backend.

The Portal's `/admin/water` path remains a compatibility redirect. Portal
navigation and quick actions link to the standalone application.

## Alternatives considered

- Keep Water mounted in the Portal: rejected because it does not provide an
  independent app entry point and deployment boundary.
- Create a Water-specific backend or authentication system: rejected because it
  would duplicate existing authorization, tenant enforcement and session
  behavior.

## Consequences

- The Water frontend has its own shell, build, static-hosting configuration and
  browser tests.
- The shared API must allow the Water production origin and continue to use the
  existing credentialed session flow.
- Rollout depends on verified DNS/static hosting, API origin/CORS, HTTPS cookie
  domain configuration and a staging direct-navigation/access-control check.
- Water's backend remains responsible for Owner organisation scope, platform
  administrator scope, existing Water roles and all data access decisions.

## Security and data impact

The frontend is not an authorization boundary. Every Water API request retains
backend permission checks and the existing organisation context; Owners do not
gain cross-organisation access, and REEBS Admins continue to follow platform
administrator rules. No transactional data is moved by the frontend extraction.
