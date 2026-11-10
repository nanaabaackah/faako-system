import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("public typography uses licensed Google Fonts with scoped hero and journal handwriting", () => {
  const typography = read("../src/styles/typography.css");
  assert.match(typography, /--font-display: "Italiana"/);
  assert.match(typography, /--font-body: "Quicksand"/);
  assert.match(typography, /--font-signature: "Sassy Frass"/);
  assert.match(typography, /--font-journal: "Caveat"/);
  assert.match(typography, /body \.cinematic-hero h1 \{[\s\S]*?font-weight: 700 !important/);
  assert.match(typography, /body \.cinematic-hero \.hero-signature \{/);
  assert.match(typography, /body \.journal-collection-grid \.journal-card h2 \{/);
  assert.match(typography, /body \.journal-reading \.collection-detail-heading h1 \{/);
  assert.match(typography, /body \.journal-reading \.collection-reading > p:not\(\.collection-standfirst\)/);
  const layout = read("../src/layouts/BaseLayout.astro");
  for (const family of ["Caveat", "Italiana", "Quicksand", "Sassy+Frass"])
    assert.ok(layout.includes(`family=${family}`) || layout.includes(`&family=${family}`));
  assert.match(layout, /display=swap/);
  assert.doesNotMatch(layout, /DM\+Sans|Instrument\+Serif/);
  const headers = read("../public/_headers");
  assert.match(headers, /style-src[^\n]*https:\/\/fonts.googleapis.com/);
  assert.match(headers, /font-src[^\n]*https:\/\/fonts.gstatic.com/);
  assert.match(read("../src/components/CinematicHero.astro"), /hero-signature.*A Little More You/);
});

test("About attribution italic styling is scoped to the story page", () => {
  const component = read("../src/components/PublishedContent.astro");
  const css = read("../src/styles/components/published-content.css");
  assert.match(component, /story \? "published-content__attribution" : undefined/);
  assert.match(css, /\.published-content--story \.published-content__attribution \{\s*font-style: italic;/);
});

test("privacy preferences use native modal semantics, Escape support and a single consent preference", () => {
  const notice = read("../src/components/CookieNotice.astro");
  assert.match(notice, /<dialog/);
  assert.match(notice, /aria-labelledby="cookie-preferences-title"/);
  assert.match(notice, /notice.showModal\(\)/);
  assert.match(notice, /if \(!savedChoice\(\)\) show\(\)/);
  assert.doesNotMatch(notice, /<aside/);
  assert.match(notice, /Close without saving/);
  assert.match(notice, /twe-cookie-consent-v1/);
  assert.doesNotMatch(notice, /twe-demo-cookie/);
  assert.doesNotMatch(read("../src/components/PublicFooter.astro"), /<TravelFootprint/);
});

test("public mobile menu uses an accessible icon and a borderless vertical layout", () => {
  const layout = read("../src/layouts/BaseLayout.astro");
  const nav = read("../src/styles/components/scroll-navigation.css");
  assert.match(layout, /class="menu-toggle"[\s\S]*?aria-label="Menu"/);
  assert.match(layout, /class="menu-toggle__open"[\s\S]*?aria-hidden="true"/);
  assert.match(layout, /class="menu-toggle__close"[\s\S]*?aria-hidden="true"/);
  assert.match(nav, /@media \(max-width: 900px\)/);
  assert.match(nav, /flex-direction: column/);
  assert.match(nav, /border: 0/);
  assert.match(layout, /aria-expanded="false"/);
  assert.match(layout, /if \(event.key === "Escape" && mobile.matches\)/);
});

test("scrolled header keeps the approved white mark and brand navy palette", () => {
  const layout = read("../src/layouts/BaseLayout.astro");
  const nav = read("../src/styles/components/scroll-navigation.css");
  assert.match(layout, /src="\/brand\/Primary gold\.png"/);
  assert.match(layout, /src="\/brand\/midnight primary\.png"/);
  assert.match(nav, /\.site-header\.is-scrolled[\s\S]*?background: var\(--brand-navy\)/);
  assert.match(nav, /\.brand__wordmark--light[\s\S]*?object-fit: cover/);
  assert.match(nav, /\.site-header:not\(\.is-scrolled\) \.brand__wordmark--gold/);
});

test("brand color hierarchy and stacked hero actions preserve contrast", () => {
  const typography = read("../src/styles/typography.css");
  const hero = read("../src/styles/components/cinematic-hero.css");
  for (const token of ["--twe-heading-color", "--twe-copy-color", "--twe-label-color"])
    assert.ok(typography.includes(token));
  assert.match(typography, /body main \.cinematic-hero h1 \.hero-signature/);
  assert.match(typography, /body main \.journal-card \.journal-card__metadata/);
  assert.match(typography, /body main \.cinematic-enquiry__card p/);
  assert.match(typography, /body main \.featured-journeys \.journey-preview :is/);
  assert.match(typography, /body main \.featured-journeys \.journey-preview \.featured-journeys__duration/);
  // Do not reintroduce high-specificity :not() exclusions: they override
  // the inverse cream/gold palette of cards nested in editorial wrappers.
  assert.match(typography, /:where\(p, li\):not\(:where\(\.eyebrow, \.journal-card__metadata\)\)/);
  assert.doesNotMatch(typography, /:is\(p, li\):not\(\.eyebrow\):not\(\.journal-card__metadata\)/);
  assert.match(hero, /@media \(max-width: 600px\)[\s\S]*?flex-direction: column/);
  assert.match(hero, /\.cinematic-hero__actions \.twe-content-link:not\(\.button\)/);
});
