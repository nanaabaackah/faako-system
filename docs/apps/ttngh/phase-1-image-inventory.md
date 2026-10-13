# TTNGH image review and usage inventory

Reviewed: 2026-10-12. Source: [approved Drive library](https://drive.google.com/drive/folders/1ifwYbrAS88Q3DrYps1xMpMbkLn3QTa51).

The client explicitly confirmed website-publication consent for the library, including identifiable people and minors, in this implementation conversation. This is the approval basis; the code does not infer consent from a public sharing link. Keep the client's consent records and withdrawal process outside the public repository.

## Review scope

Listed all 224 Vision with Clarity images and visually reviewed their contact sheets. Listed all 230 Tema PreSEc images and visually reviewed a systematic 46-photo sample (every fifth image), then imported four selected photographs. Reviewed the founder portrait, all eight leadership portraits, and all four partner-logo files. This is not a claim that every school photograph was individually reviewed. File modification dates were not treated as event dates or evidence of publication approval.

Drive was read only. Downloads use Drive-served 2000px copies; no original photography was committed or altered. New assets are WebP quality 82 at 640, 960 and 1600 pixels wide, stored under `apps/ttngh/public/images/refresh/`. All source previews were 2000×1333; generated sizes are 640×426, 960×640 and 1600×1066. No upscaling.

## Source → placement → web asset

| Drive source | Website placement | Generated basename (640 / 960 / 1600) | Largest copy |
| --- | --- | --- | --- |
| [Vision With Clarity Pictures / IMG_3938.jpg](https://drive.google.com/file/d/1wiXcDeUKvma3jlHTYXO4BTwAJX20TFiJ/view) | Home / hero | `vision-gathering-*.webp` | 169 KiB |
| [Vision With Clarity Pictures / IMG_3919.jpg](https://drive.google.com/file/d/1QywpbgB3AtPq5n4CiY0aOg2B4npRwHJU/view) | Home / current activity | `vision-conversation-*.webp` | 172 KiB |
| [Vision With Clarity Pictures / IMG_4298.jpg](https://drive.google.com/file/d/1pu4Vs33EQ7QJkwNzfjGXlHv3VzaFziL3/view) | Home and Events / Scroll Expand CTA | `vision-community-*.webp` | 312 KiB |
| [Vision With Clarity Pictures / IMG_3946.jpg](https://drive.google.com/file/d/1RIUzqT4y1jgSKpY4i34yJi-yOeWiN87a/view) | Events / Vision with Clarity; News / documenting programmes | `vision-reflection-*.webp` | 194 KiB |
| [Vision With Clarity Pictures / IMG_4031.jpg](https://drive.google.com/file/d/1CGiSC-h8S9xfNpgEFmb3lzo5asYTy6iN/view) | Events / hero; About / Scroll Expand CTA | `vision-facilitator-*.webp` | 116 KiB |
| [Vision With Clarity Pictures / IMG_3996.jpg](https://drive.google.com/file/d/1pGsOfWuPTX2ffXRbvJmmJihrKv1GUYZ3/view) | About / story; News / hero | `vision-listening-*.webp` | 120 KiB |
| [Tema PreSEc / IMG_7581.jpg](https://drive.google.com/file/d/1aD9NLsKnh-vGxH3oWL-R9PsIC7UTGCSd/view) | Impact and Support / hero | `tema-school-audience-*.webp` | 268 KiB |
| [Tema PreSEc / IMG_7575.jpg](https://drive.google.com/file/d/1Kdb_iu4bUw0fmckHpqe9_4ZQEsoXerEs/view) | Programmes / hero | `tema-school-speaker-*.webp` | 100 KiB |
| [Tema PreSEc / IMG_7665.jpg](https://drive.google.com/file/d/1IelHhvsi_iWTrE1XzHgLomRZAOHWJRxq/view) | Get involved / hero; Events / gallery | `tema-school-conversation-*.webp` | 143 KiB |
| [Tema PreSEc / IMG_7713.jpg](https://drive.google.com/file/d/1ukSAOIqBVnxiX4Vy1rXtij7cLUOA1r2J/view) | About / hero; Programmes and Get involved / CTAs | `tema-school-team-*.webp` | 236 KiB |

## Crop and suitability decisions

- All new selections are landscape and suit desktop/tablet. Inner heroes preserve their natural aspect ratio on mobile rather than cropping important people out.
- Home hero uses a modest 4:3 crop on desktop and 3:2 on mobile. The central table group remains the subject.
- Scroll Expand uses cover cropping: the central group is the subject, not every individual at the edge. Its text and link remain understandable without the photograph. Mobile/reduced-motion checks are part of QA.
- Story and news photography is explicitly tied to Vision with Clarity, not presented as the organisation's founding date or a counselling session.
- School photographs accompany education/outreach or general organisational participation, never a diagnosis or counselling-client claim.
- No support-group-specific photograph was verified. That recurring-event entry is intentionally text-only.
- No standalone volunteering activity or partnership-signing photograph was verified. Get involved uses a captioned school-outreach interaction; partner logos represent the existing named partners. Do not invent a fundraising/volunteering event caption.
- The news page is a publishing placeholder, not invented articles. Its photographs illustrate documented programmes.
- Donation CTA remains typographic rather than assigning a pictured person's circumstances to a fundraising appeal.

## Existing assets retained after Drive review

The founder image and all eight named team portraits match the current supplied Drive portraits. Retain the established identity mapping; do not identify unnamed people in event photographs. Team portraits are compact rows on small screens.

| Drive portrait ID | Existing web asset |
| --- | --- |
| 1TbvZW2ACj9sQV3IU_AE4WN_9E-Az-YdL | home/founder-anthonia.jpg |
| 167vHAoY9Waccb6MN6JVoexELbk0BUXi7 | team/dzifa-tay-ansah.jpg |
| 1uPLIH7gZB0NoBMUlxSHGpGrHAOSUlS_x | team/emefa-adonu.jpg |
| 1ZR6y7KiE49cv7esH9cDA9bIws3VUNj3t | team/frances-acquaye.jpg |
| 16G2SmkSPBzktCIwV5upt2AR5cwzm90eR | team/basilila-nanbigne-adu-wusu.jpg |
| 1eAnV79QOPexII9l8oAkfh_YP46vFaDmf | team/maame-ebe-ackah.jpg |
| 112AF8k_15i1TCWT6cu9iUMRDmX-yHlrE | team/marian-roberts.jpg |
| 12l_AhTiP63Me48v5Ra6L10DV6qfGAHq2 | team/ruby-adeley.jpg |
| 1vD7VO5H0RLaGGCD4wSlMLhXSCF-8VthE | team/vivienne-aklasi.jpg |

Partner files 1T65fO3rkMYFGkc2fi1_HszEZrJOHuqtM and 1Szmgt2pFgk4EKFpsVuiOQVYiUwpViNQB are visually duplicate POT Images logos. Files 1SGeTp6l2bHoJye-zj1BIqvJE7zWf3Km2 and 1QZ3HUuKUXHveIw5raOccJnkIPnl094ww are visually duplicate WOW by Stixx logos. Existing optimized partner assets match; render one of each, without a repeated marquee.

## Replacement/usage flags

- Replaced the old default collages with one contextual photo per hero; unused collage entries were removed where edited.
- Replaced repeated school imagery in Home with distinct Vision with Clarity selections.
- Removed school-outreach imagery beside support-group descriptions.
- Removed the “Founded 2023” overlay from a later Vision photograph; that overlay implied an unverified photo date.
- Removed the repeated news CTA photograph; a typographic CTA avoids reusing its hero subject.
- Existing older gallery and CTA files remain where relevant. They are not asserted to be newest, nor have they been bulk-deleted: public image URLs may be referenced externally.
- Reuse is deliberate but not eliminated: Home/Events share the Vision celebration CTA; the school team photograph appears on About and participation CTAs. A future approved activity library can diversify these without changing context.
- No additional consent confirmation is required for these selected library images under the client's stated approval. Any withdrawn, newly added or differently licensed material needs a fresh check.
