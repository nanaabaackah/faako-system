# Journey Chapters — selected public-site refinement

The client selected the third displayed visual concept on 2026-11-02. The
generated concept is a layout reference only, not a published photograph or
business-content source. Implemented in the regular worktree and mirrored into
the existing focused TWE worktree. No deployment or merge is implied.

## Design decisions

- Preserve the actual photographic hero, five supplied device mockups and the
  continuous enquiry/footer background.
- Below the hero: agency introduction on the page background, two photographic service links,
  followed by a real Nairobi photo and four concise process steps. Full service
  inclusions and booking wording remain on the dedicated pages.
- Services uses all four approved entries; About uses a photo-led story layout.
  Packages retain image-overlay title/subtitle/price cards. Journal uses smaller
  cards with category, date, title and excerpt over the photo.
- Later client steering supersedes the square-corner concept: 14px content
  corners and a soft shared shadow. Preserve the shapes of logos, full-bleed
  backgrounds and transparent device artwork. Remove repetitive decorative
  section/card dividers, but keep input boundaries, focus and disclosure affordances.
- Public controls use one wrapper border/inset rather than a bordered input
  nested inside a padded bordered wrapper. The lighter #858a94 boundary contrasts
  approximately 3.41:1 with #fffdfa. Body-sized labels/inputs remain 16px.
  Dropdown panels are solid brand cream, without backdrop blur.
- Search takes the flexible wider track; destination/category/occasion filters
  are limited to 210px on desktop and reflow on mobile.
- All public pages retain visible navigation. After 40px of scroll, it becomes a
  centred cream bar with 25px corners and the supplied pin asset (icon-192.png).
  Mobile navigation keeps its explicit Menu button, Escape and focus behaviour.
  No-JavaScript navigation stays in normal document flow.

## Additional real photography

The five files were fetched from the previously approved TWE Drive folders.
Existing user approval covers website/social use, identifiable people and
credits; no additional credit text was supplied. Original files are not committed.
Responsive WebP derivatives are orientation-normalized and contain no EXIF,
XMP or IPTC. Captions are intentionally omitted; useful alt text is retained.

| Placement | Drive file | Original SHA-256 |
| --- | --- | --- |
| Garden / Premium service | IMG_3079.JPG — 1AYT7BvrVGhqvlH2YF0ELHXDbKK7EkCd8 | 2c7744e25798a2228d00e27b82865e8115f4f28396498ba11f2082aa094d9408 |
| Nairobi process / package | IMG_3236.JPG — 12UTobhM73C8aCPNY4CpkF9Hr1JH8WpeF | fe3d52a1e6c6e7b800c5e1cd69ab531078b72dce87bfa99e8d00120959228e85 |
| Zanzibar / Full planning | IMG_3680.jpg — 1L60OnDx25usrRg5v_hQOfVCv3uEYCW_U | b60ec1e6297ad0f203062823c4f28a09f81e007f0d544fe55018e11251b989d9 |
| Kenya package / article gallery / services / demo | c5b032e0-a1ab-4fe7-a2a4-8af2730a5074.jpg — 1CX16aBpUJfTBwyhk-nlVAv8PQ55v251h | 8947b7727ddb234d5f086f0ee741717e497f8b41fceb36c6be4da859371ea461 |
| Kenya gallery / services | 15f2793c-5ea0-485f-969e-0910c2d09484.jpg — 1EDCpKx04IipFqNz_KJEoZdFLbgv-CdYj | fef2b95fe14ac46fc2facdc0751b872c15c51e363b373141bf05588b65829e1b |

The ten responsive derivatives are 640/1280px wide (2,227,962 bytes total on disk).
The browser selects one candidate per photo; image requests are lazy below the
hero. Reuse URLs across sections rather than downloading duplicate assets.
The mobile closing scene additionally ships the 1920×3413 Zanzibar portrait
(312,540 bytes). It replaces the desktop source only below 761px. One image
element covers the shared enquiry/footer wrapper continuously; it never repeats
or restarts at the footer. The desktop photograph is unchanged. The larger
portrait source avoids selecting a viewport-width thumbnail for a height-driven
crop. Other temporary 1920px outputs are not shipped.
No image was generated for publication, and no Flyward asset was copied.

Manifest: apps/travel-with-ease-web/src/lib/journey-photography.json.
The approved release snapshot assigns additional photos to packages, Journal,
Tips and content pages; explicit CMS snapshots remain authoritative.

## Checks and limits

Use scripts/check-journey-chapters-browser.mjs for 320/390/768/1440px checks,
one main heading, no horizontal overflow, native card links, FAQ keyboard and
no-JavaScript operation, solid select menus and persistent navigation.
The visual comparison and current result are in
[the website QA report](../../../apps/travel-with-ease-web/design-qa.md).

This is a public-site design refinement, not completion of the outstanding
CMS/publication/provider acceptance gates. Authentication, database contracts,
permissions and third-party dependencies have not changed.
