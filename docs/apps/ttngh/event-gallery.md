# Event gallery and illustrated news — 2026-11-08

## Repository-managed gallery

By explicit client request, `/gallery` directly renders `src/content/gallery.json` through `gallery.js`. It does not read Sanity or need a write token. The unused gallery importer and eventAlbum schema/query/validation were removed before any Sanity documents or assets were created.

Six visually reviewed approved photos are in `public/images/gallery` (971,484 bytes total), grouped into African Science Academy and Odorgonno Senior High School × Nilee Consult. This is a starter selection, not an exhaustive library review. The JSON inventory maps original Drive IDs and filenames to local WebP assets and alt text. Source notes are not rendered publicly.

Originals remain in Drive. Framing and branding are preserved, EXIF is stripped, and no identities, health conditions or event dates are inferred. Existing library publication approval includes minors.

To add photos, review source context and consent, save optimised copies to `public/images/gallery`, add source mappings and descriptive alt text to `gallery.json`, record actual dimensions in `gallery.js`, test and rebuild. Images lazy-load, preserve their aspect ratio and open larger copies in a new tab. Removal requires an inventory update and rebuild; cached deployed assets may require a separate purge.

## News cards and detail pages

`src/content/press.js` supplies two short original summaries. `PressCoverage.astro` displays fully linked shared Faako glass cards with approved TTNGH images. Cards open `/news/coverage/[slug]`, separate from existing Sanity article routes. Each detail contains two local photos, publisher attribution and a full-story link. Other authored news remains Sanity-managed.

Sources read on 2026-11-08:

- [Pulse Ghana](https://www.pulse.com.gh/story/nilee-consult-promotes-mental-health-awareness-among-odorgonno-shs-students-2026102210392157890)
- [Yemmey](https://yemmey.com/2026/10/28/nilee-consult-thriving-network-promote-mental-health-awareness-among-odorgonno-shs-students-photos-speak/)

Publisher articles are not copied or republished. Pulse displays October 2025, while its URL and body reference 2026, so no date is inferred. Confirm event start/end before creating calendar records. No production release or Drive move was performed.
# Event expansion — 8 November 2026

Public event presentation: Previous events now appears before the live calendar
and combines dated past CMS events with the approved repository recaps, including
ASA and Odorgonno/Nilee. Matching slugs prefer CMS entries. Unconfirmed recap
dates remain omitted. Empty upcoming notices are no longer shown; the homepage
fallback points visitors to previous events instead.

Event cards share the compact event-listings styling for both scheduled and
previous events: 3/2/1 responsive columns, 12rem edge-to-edge cropped image area, shared Faako
bubble-card treatment, two-line summaries, full-card links, focus outlines and
reduced-motion-aware hover effects. News cards retain their separate layout.

Gallery layout follow-up: mixed orientations now use proportional, wrapping
photo rows instead of fixed grid cells. Rows including the last row fill the
available width without cropping or repeating images; mobile uses one column.
The same layout applies to event-detail photo collections. The browser check
asserts full-width rows and aligned image bottoms at 375/768/1440px.

Validation: 52 website tests passed; 22 pages built using isolated preview QA
settings. Headless Chrome checks passed at 375, 768 and 1440px for gallery, news,
events and all four new recap routes (loaded images, overflow and link checks).
This is functional responsive QA, not a completed screenshot review. The earlier
full-page screenshot attempt timed out. Do not deploy this QA dist: rebuild with
the target environment's settings.

The repository gallery now contains 10 reviewed WebP photos (1,692,878 bytes total).
Four additional approved Drive originals were downloaded read-only and optimised:

| Drive file | Generated asset | Usage |
| --- | --- | --- |
| IMG_4256.jpg — 1G1cCC42eg8s9IoYoWzFo9qh1q6ro-0nN | asa-3.webp | ASA gallery and event detail |
| IMG_4178.jpg — 14RAuA3XFj59rM78UOt7uFVOnkrb0o5Mm | asa-4.webp | ASA gallery and event detail |
| IMG_9568.JPG — 1KVuysKJMwc_6loq7ifxxUDc80LWQdSxh | nilee-3.webp | Odorgonno gallery and event detail |
| IMG_9624.JPG — 11Cop8w8EJi51vs607WQ0PEY9WBJtLVSv | nilee-4.webp | Odorgonno gallery and event detail |

All assets are under public/images/gallery, at most 1600px on either axis and under
250KB each. Original framing and embedded branding are retained.
The source originals and Drive organisation were not changed.

Four editorial recap routes live under /events/stories/: african-science-academy,
odorgonno-nilee-consult, vision-with-clarity and tema-school-outreach.
The latter two reuse approved refresh imagery already documented in the Phase 1
image inventory. Content uses the client-confirmed school names, source coverage,
and existing verified Events copy. No exact dates, attendance, diagnoses or
identities are inferred. These recaps deliberately do not enter the live calendar
or generate scheduled Event structured data. Gallery remains repository-managed;
no Sanity writes or deployment were performed.
