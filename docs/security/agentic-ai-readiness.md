# Agentic AI readiness and security architecture

Date: 2026-10-18  
Decision: no general-purpose public agent interface

## Capability tiers

| Tier | Example | Policy |
| --- | --- | --- |
| Public retrieval | Published services, events, articles and approved catalogue records | Server-rendered HTML, JSON-LD and sitemaps are sufficient |
| Public bounded submission | Contact or booking request | Existing validated endpoint only; rate limit, anti-abuse controls, request ID and data minimization required |
| Authenticated retrieval | Customer order status, ERP records, internal analytics | Explicit session/service auth, tenant and capability checks; never crawler-accessible |
| Sensitive mutation | Inventory, invoices, customer records, administrative settings | Authenticated, permission-scoped, validated, audited and idempotent; human intent must be clear |
| Financial action | Payment initiation, refund, invoice settlement or donation | Human confirmation, amount/currency display, provider verification, idempotency and audit trail required; no autonomous execution |

## Application decisions

- Public websites: machine discovery is read-only through published documents. A generic chat or MCP layer would add cost and prompt-injection surface without a demonstrated capability gap.
- Stroane and REEBS catalogues: public catalogue routes may be retrieved. Internal availability controls, supplier data, margins and stock operations remain private.
- Dev ERP, Faako ERP, REEBS Portal and REEBS Water: no public agent discovery. Future integrations must call the existing backend after normal authentication and permission enforcement.
- TTNGH: published programmes, events and resources are retrievable. Enquiries and donations remain explicit human actions through validated application APIs.
- Travel With Ease: agent access is deferred with the rest of the private foundation.
- Analytics: service-to-service analytical requests remain authenticated and read-only; raw tenant datasets are not a public discovery surface.

## Required control checklist

Before approving an agent-facing endpoint:

1. Name the actor, purpose, allowed resources and prohibited outcomes.
2. Define a stable request/response contract; generate OpenAPI only from reviewed routes.
3. Authenticate explicitly and enforce organization, tenant and capability scope on the server.
4. Treat prompts, retrieved web text, uploaded files and tool output as untrusted input.
5. Validate size, type, identifiers, URLs and state transitions at the boundary.
6. Rate-limit by an appropriate authenticated principal and abuse signal.
7. Propagate the existing request ID and emit redacted diagnostic logs plus distinct audit events.
8. Require idempotency for retryable mutations; never automatically retry unsafe writes.
9. Present a human-readable confirmation for privileged, destructive or financial actions.
10. Test cross-tenant denial, prompt-injection attempts, replay, over-broad permissions and audit completeness.

Robots directives, hidden navigation, client-side route guards and an agent's own policy are not security controls.
