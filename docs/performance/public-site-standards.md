# Public-site performance standards

The default public page is static HTML and CSS. JavaScript, third-party requests, and runtime APIs must each justify their cost.

## Budgets

Budgets are per route, measured with a cold cache and production configuration:

| Signal | Marketing/editorial target | Interactive commerce/form target |
| --- | ---: | ---: |
| Initial first-party JS, gzip | 0–75 KiB | up to 150 KiB |
| Initial CSS, gzip | up to 50 KiB | up to 75 KiB |
| Above-the-fold image payload | up to 300 KiB | up to 400 KiB |
| Font payload on first view | up to 150 KiB | up to 150 KiB |
| Third-party origins before consent | 0, except essential infrastructure | only essential payment/security providers |

Exceptions need a route, reason, owner, and removal plan. Bundle budgets complement, rather than replace, Core Web Vitals.

## Rendering and hydration

- Render headings, copy, links, metadata, product facts, event facts, and contact/support instructions as Astro HTML.
- Use plain Astro for static content.
- Use `client:visible` for below-the-fold interaction.
- Use `client:idle` for non-critical interaction that may initialize after the page settles.
- Use `client:load` only when the first viewport’s primary task is unusable without immediate hydration.
- Avoid a whole-page React island. Keep shared state no broader than the interaction that needs it.
- Lazy-load route-independent decoration and remove it entirely for reduced-motion/data-saving contexts when practical.

## Images and fonts

- Store source images at an intentional maximum resolution.
- Use Astro image services or equivalent responsive output with dimensions, modern formats, and `srcset`.
- Prioritize only the LCP candidate. Lazy-load below-the-fold images and galleries.
- Never ship multi-megabyte logos or decorative SVGs without optimization.
- Define width and height/aspect ratio to prevent layout shift.
- Self-host licensed WOFF2 fonts, subset character sets, and load only used weights.
- Use `font-display: swap` and a compatible fallback stack.

## APIs and third parties

- Do not fetch build-time facts from the browser.
- Parallelize independent requests and avoid request chains created only by component mounting order.
- Cache public immutable data with a documented freshness policy.
- Abort obsolete requests. Show resilient loading, empty, offline, and retry states.
- Analytics waits for consent where required and must not block rendering.
- Payment and donation scripts load only on the relevant interaction/route.

## Caching and delivery

- Fingerprinted assets: long-lived immutable cache.
- HTML: revalidate according to publishing frequency; do not mark HTML immutable.
- Robots, sitemap, and redirects must update with the same release as routes.
- Compress text with Brotli/gzip at the edge.
- Keep API and HTML cache rules separate; never cache personalized or authenticated responses publicly.

## Verification

- Record emitted asset totals and per-route initial requests on each public-site PR.
- Test representative desktop, mid-range mobile, slow network, no-JavaScript, and reduced-motion states.
- Track production LCP, INP, CLS, and error rate after launch.
- Fail CI when a tested hard budget regresses without an approved exception.
