import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("brand typography retains Bonheur hero and loads Instrument Serif and DM Sans", () => {
  assert.equal(readFileSync(new URL("../public/fonts/bonheur-royale-latin-400.woff2", import.meta.url)).subarray(0, 4).toString(), "wOF2");
  assert.match(read("../public/fonts/Bonheur-Royale-OFL.txt"), /SIL OPEN FONT LICENSE/);
  const typography = read("../src/styles/typography.css");
  assert.match(typography, /--font-display: "Instrument Serif"/);
  assert.match(typography, /--font-body: "DM Sans"/);
  assert.match(typography, /--font-signature: "Bonheur Royale"/);
  assert.match(typography, /font-display: swap/);
  assert.doesNotMatch(typography, /font-weight: 800/);
  const layout = read("../src/layouts/BaseLayout.astro");
  assert.match(layout, /fonts.googleapis.com\/css2\?family=DM\+Sans/);
  assert.match(layout, /Instrument\+Serif:ital@0;1/);
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
