# By Nana portfolio browser audit — 2026-07-25

## Audit scope

Combined UX and accessibility audit of the generated Astro portfolio at 1440 × 1000 and
390 × 844. The flow covered the home and consent entry state, live trust statistic,
keyboard entry, theme switching, projects, a project case study, contact validation, and
mobile responsive behavior.

## User goal and accessibility target

Visitors should be able to understand Nana's positioning, inspect credible work, contact
her, manage analytics consent, and use the primary experience across desktop and mobile.
The automated accessibility scan used axe rules tagged for WCAG 2.0 A/AA, WCAG 2.1 A/AA,
and WCAG 2.2 AA.

## Final flow health

1. **Desktop home and consent — Healthy.** The hero, navigation, privacy choices, and
   primary positioning are clear and usable.
2. **Live trust statistic — Healthy.** The production API returned and displayed `5`;
   there is no fabricated numeric fallback.
3. **Keyboard entry — Healthy.** The first Tab exposes a visible “Skip to main content”
   link.
4. **Projects — Healthy.** Featured work is visible, image assets load, and the page has
   no horizontal overflow.
5. **Project case study — Healthy.** The case-study title, role, stack, deliverable, and
   close action establish a clear reading path.
6. **Contact validation — Healthy.** Four invalid fields are identified, field-specific
   guidance is exposed, and focus moves to the first invalid field.
7. **Mobile home — Healthy.** The hero reflows without clipping or horizontal overflow,
   with persistent mobile navigation.
8. **Mobile projects — Healthy.** Project cards become a readable single-column list.
9. **Mobile contact validation — Healthy.** Form guidance remains readable and the social
   and resume side controls remain fully inside the viewport after focus-induced scrolling.

## Confirmed strengths

- Nine checked routes/states returned successfully with one `main` landmark, one `h1`,
  no broken images, and no horizontal overflow.
- The final browser run recorded zero axe violations, console errors, page errors, or
  failed requests.
- Theme switching changed from light to dark without hydration warnings.
- The consent surface, skip link, field validation, live API data, and mobile fixed
  controls behaved as intended.

## Defects corrected during the audit

- Increased the mobile home-introduction heading contrast to meet the large-text threshold.
- Increased the “Scroll to explore more” target from 21 px to 44 px.
- Replaced duplicate contact error wording with a concise form-level instruction.
- Prevented mobile side controls from entering the desktop footer-stop state and becoming
  clipped on short pages.
- Added an image optimization cache so repeated production builds retain the 92.6% image
  reduction without repeating multi-minute conversions.

## Evidence limits

- Axe coverage and screenshot inspection do not constitute a formal WCAG conformance
  certification or replace assistive-technology testing.
- The audit used desktop Chrome emulation for the mobile viewport, not physical iOS or
  Android hardware.
- A real message was not sent to avoid external contact; empty-form validation and focus
  recovery were verified. With no configured submission endpoint, the current intended
  valid-submit behavior opens an email draft.
- The corrected Astro build is local. The production domain still needs the new build
  deployed before these results describe the public site.

The machine-readable findings are in `browser-audit.json`, with accepted evidence in
`screenshots/`.
