# The Thriving Network GH website

## Current milestone

Final production-readiness work has started; see the [implementation plan and launch blockers](production-readiness-plan.md). Sanity identifiers are supplied but its connection is not yet verified. Dedicated PostgreSQL and GH₵1 minimum/no fundraising maximum are approved. The [payment foundation](payments-architecture.md) is implemented and tested; endpoint, frontend and receipt-worker integration remain pending.

13 October 2026: Phase 2 code and local verification are covered in the [implementation report](phase-2-implementation.md).
The client confirms provider accounts are not yet configured. Follow [deployment](deployment.md),
[content operations](content-operations.md) and [email operations](email-operations.md) for activation.
Do not treat historical Phase 1/event-only reports as the current operational status.

Cloudflare is not configured yet. See [deployment status and CI policy](./deployment.md)
for the explicit hosting deferral and the checks that still apply to the existing
Astro implementation.

Phase 1 refresh: static Astro public pages, an editorial white/black/pink visual system,
reviewed Drive photography, signature Scroll Expand CTAs and the retained pink footer.
See [implementation report](./phase-1-refresh.md) and [image inventory](./phase-1-image-inventory.md).

Client requirements are captured in [requirements.md](./requirements.md). Google Analytics scope and
its privacy gate are captured in [analytics-plan.md](./analytics-plan.md). Production acceptance
criteria remain in [launch-checklist.md](./launch-checklist.md).
The monthly authoring model is documented in [content-operations.md](./content-operations.md).

## Deliberately out of scope

- Donation collection or payment-provider network calls
- Contact or volunteer submission persistence
- Live email/CMS activation (local adapters, Studio and tests now implemented)
- SMS, receipts and CRM integration
- Production deployment (the approved canonical domain is thethrivingnetworkgh.org)

## Delivery strategy

The public site should remain static-first so organization, program, impact, accountability, and
resource pages are crawlable without client JavaScript. Each future page needs a unique title,
description, canonical URL, clear answer-first introduction, visible author or accountable owner
where relevant, evidence for impact claims, and a meaningful reviewed date.

The Railway API owns secrets, payment initialization, provider verification, webhooks/callbacks,
submission processing, and persistence. The Cloudflare site must call only documented public API
routes and must never treat a browser redirect as proof of payment.

NGO, WebSite, WebPage, breadcrumbs and visible FAQ content have structured data. The team page
also describes its displayed, approved people. Article/Event helpers remain dormant until verified
records are supplied with visible content. Never infer event dates or medical credentials.
