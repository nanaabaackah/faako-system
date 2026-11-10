# TWE public typography — 2026-11-10

This is the current public-website typography specification for `apps/travel-with-ease-web` on the develop track, superseding earlier Montserrat/Bonheur Royale and Instrument Serif/DM Sans experiments.

| Context | Typeface | Weight |
| --- | --- | --- |
| Homepage hero heading | Inter | 800 ExtraBold |
| Homepage “A Little More You” signature | Sassy Frass | 400 |
| Page and major section headings (h1–h3) | Italiana | 400 |
| Navigation and primary hero CTA | Inter | 800 ExtraBold |
| Buttons, inputs, ordinary body and full journal articles | Quicksand | 400–700 |
| Journal card titles and short excerpts, article title and standfirst | Caveat | 400–700 |

All five font families are open-source Google Fonts (SIL Open Font License); no paid commercial license is needed. Fonts load using a single Google Fonts CSS2 stylesheet in `BaseLayout.astro` with `display=swap`, and the public site's existing CSP permits Google Fonts stylesheets and font resources. Layout and published content remain untouched.

Journal body paragraphs, categories, dates, filter UI and accessible controls stay in Quicksand for legibility. Handwriting is reserved for editorial titles and short leads. CSS font tokens and scoped overrides live in `src/styles/typography.css`.

Review on both phone and desktop: hero wrapping/contrast, script baseline, section heading sizes, journal card overlay readability, journal article long titles, and default font fallbacks when the network blocks Google Fonts. Do not apply to the staff CMS portal by default.

## Navigation and hierarchy refinement — 2026-11-10

- The gold horizontal logo (`/brand/Primary gold.png`) remains in the unscrolled header. The approved white \"midnight primary.png\" wordmark appears on the fixed scrolled navy header, using a shallow cropped image box to remove the asset's square transparent padding. It replaces the scrolled pin, not the branding elsewhere.
- On screens 900px or narrower, the unscrolled gold wordmark is 116px wide and the white scrolled wordmark is 122px wide; the navbar and expanded mobile menu use brand navy with cream text, gold accents and no border.
- On screens 600px or narrower, the two hero actions stack vertically, share the same wider width and retain distinct cream filled/outlined treatments.
- Cream-surface text hierarchy uses navy headings, muted slate paragraph copy and deep-gold labels (`#77551b`, a shade already used in TWE's journey design). Dark photo overlays retain cream copy and gold accent text, while the cream enquiry card stays on the light palette.
- Regression coverage: responsive mobile navigation and hero CTA geometry; brand image asset presence; browser computed colors; unit assertions for palette and selectors.

## Inter replacement — 2026-11-10

The live public typography now uses **Inter ExtraBold (800)** in place of Montserrat for the homepage hero, navigation links, mobile-menu links, and the hero call-to-action. The menu layout, gold CTA, and larger Sassy Frass signature remain unchanged. Quicksand continues to serve body text and general UI; Italiana and Caveat remain editorial faces. Inter 700/800 loads through the existing Google Fonts stylesheet, which is already permitted by the public site's CSP. Tests inspect the declared family in CSS and computed browser fonts at mobile/desktop widths. The client CMS portal's separate font specification is outside this change.

## Handwritten journal body and mobile signature — 2026-11-10

- Full journal article paragraphs now use Caveat at a comfortable responsive 1.55–1.9rem and 1.43 line-height, matching the existing handwritten titles and leads. Metadata, breadcrumbs and functional links retain Quicksand.
- The Sassy Frass “A Little More You” mobile signature now scales between 4.25rem and 6.25rem with a 19vw preferred size (previously 3rem–5.3rem at 12.5vw), balancing the text within the viewport.
- Browser acceptance checks the actual journal article font, body size, line height, meta font, mobile signature size and horizontal overflow at narrow widths.
