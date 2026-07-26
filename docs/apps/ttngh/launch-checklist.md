# TTN GH production standards and launch gate

This is a release checklist, not a statement that the foundation is already production-ready.

## Content, SEO, and AEO

- Approve the legal organization name, domain, mission, programs, leadership, contacts, and claims.
- Give every indexable page a unique title, description, canonical URL, one clear primary heading,
  answer-first introduction, useful internal links, and accurate structured data.
- Cite and date measurable impact claims. Never invent testimonials, beneficiaries, partners, or FAQs.
- Add Open Graph imagery, sitemap submission, redirect mapping, analytics consent, and search-console
  ownership after the production domain is confirmed.
- Set `PUBLIC_SITE_INDEXABLE=true` only after a production crawl and editorial review.

## Accessibility and inclusive design

- Target WCAG 2.2 AA and test keyboard navigation, focus order, zoom, reflow, contrast, landmarks,
  form labels, error summaries, screen-reader output, reduced motion, and touch targets.
- Test with real low-bandwidth mobile devices and avoid requiring JavaScript for core public content.
- Run automated accessibility checks plus manual assistive-technology testing before release.

## Performance and resilience

- Set explicit image dimensions, use responsive modern formats, minimize third-party JavaScript, and
  define performance budgets for Core Web Vitals.
- Test Cloudflare caching and redirects while ensuring API, donation, and submission responses are
  never cached.
- Add uptime monitoring, structured redacted logs, error reporting, backup/restore exercises, and a
  documented incident owner.

## Privacy, forms, and abuse prevention

- Obtain Ghana-specific legal review for privacy, cookies, fundraising, record retention, and consent.
- Publish approved privacy, cookie, safeguarding, complaints, refund, and donation terms.
- Collect only necessary data; define access, encryption, retention, deletion, and breach workflows.
- Add rate limiting, bot protection, CSRF controls where applicable, upload restrictions, and safe
  email/CRM delivery before enabling a form.

## Donations and provider operations

- Keep all provider secrets in Railway; never expose them through Astro `PUBLIC_` variables.
- Store money as integer Ghana pesewas and validate supported amount, currency, provider, and purpose
  server-side.
- Use an internal donation intent and idempotency key before calling a provider.
- Treat redirects and callbacks as notifications only. Verify Paystack signatures and transaction
  status server-side; implement MTN MoMo callback authentication and status reconciliation according
  to the approved provider configuration.
- Use replay protection, unique provider references, auditable state transitions, reconciliation,
  receipts, refunds, alerts, and least-privilege credential rotation.
- Prefer provider-hosted payment surfaces to reduce payment-data handling; never collect raw card
  details in this app.
- Complete sandbox, failure-path, duplicate-event, delayed-callback, refund, and live low-value tests
  with organizational sign-off before enabling donations.

## Release evidence

- CI passes lint, unit/integration tests, production build, SEO assertions, dependency review, and
  deployment-readiness checks.
- Staging passes accessibility, performance, security, browser/device, form, and payment test plans.
- Named owners approve content, privacy, safeguarding, finance reconciliation, support, and incidents.
