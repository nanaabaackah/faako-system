# REEBS application boundaries

Status: target boundary for the current React/Vite system. This document does
not authorise or implement an Astro migration.

## Boundary decision

REEBS is one product system with separately owned deployable surfaces:

| Surface | Responsibility | Current deployment shape |
| --- | --- | --- |
| REEBS Website | Public content, catalogue and rental discovery, public cart/checkout UI, booking/contact intake, policies, customer-facing session UI, SEO metadata, sitemap snapshot | Astro static frontend with React islands on Cloudflare Pages |
| REEBS Portal | Authenticated staff operations, administration, Store Mode, orders, bookings, inventory, CRM, finance, reporting, settings, roles, offline admin workflows | React/Vite frontend on Cloudflare Pages |
| REEBS API | Authentication and authorisation, organisation isolation, validation, inventory and availability truth, orders/bookings/payments, contact persistence, CRM activity, notifications, integration orchestration | Express/functions on Railway |
| REEBS database | Persistent operational and customer data | PostgreSQL through Portal-owned Prisma schema and migrations |
| REEBS Analytics | Read-only operational analytics calculations from controlled snapshots | Separate service called by the API/Portal boundary |

The Website is an API consumer. It is not a second backend and must not own
Prisma, database migrations, password hashing, email delivery, server secrets,
or administrative queues.

## Allowed dependency direction

```text
REEBS Website browser ───────┐
                             ├──> REEBS API ──> PostgreSQL
REEBS Portal browser ────────┘        │
                                      ├──> email / WhatsApp / maps / payments
                                      └──> REEBS Analytics

Website sitemap refresh ─────────────> public REEBS API

Shared packages <── Website, Portal, and API only through explicit exports
```

Forbidden directions:

- Website to Prisma/PostgreSQL.
- Website to Portal source files by relative filesystem import.
- Website to password, email, OpenAI, or server-secret modules.
- Portal browser code to Prisma/PostgreSQL.
- shared packages to either application.
- public browser code to admin offline mutation queues.
- analytics service to write operational data.

## Ownership by concern

| Concern | Website | Portal | API/backend | Shared package boundary |
| --- | --- | --- | --- | --- |
| Public navigation and content | Owns | Links outward only | Supplies published content where dynamic | Neutral UI primitives only |
| Admin navigation and permissions | No | Owns presentation | Enforces permissions | Role/permission contract types may be shared |
| Customer cart presentation | Owns | Store Mode may reuse domain rules | Revalidates price, stock, rental state, and totals | Pure cart/money/rental rules after reconciliation |
| Checkout and booking | Collects intent | Reviews and operates | Authoritative validation and persistence | Input/output contracts and validation schemas |
| Authentication | Customer-facing session UI | Staff/admin session UI and route guards | Session issuance, verification, logout, reset, rate limiting | API contracts, safe user type, request client |
| Organisation context | Sends explicit trusted session/request context | Displays and selects allowed context | Resolves and enforces tenant scope | `@faako/core` helper today; future API-client middleware |
| Currency display | Selects display preference | Store Mode/display usage | Authoritative transaction currency and amount | Currency codes, formatting, rate-adapter interface |
| Analytics consent | Owns public consent UI | Owns portal consent UI if tracking is enabled | No browser-consent bypass | Generic GA helpers in `@faako/utils`; configurable REEBS adapter |
| Contact form | Owns fields, accessible UI, draft | Reviews resulting CRM work | Validates, rate-limits, persists, notifies | Contact schema and API contract |
| Policies | Owns content and presentation | Links to Website | No presentation ownership | Neutral legal-page primitive only if reused |
| Offline admin mutations | No | Owns workflow and review UI | Revalidates permissions, state, conflicts, and idempotency | Storage/status primitives in `@faako/offline-sync` |
| SEO and sitemap | Owns | No | Exposes safe public catalogue data | Framework-independent metadata types/helpers only |
| Database and migrations | No | No browser ownership | Owns | Persistence types must not leak into browser packages |

## Authentication boundary

The two frontends must not share a single all-purpose React auth context.

Common, shareable pieces:

- safe user/session response contracts
- login, logout, session, forgot-password, and reset-password API operations
- request IDs and standard error handling
- removal of server-only fields before browser storage

Website-owned pieces:

- customer login presentation
- customer account affordances
- redirecting staff/admin entry to the Portal origin
- public-route behavior when no customer session exists

Portal-owned pieces:

- protected route guards
- role and permission navigation
- staff/admin session expiry experience
- portal access fallbacks
- manager and operational access modes

API-owned pieces:

- credential validation
- session cookies/tokens
- CSRF and origin controls
- password hashing and reset-token handling
- role, permission, and organisation enforcement
- rate limiting and audit records

Local storage is not an authority for identity, role, permission, or
organisation access. Any cached user shell must be refreshed from the API and
must never include reusable credentials.

## Commerce and data boundary

The browser may calculate provisional display totals, but the API must
recalculate and validate:

- product and variant identity
- current price and currency
- stock and rental working/availability state
- quantity limits
- booking date conflicts
- discounts, fees, and final totals
- payment status and provider references
- organisation ownership

Portal Store Mode and Website checkout can share pure cart-line and display
helpers only after the existing drift is resolved. They should not share a
browser mutation queue merely because both can create orders.

The API response shape should migrate incrementally through
`@faako/api-contracts`, and browser calls should migrate incrementally through
`@faako/api-client`. Existing endpoint payloads remain authoritative until an
explicit compatibility migration is completed.

## Package boundaries

Use existing packages before creating a REEBS-specific package:

| Package | Appropriate REEBS ownership |
| --- | --- |
| `@faako/api-client` | Browser/server-safe request handling and configured domain clients |
| `@faako/api-contracts` | Success/error envelopes, pagination, request IDs |
| `@faako/types` | Stable framework-independent boundary types |
| `@faako/validation` | Shared public request schemas that exclude server-only fields |
| `@faako/core` | Existing organisation and template-configuration behavior; review global fetch patching before wider adoption |
| `@faako/ui` | Neutral accessible UI primitives, not REEBS route trees or policy content |
| `@faako/utils` | Generic analytics and formatting helpers |
| `@faako/offline-sync` | Queue storage/status/review primitives; never implicit payment or booking authority |
| `@faako/theme` | Stable design tokens and cross-app primitives, not entire app stylesheets |

A future `@faako/reebs-commerce` package is justified only if:

- Website and Portal use the same defined cart-line contract;
- rental and shop quantity semantics are tested;
- price and currency units are explicit;
- the code is framework-independent at its core;
- server revalidation requirements are documented;
- React adapters do not import Vite environment variables directly.

## Source and import rules

REEBS Website may import:

- its own `src` modules
- public exports from shared packages
- browser-safe third-party UI libraries
- public API endpoints through an explicit client

REEBS Website must not import or declare as runtime requirements:

- `@prisma/client` or `@prisma/adapter-pg`
- `pg`, `psql`, Prisma CLI, schemas, or migrations
- `express` or `cors`
- `nodemailer`
- server-side password utilities or Node `crypto` password code
- `openai`
- Railway CLI/runtime packages
- Portal backend/function modules
- Portal admin navigation, role-colour, expense, or offline-queue modules

REEBS Portal frontend may import shared browser packages but must not import its
Prisma client or backend function implementations. Communication crosses the
HTTP/API boundary.

The REEBS API may import persistence and server integrations. It must not
import React components or frontend route modules.

## Configuration boundary

Browser-exposed configuration must use public values only. Secrets remain in
the API deployment.

Website build/runtime inputs include public API and Portal origins, analytics
configuration, map/currency public configuration where appropriate, and
feature flags. Database URLs, password secrets, email credentials, OpenAI
keys, payment secrets, webhook secrets, and analytics service secrets are
forbidden.

Framework-independent shared modules should receive configuration through
constructors or function options. They must not read `import.meta.env` or
`process.env` directly.

## Deployment boundary

- Cloudflare builds Website and Portal as independent static frontends.
- Railway builds and runs the REEBS API and applies the Portal-owned Prisma
  migrations.
- Website builds must not generate Prisma clients or deploy migrations.
- The committed rental-route sitemap snapshot may be refreshed from a safe
  public API endpoint, but deterministic Website builds consume the snapshot
  and do not require database access.
- Local orchestration may start all three surfaces together, but it does not
  change their ownership.

## Boundary enforcement to add before framework migration

1. Add restricted-import lint rules for Website server/database packages and
   Portal filesystem imports.
2. Add a manifest test that rejects forbidden Website dependencies and
   database/password scripts.
3. Add a check that neither frontend imports from the other application's
   directory.
4. Add route smoke tests covering Website public/customer routes and Portal
   admin/auth routes separately.
5. Add contract tests for public catalogue, contact, booking, checkout, and
   session endpoints.
6. Add a dependency/reachability report to duplication-cleanup pull requests.
7. Keep the Astro migration blocked until Website-only ownership and public
   API contracts are stable.

## Near-term cleanup sequence

The safe order is:

1. dependency and import-boundary enforcement;
2. public-app backend/dependency removal;
3. dead and wrong-app copy removal;
4. direct adoption of existing shared package exports;
5. small neutral UI/helper extraction;
6. cart/currency/rental contract reconciliation;
7. public SEO and behavior baselines;
8. a separately approved Astro migration.

No framework, route, deployment, or application ownership change was made by
this audit.
