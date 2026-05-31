# Faako Platform Architecture

## Purpose

Keep Faako client apps consistent without forcing live operational workflows into one oversized shared runtime.

## Application Boundaries

### Public websites

Public storefronts and marketing sites own customer-facing routing, content, SEO, and outage-safe display behavior. They may use shared visual foundations, but they must not import private database clients or internal operational data.

### Client operations portals

Client portals own authenticated operational workflows such as inventory, suppliers, publishing, and app-specific staff permissions. Portal routes must remain structurally separate from public routes and future customer account areas.

### Dev ERP

Dev ERP is a live internal operational system. Its rent, accounting, invoices, reports, permissions, and integrations remain app-owned unless a dedicated extraction phase proves a narrower shared contract.

## Shared Package Rule

Move code into shared packages when it is:

- pure and app-agnostic
- presentation-only or contract-only
- safe to consume without importing another app's persistence model
- useful in more than one app without branching on client identity

Keep code inside an app when it owns:

- database writes or migrations
- authentication/session strategy
- business-state transitions
- provider delivery orchestration
- deployment-specific environment behavior
- app-specific audit and permission semantics

## Current Shared Foundations

- `@faako/ui`: shell and presentation primitives
- `@faako/security`: reusable HTTP/security helpers
- `@faako/notifications`: safe notification text and message-template helpers
- `@faako/finance`: pure currency, balance, and finance-status helpers
- `@faako/config`: app registry and monitoring metadata
- `@faako/logger`: shared logger foundation

See [faako-client-app-boundaries.md](./faako-client-app-boundaries.md) for the current Stroane audit.
