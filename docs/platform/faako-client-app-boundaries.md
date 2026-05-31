# Faako Client App Boundaries

## Stroane Realignment Audit

Date: 2026-05-31

Stroane is correctly separated into:

- public storefront routes such as `/`, `/catalogue`, and `/products/:slug` on `stroanesolutions.com`
- future customer account placeholders such as `/account`, `/orders`, and `/quotes`
- protected staff operations under `/admin/*` on `portal.stroanesolutions.com`

The private portal uses the shared `@faako/ui` ERP shell structure while keeping Stroane-specific navigation, inventory semantics, API permissions, and portal-origin bearer sessions app-owned. Storefront browsers do not fetch lazy portal workflow chunks.

## Keep App-Owned

| Area | Owner | Reason |
| --- | --- | --- |
| Catalogue fallback snapshot | Stroane Web | Cloudflare outage behavior and public product contract are client-specific. |
| Catalogue, inventory, supplier Prisma models | Stroane API | Persistence and migrations are app-specific. |
| Inventory alert scan, cooldown, and dispatch audit rows | Stroane API | These encode Stroane stock transitions and operational audit expectations. |
| Staff bearer auth | Stroane API | Transitional portal-session strategy and role checks are app-specific. |
| Dev ERP cookie sessions and CSRF flow | Dev ERP | Cross-site session behavior, capabilities, and organization scope are live-system concerns. |
| Invoice persistence and paid-amount migration | Dev ERP | The invoice record remains app-owned even when pure arithmetic is shared. |

## Share Now

| Area | Shared package | Status |
| --- | --- | --- |
| ERP shell, sidebar, topbar, bottom nav, tables, badges, forms | `@faako/ui` | Already reused by Stroane and Dev ERP where appropriate. |
| Safe notification text normalization | `@faako/notifications` | Stroane inventory-owner alerts now reuse `sanitizeNotificationText`. |
| Currency, balance-due, and finance-status arithmetic | `@faako/finance` | Dev ERP invoice tracking now reuses pure balance/status helpers. |
| Security header baseline | `@faako/security` | Reused by Stroane API. |
| App monitoring metadata | `@faako/config` | Used by Dev ERP monitoring and registry checks. |

## Share Later, After Contract Review

- A typed browser API transport helper, after bearer and cookie-session variants are deliberately separated.
- Backend email transport adapters, after idempotency, provider errors, sender ownership, consent, and audit requirements are aligned.
- Notification dispatch audit contracts, after Stroane owner alerts and future customer notifications have a provider-neutral persistence review.
- Finance ledger or receipt contracts, only after Dev ERP rent, invoice, accounting, report, and public-token workflows are mapped end to end.

## Known Drift To Avoid

- Do not copy Stroane bearer-session assumptions into Dev ERP cookie auth.
- Do not move inventory alert orchestration into `@faako/notifications`; only pure sanitizers and templates belong there today.
- Do not expose supplier notes, alert recipients, secrets, or dispatch metadata through public catalogue routes.
- Do not treat frontend guards as API authorization.
- Do not make customer account placeholders authoritative until server-backed customer auth exists.

## Verification Checklist

- Public Stroane pages render outside the ERP shell.
- `/admin/*` routes remain protected by frontend navigation guards and backend authorization.
- Catalogue fallback still functions without Railway API availability.
- Shared package adoption remains pure-helper or presentation-only.
- Dev ERP hosted login retains secure cookies and CSRF enforcement across separate frontend/API origins.
