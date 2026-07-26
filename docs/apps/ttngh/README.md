# The Thriving Network GH website

## Current milestone

Foundation only: Astro public surface, Cloudflare response headers, SEO/AEO launch gate, Railway API
health boundary, input validation, and future Paystack/MTN MoMo integration seams.

Client requirements are captured in [requirements.md](./requirements.md). Google Analytics scope and
its privacy gate are captured in [analytics-plan.md](./analytics-plan.md). Production acceptance
criteria remain in [launch-checklist.md](./launch-checklist.md).
The monthly authoring model is documented in [content-operations.md](./content-operations.md).

## Deliberately out of scope

- Full page design and program content
- Donation collection or payment-provider network calls
- Contact or volunteer submission persistence
- Email, SMS, receipts, CRM, analytics, or consent tooling
- Public case study or production-domain assumptions

## Delivery strategy

The public site should remain static-first so organization, program, impact, accountability, and
resource pages are crawlable without client JavaScript. Each future page needs a unique title,
description, canonical URL, clear answer-first introduction, visible author or accountable owner
where relevant, evidence for impact claims, and a meaningful reviewed date.

The Railway API owns secrets, payment initialization, provider verification, webhooks/callbacks,
submission processing, and persistence. The Cloudflare site must call only documented public API
routes and must never treat a browser redirect as proof of payment.

No FAQ or impact schema is included in the scaffold because the underlying claims and questions have
not yet been approved. Add structured data only when it accurately describes visible page content.
