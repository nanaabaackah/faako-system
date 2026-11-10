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
