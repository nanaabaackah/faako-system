# Website polish — 2026-10-29

Scope requested for PR 111, which was already merged when checked; these changes
therefore use a follow-up PR. The user now reports that hosted sign-in works after configuration
changes. This is not an independently verified authenticated acceptance check.

## Website changes

- Constrain the published hero photograph to its grid column and a 4:5 crop;
  use zero-minimum grid tracks to prevent intrinsic image width from expanding
  the page. This addresses the oversized-image layout, not a missing CSS file.
- Include all five supplied mockups, including the replacement phone/tablet
  files, in a larger single-row CTA. Laptop is prominent; phone immediately
  follows it. No caption. Astro produces responsive WebP assets through Sharp
  0.34.5, already used elsewhere in the repository. Only the web importer is
  added to the lockfile; no unrelated dependency upgrades are included.
- Per explicit user approval, show the brand CTA on the published homepage
  independently of contact-content approval. When contact is unpublished, copy
  says online enquiry details are unavailable and the link says “Enquiry
  availability”; the contact page remains an honest unavailable/noindex page.
  No forms, offers, client claims, prices or policies are fabricated or unlocked.
- Approved homepage FAQ entries use the existing native accordion, with a
  split introduction/questions layout on desktop and one column on mobile.
  Without approved FAQ content, production does not invent questions/answers.
- Refine disclosure spacing, cream open states, gold Iconsax toggle treatment,
  visible focus and 76px minimum summary height. Multiple items can remain open.
  No height animation, dependency, JavaScript requirement or nested control.
- Move eight component style blocks to `src/styles/components/*.css`, retaining
  only scoped CSS imports in Astro. Format component markup vertically. Preserve
  newer published-content, navigation and accordion logic from develop instead
  of overwriting it with the older local workspace.

## Release boundary

This branch does not change portal authentication settings or deploy production.
Approved navigation/content gates and localhost-only synthetic demos remain.
Use the preceding app release as rollback; no database changes are involved.

## Verification

Website build and lint passed; Astro check: 41 files, zero diagnostics. Targeted
accordion/mockup/footprint tests and the real production-build publication tests
passed. Chrome checks at 320/390/768/1440px passed for keyboard expansion,
independent open items and horizontal overflow; no-JavaScript expansion passed.
Reviewed mobile and desktop screenshots. Synthetic FAQ examples were tested only
on the local demo, not added to the published content snapshot.
