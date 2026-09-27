# Travel With Ease system architecture

Status: Phase 0 approved foundation
Date: 2026-09-27
Base locale: `en-GH`; timezone: `Africa/Accra`; reporting currency: `GHS`

## Outcome and boundaries

Travel With Ease is split into three independently deployable workspaces:

| Workspace | Runtime | Responsibility | Must never contain |
| --- | --- | --- | --- |
| `travel-with-ease-web` | Astro/static + small React islands | Public, indexable content, estimator and inquiry form | CRM reads, staff sessions, document data, provider secrets |
| `travel-with-ease-portal` | React/Vite | Authenticated agent and later client workflows | Public SEO ownership, server secrets, authoritative permission checks |
| `travel-with-ease-api` | Node/Express | Validation, authorization, persistence, currency and integration boundaries | Browser-bundled credentials or public assets |

The public browser may call only `/api/public/*`. The portal calls `/api/agent/*` with an authenticated staff session. The API is authoritative for role, record ownership and organisation scope. A CDN or frontend route guard is never authorization.

```text
Search / visitor
  -> Astro storefront -> public API -> inquiry service -> lead + inquiry transaction
                                      -> currency service -> rate cache -> provider

Agent browser
  -> React portal -> staff API -> CRM repository -> PostgreSQL

Future client browser
  -> client portal/PWA -> client API -> explicitly associated trip/itinerary rows
```

## Reuse audit

| Existing capability | Decision |
| --- | --- |
| `@faako/api-contracts` | Reuse canonical success/error envelopes and transport request IDs. |
| `@faako/api-client` | Reuse browser transport, timeout/abort behavior and normalized errors. |
| `@faako/validation` | Reuse email, phone, date and currency primitives. Add travel-specific schemas locally until proven reusable. |
| `@faako/security` | Reuse security headers and framework-neutral permission helpers; keep Travel With Ease policy app-owned. |
| `@faako/logger` | Reuse structured redacted logging and request context. |
| `@faako/audit` | Reuse append-oriented event shape and redaction; add travel actions through an app adapter. |
| `@faako/finance` | Reuse display/status conventions only. Do **not** use its floating-point conversion helpers for exchange or accounting. |
| `@faako/offline-sync` | Reuse queue/status/IndexedDB foundations in the booked-itinerary phase after the data allowlist is implemented. |
| `@faako/ui`, `@faako/theme` | Reuse portal primitives and semantic token contract. Travel With Ease owns its brand tokens. |
| Existing auth | Do not copy a provider/session implementation. Dev ERP cookie and Stroane bearer assumptions differ. Adopt a separate reviewed staff/client auth roadmap. |
| Existing Prisma/API apps | Reuse conventions (migrations before code, repositories, server-only providers), not app database models. |

No existing application needs restructuring. No new shared package is justified in Phase 0.

## Module map

| Domain | Initial responsibility | Phase |
| --- | --- | --- |
| Public content/CMS | Pages, destinations, guides, packages, metadata, publication state | 1/3 |
| Estimator | Admin-owned inputs/rules, currency conversion, non-binding range | 1 |
| CRM | Lead/client/traveller profiles, stages, timeline, interactions, tasks | 1/2 |
| Trips | Planning, travellers, components, statuses and profitability links | 2 |
| Itineraries | Structured drafts, review, approval, versioning and offline projection | 2 |
| Currency | Provider abstraction, precise conversion, cached/historical/override rates | 1/2 |
| Finance | Invoices, payments, supplier costs, GHS reporting and gain/loss | 3 |
| Documents | Metadata, private objects, signed access, encryption and audit | 3 |
| Communications | WhatsApp, email, inbox, notification preferences | 3 |
| Calendar | Internal versus client-shared event projections | 3 |
| Content/social | Draft workflow, provider adapters, metric snapshots, attribution | 4 |
| Analytics/reports | Governed metrics using shared analytics architecture | 4 |

Navigation exposes only functional modules. Phase 1 portal navigation is Dashboard and Leads.

## Initial data model / ERD

```text
organisation 1--* user_role *--1 role
organisation 1--* lead 1--* inquiry
lead 0..1--1 client 1--* traveller
client *--* household (household_member)
client 1--* interaction / task / communication / consent / note
client 1--* trip *--* traveller (trip_traveller)
trip 1--* trip_component 1--1 money_snapshot
trip 1--* itinerary 1--* itinerary_version 1--* itinerary_day
trip 1--* invoice 1--* payment
trip 1--* document_metadata -> private object storage
money_snapshot *--1 exchange_rate
quote_rate_override *--1 exchange_rate
marketing_source 1--* inquiry
social_campaign 1--* inquiry
```

Lead stages use stable keys in a table (`new`, `contacted`, `consultation`, `planning`, `proposal_sent`, `awaiting_payment`, `booked`, `travelling`, `completed`, `lost`) rather than a database enum so authorised configuration can be added without a deployment. Historical stage transitions are append-only.

Money stores `original_amount_minor`, `original_currency`, `market_rate`, `applied_rate`, `converted_amount_minor`, `converted_currency`, `rate_timestamp`, and a reference to the rate record. Decimal rates are strings/`NUMERIC`, never JavaScript numbers. Historical rows retain the applied rate.

The reviewed Phase 1 SQL is in `apps/travel-with-ease-api/db/001_phase1.sql`. Later tables are added only with the owning vertical slice.

## Currency and integrations

`ExchangeRateProvider` defines `getLatestRate`, `convertCurrency`, `getSupportedCurrencies`, `getHistoricalRate`, and `getLastUpdated`. Business services depend on that interface. The first adapter uses the configurable ExchangeRate-API endpoint; it has timeouts, bounded retries and response validation. The currency service caches provider results, marks fallback values stale, and never invents a rate.

Supported currency rows are data, initially GHS, USD, EUR, GBP, CAD, AED, TRY and ZAR. Adding an enabled ISO currency is an administration/data change. A quote override preserves both `market_rate` and `applied_rate`, plus reason, actor and time. Paystack remains a separate payment adapter.

Other provider ports: `PaymentProvider`, `AiItineraryProvider`, `MessageProvider`, `EmailProvider`, `CalendarProvider`, `ObjectStore`, `SocialPublisher` and `SocialMetricsProvider`. Webhooks terminate at the API, verify signatures first, enforce idempotency, then enqueue/apply domain work.

## Online/offline model

The service worker shell is separate from the data allowlist. Only approved booked-itinerary projections may enter IndexedDB: itinerary text, non-sensitive booking references, hotel/flight/meeting details, emergency contact and a `lastSyncedAt` value. Passport fields/scans, payment credentials, staff notes, audit data and signed document URLs are denied.

Offline agent drafts use an encrypted-at-rest-capable local record envelope with user/organisation ownership, expiry, schema version and sync state. The queue uses idempotency keys, exponential backoff with jitter, explicit conflict states and server-version checks. Logout/role removal clears local protected data. An offline currency snapshot says “Last updated …” and never claims to be live.

## Public discovery architecture

Astro owns semantic documents, canonical URLs, metadata, Open Graph, JSON-LD, sitemap and robots. Interactive estimation is one focused island. Destination/package/guide content will use validated content collections until the CMS API becomes authoritative. Search-visible facts remain server-rendered. Public images have dimensions, alt text and responsive loading.

## Suggested workspace structure

```text
apps/
  travel-with-ease-web/       # Astro public deployment
  travel-with-ease-portal/    # React/Vite authenticated deployment
  travel-with-ease-api/       # Express API, domain services, repositories, db
docs/apps/travel-with-ease/   # architecture, security, roadmap, env, logs
```

Future framework-neutral extraction requires two real consumers and a contract review; it does not start in `packages/` by default.
