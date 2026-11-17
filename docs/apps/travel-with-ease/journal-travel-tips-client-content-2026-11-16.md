# Travel With Ease — client Journal and Travel Tip publication (16 November 2026)

## Source and approvals

Source of copy: **Travel with Ease: Travel Tips and Journal Posts (for Designer)**, seven-page client PDF dated 16 November 2026.

Approved in chat:
- Use any suitable already-supplied Kenya/Zanzibar travel photography from the client’s Google Drive folder.
- Remove the **First-Time Traveller Checklist** offer completely. Do not create a checklist or download.
- In **Know why you could be denied boarding**, change the placeholder review marker to **Last checked November 2026**.
- The two previously published-looking Journal articles are placeholders, not actual approved posts: **replace them** with the eight new entries instead of keeping them.
- No DM EASE buttons on the website. Link to the actual trip enquiry, Travel Readiness Session or Nairobi package page.

Do **not** represent changes to the review marker as independently verified visa/health/insurance guidance. The client expressly reserved review of entry-rule claims before live publication. All user-supplied factual sentences and other review dates were preserved.

## Page organization

- One Journal `/journal` is the source of truth, with **seven** individual Travel Tip entries, tagged `Travel tip`, and **one** longer Kenya `Trip story`.
- `Travel tip` series: **Before you fly** (5), **Visas and entry** (2), **Destinations** (0; filter ready but no invented pages).
- Every item has its own `/journal/:slug` route with cover image, italic summary, semantic list/paragraphs, its supplied disclaimer where applicable and a useful site CTA via `ContentLink`/Faako icon. Related-article links are validated against published Journal slugs.
- The **Before you go** homepage section shows exactly three posts, in this order: *6 documents every Ghanaian traveller needs*, *Screenshot everything before you fly*, *Always do this when you rent a car on holiday*. Each links to the corresponding Journal article.
- The **See all tips** link opens `/journal?category=Travel%20tip`. Journal filters allow both type and series; the series is displayed on each card.
- `/travel-tips` and `/travel-tips/:slug` are legacy compatibility redirects, not duplicate article pages.
- All future articles named in the PDF remain unpublished until their actual body and client-approved cover are supplied.
- The previous Journal placeholders (*How Travel With Ease began*, *Six days on Zanzibar’s north coast*) and the three generic booking-related tips are removed from the approved public snapshot. Booking terms continue to live under How It Works.

## CMS and imagery

- Journal CMS supports category, series, homepage placement, related reading and per-article CTA path/label, plus the existing article media selector and gallery.
- Older standalone Travel Tips CMS page is hidden from the normal page dropdown. The API schema retains its legacy content type for migration/compatibility; staff should edit articles in **Journal** only.
- Public source images reuse previously approved local /media assets imported from the user-provided Travel With Ease Kenya/Zanzibar Google Drive folders. We have not introduced remote third-party image endpoints, stock photos, people names or new supplier logos.
- The editor's `Load approved copy` does not create R2 UUID media objects from bundled file paths. For a future CMS-published snapshot, existing approved images may need to be attached to each article via the media library; the static bundled snapshot already references working local images. Avoid publishing an image-less CMS snapshot unintentionally.
- Keep existing Poiret/Quicksand/Inter type scale, editor/gallery layouts, muted editorial rules, native Faako link icons, brand palette, and the production holding-page gate.

## Review checklist

Before merging: tests for approved article count, series, homepage order, safe CTA paths, no checklist or DM copy, November 2026 review marker, CMS schema, prerendered Journal pages, escaping, legacy redirects, mobile layout, and existing homepage regression suite.

Before publishing: the client should verify entry claims, destination restrictions, insurance requirements and final coverage in the supplied wording; preview each photo for identifiable people, hotel names or supplier marks, and crop/replace as needed. Do not auto-publish production.
