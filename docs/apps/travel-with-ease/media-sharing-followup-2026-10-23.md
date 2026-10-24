# TWE media and discovery follow-up — 2026-10-23

Status: local media/branding slice verified; live-service and full-MVP gates remain.
Branch: `feat/twe-foundation-login-flows`. Existing TWE work preserved; unrelated
TTNGH, README and lockfile changes were not replaced. The attached follow-up is
the user request; instructions packaged inside the ZIP are reference material.

## Source and rights

Drive folder listings verified 40 Kenya files (15 HEIC/HEIF), 8 Zanzibar files
(5 HEIC/HEIF), and 13 logo files. Metadata inventory:
`media-source-inventory.json`. Folder access does not establish copyright.
The user explicitly confirmed **all** to website/social permission, identifiable
people consent and credits on 2026-10-23. No specific photographer credit text
was supplied. Photographs do not establish package availability or travel counts.

The direct Drive download returned HTML and was rejected. Authenticated connector
file references subsequently downloaded originals into a private temporary
directory, not into the repository/public directory. Access URLs are passed only
in memory and are not persisted. Original filenames/Drive IDs remain in the
inventory; content hashing, not names, determines duplicates.

Private working root: `/private/tmp/twe-brand-review.suKZac/`.
`originals/` contains original bytes; `review/` contains converted derivatives and
review sheets. These temporary files require a durable private archive before
handoff; they are not R2 uploads or backups. Do not copy originals into public.

## Brand kit and mapping

The supplied ZIP was extracted into that private root. Its actual primary logo,
48px symbol and three sharing-card crops were visually inspected. The Kenya
card depicts boats beside a lake; the Zanzibar card depicts people at sunset.
The latter is covered by the user's consent confirmation, not an inferred release.

`apps/travel-with-ease-api/scripts/prepare-brand-kit.mjs` re-encodes assets using
the existing Sharp dependency, strips metadata and emits:

| ZIP source | Public output |
| --- | --- |
| `Source-Primary.png` | `brand/primary.png`, 640×248; blank outer margin trimmed |
| `public/favicon-{16,32,48}.png` | Same paths; ICO rebuilt from sanitized frames |
| `public/apple-touch-icon.png` | Same path, 180×180 |
| `public/icon-{192,512}.png` | Same paths and dimensions |
| `public/og/{default,kenya,zanzibar}.jpg` | Same paths, each 1200×630 |

The manifest uses browser display, not an unsupported offline-PWA claim. Nav and
footer reuse the real primary logo. Faako attribution still uses AppBottomBar.
The brand-only default card is used where no published CMS photo exists; country
cards are available but are not proof of published destination/package routes.

## Sharing and publication

BaseLayout retains canonical/JSON-LD, noindex, consent, navigation and footer.
Explicit image/alt/type props support per-page cards and optional breadcrumbs.
External/Drive sharing URLs, query strings and unsupported asset types are rejected.
Production requires `PUBLIC_SITE_URL=https://travelwitheasegh.com`; it also requires
the reviewed publication snapshot. Sitemap entries require actual published page
content, excluding drafts, placeholders and 404s.

The existing CMS image selection remains authoritative: publication generates a
1200×630 centre crop from the selected largest derivative, with the selected
media alt text. No incompatible CMS schema change is introduced. Staff can change
selection through the existing editor; per-image focal-point controls and live
R2 verification remain outstanding. A centre crop must be reviewed before release.

## Analytics and external setup

The existing AnalyticsConsent and shared `@faako/utils` loader are retained. No
second tag, GTM container or borrowed measurement ID was added. Shared tests pass
for denial, grant, withdrawal, DNT, sanitized page paths and deduplication.
There are still no functioning package/enquiry journeys on which to claim verified
package-view or successful-enquiry analytics. Do not emit success from a placeholder.

Required deployment variables: `PUBLIC_SITE_URL`, `PUBLIC_APP_ENV`,
`PUBLIC_SITE_INDEXABLE`, `PUBLIC_GA_MEASUREMENT_ID`, and optionally
`PUBLIC_GOOGLE_SITE_VERIFICATION`. No actual GA4 ID was supplied/configured here.
Client owns Google properties; grant `dev.nanaabaackah@gmail.com` Analytics editor
and Search Console Full access. Baaba handles configuration and verification.

No Cloudflare DNS ownership change, Search Console submission, live GA4 receipt,
Tag Assistant/DebugView verification, sharing-debugger result or live HTTP check
is claimed. Production deployment is explicitly out of scope. Google determines
search snippets and favicon display; see [Google favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search).
For hosted analytics acceptance use [Google's verification guidance](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)
with synthetic non-PII interactions and consent/no-consent/DNT/withdrawal checks.

## Verification so far

- Web build and five metadata/static-output tests pass; image-dimension/meta tests pass.
- API lint passes. Astro meta dimension type errors were fixed by string conversion.
- PostgreSQL integration plus restart/restore passed with the CMS sharing crop:
  15 tables, 49 synthetic rows. Evidence `twe-isolated-pg17-lChnib` in the OS temp directory.
- Production-configured synthetic local build emits only the published homepage
  in its sitemap. This is build verification, not a deployment or live search result.
- Shared GA utility tests: 7/7 pass. No actual Google collection performed.

## Completed library review and local QA

All 48 originals were downloaded and hashed: 44 unique photos and four exact
duplicates. HEIC sources were decoded with macOS `sips`, then orientation-normalized
and re-encoded with Sharp. The 44 sets have 132 private WebP review derivatives;
requested widths are 640/1280/1920 without upscaling (small sources produce repeated
maximum-size variants). Contact sheets were visually reviewed. Inventory entries
include proposed alt text, duplicate source IDs, actual dimensions/bytes and people
review. Background uncertainty is explicitly flagged, not treated as absence.
The 13 Drive logo variants were inventoried, not all downloaded; installed branding
comes from the supplied official ZIP. No credit wording was invented.

Two reviewed photos are included through the existing static build pipeline:

| Source Drive ID | Assignment | Public variants |
| --- | --- | --- |
| `1gheZMzRvzQ41HYNhakhslSQfh5rhx4EM` | Kenya lake boats; local hero | `/media/kenya-09d34a112ab0-{640,1199}.webp` |
| `1fXM3ZotzhpkooutNoKtaL9-drEQ_be6X` | Zanzibar boats; local story section | `/media/zanzibar-387e34e68a079-{640,1280}.webp` |

`src/lib/approved-preview-media.json` records exact source hashes and target sizes.
The selected originals remain private; public derivatives contain no EXIF/XMP/IPTC.
Hero loading is eager/high-priority; the second photo is lazy, both have intrinsic
dimensions, srcset and meaningful alt text. Full portrait compositions are retained
instead of introducing an unreviewed crop. No JavaScript image gallery was added.
These are local preview selections, not seeded CMS records or verified R2 uploads.
Staff-selected production photos/alt text continue through the existing CMS.

Final checks this slice:

- Default build, web tests **5/5**, Astro check **0 errors/warnings**, web/API lint.
- API tests **33/33**, including both asset integrity tests. Sandbox loopback
  failures were rerun with permission; no shared database was touched.
- Chrome/Playwright: 320/768/1440px, no horizontal overflow, both photos load,
  mobile menu open/Escape, favicon GET `200 image/png`. Screenshots reviewed at
  `/private/tmp/twe-brand-review.suKZac/preview-{320,768,1440}.png`.
  The dev toolbar appears in screenshots only; it is not production UI.
- Synthetic GA ID with all Google requests intercepted: zero before consent,
  one loader and one page view after grant, repeat grant deduplicated, withdrawal
  disables collection; DNT produces zero requests. Not live Google verification.
- Logo and small symbol assets visually checked, including 16px favicon.
- Built consent JS: 4,523 bytes / 2,013 gzip; shared CSS: 111,111 / 17,658 gzip.
  React client output exists (220,923 / 68,254 gzip) but the static homepage has no
  hydration island or client-script reference. Photos add no JS; the 640px choices
  total 137,682 bytes, larger choices 415,558 bytes. Header logo is 63,810 bytes,
  reused by footer. This is a byte baseline, not measured mobile Core Web Vitals
  or an approved route budget; shared CSS trimming is a separate scoped decision.

## Remaining release gates

Archive originals durably in approved private storage; import the remaining library
through authorized staff media workflows and review each selected publication crop.
Complete real package/journal/enquiry/map content and functionality before claiming
country/article routes, offer schemas, lead events or full-MVP acceptance.
Obtain/verify TWE Google property access and actual measurement ID; perform approved
hosted DNS/Search Console/GA and sharing-debugger verification only after deployment
authorization. No production changes are authorized by this follow-up.

Existing Trello cards TWE-009 and TWE-007 receive evidence comments only; no checklist
state, list, completion flag or description is changed. Full follow-up remains
incomplete until the external gates above are resolved.
