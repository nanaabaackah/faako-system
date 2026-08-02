# TTN GH content operations

The scaffold uses validated Astro content collections for news, programs, events, and mental-health
resources. This keeps monthly updates structured and portable while the client chooses an editing
interface.

## Initial workflow

Content is drafted in Markdown/MDX, reviewed in source control, validated during the Astro build, and
published only when `draft: false`. This is appropriate for the foundation and avoids committing to a
paid CMS before the client's editors, budget, and approval workflow are known.

The content layer can later be connected to a Git-based editor or headless CMS through an Astro loader
without changing public URLs or page templates. CMS selection should follow a short editor trial.

## Ownership

Each entry requires an owner. Mental-health resources additionally require a reviewer, a review date,
at least one source, and a reviewed urgent-support notice. Programs record audience, format,
availability, and safeguarding review. Events record dates, format, and approved registration URLs.

## Monthly publishing cycle

1. Gather program, event, news, and resource changes from named owners.
2. Check facts, dates, destinations, image rights, consent, accessibility, and safeguarding.
3. Review titles, summaries, answer-first copy, internal links, and structured-data eligibility.
4. Preview on mobile and desktop, then run build and accessibility/SEO checks.
5. Publish with an accountable approver and record the next review date.
6. Remove or redirect expired content intentionally; do not leave stale support or event details live.

Testimonials and galleries should not become generic content collections until their consent,
withdrawal, retention, and safeguarding workflows are approved.
