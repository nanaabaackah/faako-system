# Travel With Ease implementation roadmap and decision log

## Delivery roadmap

1. **Phase 0 — foundation (this change):** audit, boundaries, data/classification/threat models, provider ports, SQL, environment contract and three workspaces.
2. **Phase 1 — inquiry vertical slice (this change):** Astro storefront, server-calculated multi-currency estimate, inquiry submission, atomic lead/inquiry persistence through a repository port, protected agent lead list, unit/route/output tests.
3. **Phase 2 — consultation to itinerary:** reviewed staff auth, PostgreSQL repository, CRM profile/timeline, trips/travellers, AI sanitiser/provider port, versioned agent approval, booked-itinerary PWA allowlist and sync conflicts.
4. **Phase 3 — transaction and operations:** invoices/Paystack/webhooks, documents/private storage/encryption, notifications/WhatsApp, calendar separation, accounting/export, CMS.
5. **Phase 4 — growth:** content studio, social provider snapshots/attribution, governed reporting using the shared analytics contracts.

Each phase requires lint, typecheck, tests, build, threat-model delta, migrations before dependent code, preview verification and rollback notes. Production launch additionally requires reviewed auth, PostgreSQL, backups/restores, processor agreements, incident response and privacy/legal sign-off.

## Technical decisions

| ID | Decision | Why / consequence |
| --- | --- | --- |
| TWE-001 | Astro storefront, React/Vite portal, Express API | Matches repository standards and creates a hard public/private bundle boundary. |
| TWE-002 | One PostgreSQL database with logical schemas | Preserves relational workflows without needless databases; API roles/RLS add defence in depth. |
| TWE-003 | App-owned travel domain first | Avoids premature shared packages and cross-app coupling. |
| TWE-004 | Repository and provider interfaces | Tests remain deterministic and persistence/integrations are replaceable. |
| TWE-005 | Integer minor units plus decimal-string rates | Prevents JavaScript floating-point money calculations and preserves original currency. |
| TWE-006 | Configurable currency records and provider | New currencies/providers do not require changes to Trips/Estimator/Accounting. |
| TWE-007 | Human approval for AI itinerary/content | AI output is never authoritative; sensitive PII is removed before provider calls. |
| TWE-008 | Explicit offline projection allowlist | PWA convenience cannot silently cache highly sensitive data. |
| TWE-009 | File repository is development/test only | Enables the first local slice; production must use PostgreSQL and fails closed. |
| TWE-010 | No auth-provider replacement/selection in Phase 1 | Existing apps have incompatible session models; selection needs its own reviewed roadmap. |

## Paid/external service register

| Service | Purpose | Cost posture | Alternative | Lock-in risk |
| --- | --- | --- | --- | --- |
| ExchangeRate-API adapter | Market/reference rates | Open endpoint for prototype; paid key/terms must be reviewed for production | Open Exchange Rates, CurrencyAPI, managed bank rate | Low via provider port |
| Supabase/PostgreSQL | Operational relational store and possible auth/storage | Free tier useful for non-production; production usage-based | Managed PostgreSQL + separate auth/storage | Medium; standard SQL and adapters reduce it |
| Paystack | GHS/card/MoMo collection | Transaction fees; no new commitment in this phase | Hubtel/Flutterwave after Ghana requirements review | Medium via payment port |
| WhatsApp Business Platform | Messaging | Conversation/template pricing | Deep links/manual messaging, other BSP | Medium via message port |
| AI provider | Draft itinerary/content | Usage-based, disabled until approved | Another model or no-AI templates | Low via provider port |
| Email/object/monitoring providers | Delivery, private files, observability | Vendor-specific free tiers/usage | Compatible SMTP/S3/monitoring vendors | Low/medium via adapters |

No paid account or credential is created by this phase.

## Phase 1 acceptance and outstanding work

- A visitor obtains a server-computed GHS range, sees its timestamp/staleness and disclaimer, and can submit selections.
- One API transaction/repository operation creates a `new` lead and inquiry with source/consent.
- An authenticated development agent can list leads; the public API cannot.
- Tests cover precise conversion, unavailable/stale rates, validation, auth denial, honeypot/rate limit, creation and list rendering contracts.
- Production persistence and identity remain launch blockers, not hidden fallbacks.

After Phase 1: choose and document authentication; implement PostgreSQL adapter/RLS transaction tests; admin-managed estimator configuration; persistent exchange-rate cache; CRM timeline; trip planning; offline itinerary; then payments/documents and remaining integrations.
