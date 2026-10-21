# The Thriving Network GH website

## Current milestone

18 October 2026: the public website, Railway health endpoint and Sanity Studio are
reachable. Published-content reads/builds work against a PUBLIC Sanity dataset.
The informational-launch recommendation is **READY WITH CONDITIONS**, not full
provider sign-off. See the [dated production evidence and remaining gaps](production-status-2026-10-18.md).

Contact delivery, CMS publish/withdrawal rebuilds, private provider settings and
operational ownership remain unverified. The optional Calendar requires sign-in;
team/event publication filters currently return no records. Follow [deployment](deployment.md),
[content operations](content-operations.md) and [email operations](email-operations.md).
Historical Phase 1/2 reports are not the current operational status.

Dedicated PostgreSQL and GH₵1 minimum/no fundraising maximum are approved. The
[payment foundation](payments-architecture.md) is implemented/tested but checkout,
database runtime and receipt-worker integration remain post-launch work.

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
- Payment activation and Drive → R2 automation are post-launch work
- SMS, receipts and CRM integration

Production is already accessible at the approved canonical domain. Live email/CMS
workflow verification is required follow-up, not a claim that those services do not exist.

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
