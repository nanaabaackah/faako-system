# TWE public typography — 2026-11-10

This is the current public-website typography specification for `apps/travel-with-ease-web` on the develop track, superseding earlier Montserrat/Bonheur Royale and Instrument Serif/DM Sans experiments.

| Context | Typeface | Weight |
| --- | --- | --- |
| Homepage hero heading | Quicksand | 700 (heaviest official; subtle CSS stroke for extra-bold appearance) |
| Homepage “A Little More You” signature | Sassy Frass | 400 |
| Page and major section headings (h1–h3) | Italiana | 400 |
| Navigation, buttons, inputs, ordinary body and full journal articles | Quicksand | 400–700 |
| Journal card titles and short excerpts, article title and standfirst | Caveat | 400–700 |

All four font families are open-source Google Fonts (SIL Open Font License); no paid commercial license is needed. Fonts load using a single Google Fonts CSS2 stylesheet in `BaseLayout.astro` with `display=swap`, and the public site's existing CSP permits Google Fonts stylesheets and font resources. Layout and published content remain untouched.

Journal body paragraphs, categories, dates, filter UI and accessible controls stay in Quicksand for legibility. Handwriting is reserved for editorial titles and short leads. CSS font tokens and scoped overrides live in `src/styles/typography.css`.

Review on both phone and desktop: hero wrapping/contrast, script baseline, section heading sizes, journal card overlay readability, journal article long titles, and default font fallbacks when the network blocks Google Fonts. Do not apply to the staff CMS portal by default.
