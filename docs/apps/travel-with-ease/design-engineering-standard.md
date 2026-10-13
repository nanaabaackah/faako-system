# Travel With Ease design and engineering standard

Status: Governing standards aligned; specific design, scope and release approvals remain open\
Date: 2026-10-10; aligned 2026-10-11\
Product baseline: [`Travel_With_Ease_Solution_Roadmap.md`](./Travel_With_Ease_Solution_Roadmap.md)

This standard governs the public website, React administration portal and Express API. It complements the system architecture and security controls; it does not change their boundaries or authorize implementation, deployment or deferred product scope. The existing visual audit and evidence remain in [`audits/2026-10-10/visual-audit.md`](./audits/2026-10-10/visual-audit.md). The October product baseline remains subject to client scope/legal approval.

## Design principles

1. Lead with real travel stories, useful information and licensed photography—not visual effects.
2. Compose pages editorially. Alternate scale, alignment, image proportion and text density instead of repeating a heading followed by three equal cards.
3. Keep the Ghana departure context specific without resorting to generic cultural motifs.
4. Use cards only for bounded objects such as packages, journal entries and destination previews.
5. Use solid colour fields. Gradients, glass effects, glows, floating shapes, ornamental shadows and decorative CSS drawings are not part of the default language.
6. Every public claim must be supported by approved business content. Do not invent packages, destinations served, trip counts, prices, testimonials, client-portal capabilities or itinerary features.
7. Astro owns all indexable copy, headings, links and images. React is reserved for interactions that need client state.
8. Aim for elegant, modern, trustworthy and distinctive—not plain. Earn visual richness through photography, typography and composition, not background patterns, excess icons or generic AI-written marketing phrases. Keep copy concise, human and specific to a Ghana-based agency.

## Foundations

### Colour

Use semantic tokens mapped to the approved palette. Components must consume semantic tokens rather than raw colour values.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Primary ink/surface | `--twe-navy` | `#010c33` | Navigation, dark editorial fields, headings |
| Warm canvas | `--twe-cream` | `#f4ede3` | Primary light background |
| Accent | `--twe-gold` | `#d8b56a` | Primary actions and restrained highlights |
| Supporting neutral | `--twe-grey` | `#b6b1a9` | Rules and secondary surfaces, subject to contrast |
| Interactive focus | `--twe-blue` | `#7ab8ff` | Focus rings, links on dark surfaces, status accents |
| Deep surface | `--twe-dark-navy` | `#000a1f` | Footer and high-contrast dark fields |

Gold is not body text on cream. The current darker gold `#a27828` reaches only about `3.44:1` against cream, so it fails WCAG AA for small text. Use navy for small labels on cream or approve a darker accent that reaches at least `4.5:1`. Gold on navy is suitable at about `9.75:1`.

### Typography

- Proposed pairing for approval: `Newsreader` for editorial display text and `IBM Plex Sans` for body, navigation, UI and forms. Self-host only the required WOFF2 subsets and weights after licence verification.
- If the pairing is not approved, retain semantic type roles and choose one licensed editorial serif plus one highly readable sans; do not silently fall back to an unrelated system serif.
- Display type is a hierarchy tool, not a page-filling device. Desktop page titles should normally stop near `clamp(3rem, 6vw, 5.5rem)` and mobile titles near `clamp(2.5rem, 11vw, 4rem)`.
- Body copy uses a comfortable `1.55–1.7` line height and a readable measure of roughly `55–70ch`.
- Use no more than three weights per family. Avoid artificial italic or bold styles.
- Kicker text is optional. Use it only when it adds category or wayfinding information, not as a mandatory decoration above every heading.

### Spacing and layout

- Base spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128px`.
- Default content width: `min(1200px, calc(100% - 2 * gutter))`.
- Use a 12-column desktop grid, 6-column tablet grid and 4-column mobile grid. Components may span asymmetrically; equal thirds are not the default.
- Default section spacing is `64px` on mobile and `96px` on desktop. Use `128px` only for a deliberate major transition.
- Align adjacent headings, body copy and image edges to shared grid lines. Centred text is reserved for short, singular moments such as a final CTA—not entire pages.
- Prefer borders, background contrast and spacing over shadows. Functional overlays may use one low-elevation shadow.
- Corners should usually be square or `4–10px`. Pills are reserved for compact status or filter controls, not every button.

## Page composition

### Homepage sequence

Follow the October product baseline sequence, subject to scope approval:

1. Photographic hero with one clear `Plan a trip` action.
2. Featured packages supported by approved content and indicative-price disclosures.
3. Unified travel footprint with accessible list/table fallback.
4. A concise, non-card-heavy explanation of how the service works.
5. Travel Journal feature.
6. Approved testimonials and/or FAQs only when source content exists.
7. Final enquiry CTA.

Vary the composition: for example, a full-bleed hero, an offset package feature, a map band, an image-led journal story and a compact FAQ list. Do not repeat the current centred heading plus equal three-column grid pattern.

### Interior pages

- Destination/package pages need real imagery, practical departure context, approved dates/tier information and a package-specific enquiry path.
- Services pages should explain outcomes and process with editorial image/text sections, not a generic service-card row.
- About content requires approved business history, approach and team/agent photography before publication.
- Empty or forthcoming content should be stated plainly; do not publish placeholder destination names as if they are active offers.

## Imagery

- Use client-owned or properly licensed photography. Maintain an asset record containing source, licence/permission, photographer credit where required, approval status, expiry/restrictions, alt text, focal point and derivatives.
- Prefer Ghana-origin travel moments, people preparing or departing, and specific destination detail over interchangeable landmark collages.
- Do not use artificial or misleading travel photography. Never present generated imagery or unrelated stock as evidence of actual clients, staff, packages or completed trips; client approval does not make a misleading claim acceptable.
- Define crops before sourcing: hero `16:9` or wider, editorial landscape `3:2`, portrait story `4:5`, package preview `4:3`.
- Provide intrinsic dimensions, `srcset` and `sizes`; use AVIF/WebP with an appropriate fallback. Preload/eager-load only the LCP hero image and lazy-load below-fold media.
- Alt text describes the useful content of the image. Decorative images use empty alt text; captions and credits remain visible where the licence requires them.

## Components

### Navigation

- Desktop and mobile must expose the same primary destinations. A mobile disclosure/menu must be keyboard operable, announce expanded state and restore focus when closed.
- Keep one primary action. Do not hide all informational navigation at narrow widths as the current implementation does.
- Current-page state must be conveyed semantically and visually.

### Buttons and links

- Primary: solid gold with navy text on dark or neutral surroundings.
- Secondary: bordered or text link with a clear underline; do not rely on an arrow alone.
- Minimum touch target: `44 × 44px`, with visible `:focus-visible` treatment using the blue focus token.
- Labels should state the outcome: `Plan a trip`, `View package`, `Send enquiry`.
- Disabled and loading states must remain distinguishable and must not erase the surrounding form.

### Forms

- Keep persistent visible labels, field-level help where needed and programmatically associated errors.
- On submit, show an error summary and move focus to it when validation fails; preserve entered values.
- Loading, success and failure updates use `role="status"` or `aria-live` appropriately. A component error boundary must prevent an API/formatting failure from removing the entire enquiry surface.
- Do not put business rules, supplier pricing or authoritative validation in the browser.
- Personalised-trip and package-specific enquiries are separate launch flows under the October roadmap. The estimator is deferred unless re-approved.
- Marketing consent is separate from acknowledgement of the privacy notice.

### Functional cards

Cards are acceptable for packages, journal articles and bounded status/data objects. They require a clear click target, stable image ratio, descriptive heading and useful metadata. Do not put every paragraph or process step inside a card.

## Responsive behaviour

- Design at content-driven breakpoints and verify at approximately `320`, `390`, `768`, `1024`, `1280` and `1440px` widths.
- Verify reflow at `320` CSS pixels (including the equivalent of 400% zoom on a 1280px desktop viewport) and text resizing to 200%; avoid two-dimensional scrolling except for content that genuinely requires it, such as data tables.
- Reduce display scale and section height on mobile; do not merely stack oversized desktop sections.
- Keep form controls single-column where side-by-side fields would become cramped.
- Test long Ghanaian and international names, translated/browser-generated text, large text and mobile browser toolbars.

## Motion and React Bits

Static presentation is the baseline. Native hover/focus transitions should stay near `150–220ms` and must not move content unexpectedly. No parallax, scroll hijacking, autoplay carousels, cursor effects, glowing borders or animated backgrounds.

React Bits is not approved as a blanket dependency. These are conditional examples, not an exclusive allowlist or approved installation. Evaluate actual source, current framework compatibility and the decision rule below after static composition:

| Candidate | Intended placement | Conditions |
| --- | --- | --- |
| `Split Text` | One restrained hero headline entrance | Run once, by word rather than character; preserve one semantic Astro `h1`; no layout shift; instant/static under reduced motion. Reject if it requires hydrating the core heading or adds a large animation runtime. |
| `Fade Content` or equivalent restrained reveal | One featured journal or package media/text pairing | Use `client:visible`, opacity/short translation only, content visible without JS, no repeated reveal on every section. |
| Purposeful destination interaction | An existing interactive destination/map island | Only if it improves selection or comprehension; equivalent keyboard/touch feedback, an accessible list alternative, no hover-only information and no extra hydration of static content. |

Subtle supporting effects may be considered through the same rule; they are not a requirement. Prefer native CSS when it meets the need. Every effect must respect reduced motion, remain usable on mobile and avoid layout shifts and excessive JavaScript.

Do not use `Spotlight Card`: pointer-following light and another card treatment conflict with this brand direction. Do not use React Bits backgrounds, glow/cursor effects, 3D/WebGL or components that introduce `three`, `ogl`, GSAP or a broad motion runtime without a separately approved bundle budget.

Before adoption, copy only the selected component, review its licence and transitive dependencies, compare production bundle output before/after, test mid-range mobile performance and verify reduced-motion, keyboard, touch and no-JS behaviour. The official catalogue is [React Bits](https://www.reactbits.dev/get-started/index).

The roadmap's illustrative `Spotlight Card` and hero-background suggestions are not automatic approvals. Where they imply glow, pointer-following decoration or animated backgrounds, the visual rules above take precedence. No component implementation or dependency compatibility has been approved by this documentation update.

## Component and dependency decision rule

Before adding any component, animation, package or integration, record in the relevant PR or existing task:

1. What user or business requirement does it address?
2. Does equivalent functionality already exist in this app or Faako shared packages?
3. Can simpler native HTML, CSS or platform functionality satisfy it?
4. What is the accessibility impact, including fallback behaviour?
5. What is the performance impact, including assets, hydration and transitive dependencies?
6. Does it introduce unnecessary maintenance complexity, licensing or operational burden?
7. Does the overall product experience improve enough to justify these costs?

Reject additions whose value cannot be clearly explained. Prefer explicit implementations; avoid unnecessary wrappers, fragmented components, duplicated styling, overlapping packages and speculative abstraction. Record measured bundle impact and trade-offs for dependencies; do not install a whole effects library for one effect.

## Accessibility and performance gates

- Target WCAG 2.2 AA. Automated checks support but do not replace keyboard, screen-reader, zoom/reflow and touch testing.
- All informative content remains available without animation and without client-side React.
- Heading order, landmarks, link names and form labels must remain meaningful in the accessibility tree.
- Focus never becomes hidden by sticky content and is always visibly apparent.
- Establish route budgets before implementation: no public React island without a documented interaction need; measure LCP, CLS, INP, transferred image bytes and JavaScript on representative mobile hardware/network conditions.
- Third-party scripts load only after privacy, security and performance review and consent where required.

## Engineering boundaries

- Keep search-visible structure in Astro pages/content collections. Use React islands only for forms, the accessible map interaction and other stateful controls.
- Reuse `@faako/api-client`, `@faako/validation`, security headers and semantic tokens. `@faako/ui` is primarily an operational UI library; do not import ERP/card patterns into the public editorial site without a specific fit review.
- Validate external input in the API and keep public endpoints separate from staff endpoints.
- Add visual regression coverage for approved page states and contract tests for every interactive island/API response.
- Document image rights, content provenance, component exceptions, bundle changes and accessibility exceptions in the change log.

### Administration portal

Preserve React/Vite and reuse appropriate `@faako/ui`/`@faako/theme` operational primitives. Prioritise readable content/enquiry lists, editing forms, validation, save/publish feedback, loading, empty and failure states. No ornamental dashboards or metrics without an operational requirement. The existing workspace is the staff/admin portal; a customer-facing portal remains deferred. Frontend permission checks provide UX only.

### Backend and security

- Preserve Express and PostgreSQL as the deployed persistence target. Reuse shared types, validation, API contracts/client, security, logger and audit capabilities where applicable; keep server/database types out of framework-neutral packages.
- Validate all external input at the boundary. Authenticate staff securely and enforce permissions, organisation scope and record ownership server-side with deny-by-default access. Separate public content/submission routes from protected administration routes; CORS is not authorization.
- Select authentication/session integration through the existing separately reviewed roadmap; do not replace providers silently. Temporary bearer tokens and file persistence are isolated local/test scaffolding, never staging or production adapters.
- Audit administrative content, publication, access and record changes with actor, action, record reference, timestamp and existing request ID. Keep diagnostic logs structured/redacted and separate from audit events; never log credentials, raw personal-data bodies or signed URLs.
- Use shared error categories/envelopes and propagate the existing request ID. Handle malformed input and unexpected errors without exposing internals; test browser consumers against real response envelopes. Do not automatically retry unsafe mutations; preserve idempotency controls where needed.
- Sanitize rich content and validate upload type, size and content. Authorize upload/download operations, generate safe object keys, separate public media/private objects, and use short-lived authorized private access. Backups are private; document/identity intake remains deferred.
- Validate environment configuration at startup and fail closed for missing deployed authentication, database or secrets. Never hardcode credentials or assume every deployment is production. Browser-prefixed variables are public, not secret storage.
- Review environment-scoped migrations, deploy them before dependent code and test transactions, compatibility and rollback/forward-fix paths. Never reset shared databases. Require automated validation, authorization, persistence and failure-path tests.

These are requirements, not a claim that the current scaffold implements them. See [security.md](./security.md) and [env.md](./env.md) for controls and deployment gaps.

## Environments, Git and deployment

Use three isolated environments as defined in [env.md](./env.md). Staging is mandatory for subsequent release procedures, with separate website, portal, API, PostgreSQL, storage and credentials; synthetic data, safe email delivery and search-index protection. Production requires approved content, monitored services, encrypted restore-tested backups and a controlled rollback path.

Inspection on 2026-10-11 found branch `feat/reebs-water-modules-stabilization` and pre-existing TWE documentation changes/untracked baseline and audit files. Preserve them; this documentation task does not switch branches or authorize release from the unrelated feature branch. `.github/workflows/monorepo-ci.yml` checks PRs targeting `develop`/`main` and pushes to `develop`; this is CI evidence, not proof of configured deployment hooks.

Recommended TWE mapping, pending owner confirmation of hosting hooks and branch protection:

| Branch/ref | Environment / purpose |
| --- | --- |
| Focused TWE feature/fix branch based on `develop` | Local work and optionally isolated synthetic-data previews; PR to `develop` |
| `develop` | Integration baseline; candidate for dedicated staging after passing checks |
| Reviewed release PR to `main`, with recorded release tag/SHA | Approved production release only; no implicit deploy authorization from merge |

Inspect branch and worktree before every change. Preserve unrelated edits; review and stage explicit files/hunks only, never blindly stage all. No force-push, unrelated app edits, speculative refactors or unapproved production deployment. Confirm how existing dirty work reaches an appropriate TWE branch before committing; do not move it automatically.

Before release, identify exact target services/domains, environment URLs/CORS, database/storage identities and secret scopes. Run applicable repository checks and the [platform pre-deploy checklist](../../platform/pre-deploy-checklist.md), test migrations in staging, obtain acceptance and release approval, and record artifacts, migration version, rollback owner and previous known-good release. Preserve public URLs or test redirects. Rebuild environment-specific frontend configuration from the reviewed source; do not promote staging API URLs into production. After deployment verify health, public pages and access denial with safe checks, and monitor errors. Never run destructive E2E tests against production.

## Testing and acceptance

- Run focused lint, typecheck, unit/integration tests and builds plus applicable registry/security/repository checks for changed workspaces. Documentation-only changes require link and whitespace checks, not a claim of fresh application test coverage.
- Test public and protected API envelopes, malformed inputs, denied/expired access, record/organisation isolation, persistence transactions, audit emission and redacted failures. Use isolated databases and mocked third parties.
- Exercise both approved enquiry flows and staff content/enquiry workflows in staging, including validation, failed network requests, duplicate submissions, empty/loading states and publication failure/recovery. Do not require deferred modules for launch acceptance.
- Check responsive layouts, keyboard/focus, screen readers, contrast, text resizing/reflow, touch and reduced motion; run automated accessibility and visual regression checks against approved states. Check crawlable public output and staging no-index behaviour separately.
- Measure mobile image/font/JavaScript costs and LCP/CLS/INP against agreed route budgets. Record evidence rather than treating a successful build or a screenshot as proof of accessibility/performance.
- Acceptance records identify tested commit, environment, evidence, limitations and approver. Release requires approved imagery/copy, scope, authentication/persistence, environment isolation, restore/rollback evidence and no unresolved release-blocking failures.

## Project governance

- **Trello:** development tasks, priorities, dependencies, review, testing and blockers.
- **GitHub:** source, branches, PRs, checks and release history. Reference the existing Trello task in relevant branches/PRs and link test evidence and decisions.
- **Faako Dev ERP:** client information, project milestones, commercial records, deliverables and support management.

Use existing identifiers such as `TWE-013` and `TWE-016` only after verifying their actual task titles/scope; this alignment assigns neither ID to invented work. Existing `TWE-001`–`TWE-010` entries in roadmap.md are historical technical decision labels, not verified Trello mappings. Do not build duplicate project tracking into TWE or create a new implementation backlog in this standards task.

## Approval gate

The standards above govern subsequent authorized work. The following decisions require approval before their dependent implementation or release; they do not block unrelated, already authorized work:

1. the type pairing and font-hosting/licensing approach;
2. the photography source, licensing budget and first approved asset set;
3. which real packages, destinations, testimonials, trip counts and claims may be published;
4. whether the currently visible estimator is removed/feature-flagged to match the October roadmap or separately re-scoped;
5. removal or substantiation of `Secure client portal` and offline-itinerary claims;
6. the mobile navigation pattern;
7. any selected React Bits proof of concept after static design approval and the seven-question review;
8. the proposed homepage editorial wireframe before production styling;
9. the staff authentication/session approach and reviewed PostgreSQL integration before staging acceptance;
10. dedicated staging/production hosting, domains, isolation, branch mappings, operating costs, backup/restore and rollback ownership; and
11. client scope/legal acceptance and each production release.

The trade-offs are deliberate: authentic imagery needs licensing/content ownership; minimal islands reduce JavaScript but limit effect choices; separate staging increases operational cost but protects production; shared operational UI improves maintainability without dictating the public editorial layout.
