# Drive photographs, full-width footprint and privacy popup

## Scope and sources

User requested incorporation of additional Google Drive photographs, larger
full-width maps, an initial privacy popup and more compact footer navigation.
This release also collects the previously unmerged TWE visual, Drive import and
Owner email-template changes. No unrelated applications or credentials belong
in this release. Integration target is `develop`, not `main`.

Source folder: [TWE Website Content](https://drive.google.com/drive/folders/1x6pPrs0rMQV6TbKlLAqogMK0kT0LFuDG).
Reviewed the Kenya and Zanzibar subfolders through the connected Drive account;
the additional selected files have October 22 source timestamps. They are newly
incorporated into this website, not claimed to have been uploaded today. Usage
follows the existing Kenya/Zanzibar permission confirmation and current explicit
request to incorporate the images. Drive originals and sharing were not changed.

| Source ID | Subject | Placement |
| --- | --- | --- |
| 17MLVc2kvd7f4xkqcE9iPCq23s1yyav-G | Pelicans over a lake, Kenya | Default hero and approved bundled homepage image |
| 1srai16o0GXawJ0-4lefpzX1QUb0nVEZS | Giraffe, Kenya | Sample journey and process photography |
| 1TGX0GrhbvNXkghKOBd-DAS-ckuDxWcMG | Sunset, Zanzibar | Demo journal photography |
| 13Yn0mjCvvANlHgDB_OsF2BQ9dn1Wa3ON | Pool and ocean view, Zanzibar | Closing/footer scene and sample journey |

Public assets are WebP derivatives, deduplicated by actual width and named using
source SHA-256. `approved-preview-media.json` records source IDs, hashes, alt text,
dimensions and byte sizes. The offline `scripts/prepare-drive-media.mjs` reuses
the API's bounded image validator and metadata-stripping pipeline. Raw downloads,
authenticated temporary URLs, keys and EXIF are not committed. No images were
AI-generated. Existing five-device CTA artwork is unchanged. No new destination
offer, price or testimonial was invented. Existing published CMS-selected image
overrides remain authoritative; only the bundled approved baseline/defaults and
demo photography changed. Prior assets remain available for rollback.

## Map and footer

- Homepage and standalone footprint section use full-width rows with restrained
  edge gutters. Footer map spans both grid columns with its 190px cap removed.
  Geographic aspect ratio and equivalent country list are preserved.
- Logo/intro and three navigation groups share one compact desktop row. Mobile
  uses two navigation columns and a full-width contact group. Link targets retain
  at least 44px height. Reduced padding avoids unnecessary footer length without
  distorting the larger map or hiding legal/preferences controls.
- Transparent footer map, supplied CTA, photographic footer and final page gutter
  remain. No new fabricated country totals or backend footprint endpoints.
- Removed the desktop contact-group row span that was unnecessarily stacking
  navigation. Tightened legal and wordmark spacing; corrected the wordmark's
  narrow-screen negative margin so the footer does not create horizontal scroll.
  All links remain visible rather than hidden in additional disclosure controls.

## Local verification

- API unit tests: 77 passed; portal tests: 8 passed; website tests: 29 passed.
- TWE lint/type checks/builds and shared UI lint/type checks/8 tests passed.
- Security scan, workspace manifests and monitoring registry passed. Project
  registry completed with its existing unrelated REEBS metadata warning.
- Chrome verified the real website and portal demo at 320, 390, 768 and 1440px:
  initial modal, preference persistence/focus restoration, map widths, full-card
  enquiry navigation, no-send template preview/draft/activation and no horizontal
  overflow. Demo API requests were intercepted and the check confirms none sent.
- Website review-output tests use explicit development/review build settings;
  private local environment files were not edited to make tests pass.
- Required isolated PostgreSQL and final branch CI remain release gates; local
  browser checks do not establish hosted authentication or Drive configuration.

## Consent correction

The previous implementation made only expanded preferences modal, while the
initial notice was a banner. Both now use one native `dialog.showModal()` popup.
It opens on an undecided first visit and can be reopened from Cookie settings.
Essential only, Allow analytics and Manage preferences are explicit choices.
Escape/Close without saving never grants consent. The popup contains focus,
restores its footer invoker and scrolls internally at narrow/short viewports.
No-JavaScript content remains readable and analytics stays off. Production
analytics still requires published privacy information plus explicit consent;
demo choices remain isolated from real preferences and never load analytics.

## Release checks and safeguards

The preceding Drive branch's foundation/PostgreSQL CI passed, but its affected-JS
gate flagged the literal PEM header validator as key material. A narrowly
documented existing `security-scan-ok` marker on that validation line addresses
the false positive; no scan pattern or authentication guard is weakened.

Run all TWE lint/type/build/unit tests, shared UI compatibility tests, browser
checks at 320/390/768/1440px, public consent/no-JavaScript checks, repository checks
and isolated PostgreSQL CI before merging. Migrations 009 and 010 are additive
and must run through existing `db:deploy` before the API/notification worker.
Do not reset a shared database. No hosted database, email or R2 writes are part
of browser tests. Hosted Drive credential/folder configuration remains an
operator check, not implied by these explicit source-file downloads.

Rollback via a reviewed Git revert of the release and the preceding deployment
artifact. Keep additive database columns/tables and existing media; never delete
staff data, queued payloads or Drive originals to roll back a visual change.

Verification results, PR and merge SHA are recorded in the PR/release handoff
after checks complete. Do not promote to `main` as part of this request.
