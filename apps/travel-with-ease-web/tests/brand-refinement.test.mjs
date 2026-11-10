import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Montserrat headings and Bonheur hero signature are self-hosted and licensed", () => {
  for (const font of ["bonheur-royale-latin-400", "montserrat-latin-800"]) {
    const asset = readFileSync(new URL(`../public/fonts/${font}.woff2`, import.meta.url));
    assert.equal(asset.subarray(0, 4).toString(), "wOF2");
  }
  for (const licence of ["Bonheur-Royale-OFL", "Montserrat-OFL"]) {
    assert.match(read(`../public/fonts/${licence}.txt`), /SIL OPEN FONT LICENSE/);
  }
  const css = read("../src/styles/typography.css");
  assert.match(css, /font-family: "Montserrat"/);
  assert.match(css, /font-weight: 800 !important/);
  assert.match(css, /font-family: "Bonheur Royale"/);
  assert.match(css, /font-display: swap/);
  assert.doesNotMatch(css, /Instrument Serif|DM Sans/);
  const layout = read("../src/layouts/BaseLayout.astro");
  assert.doesNotMatch(layout, /fonts\\.googleapis\\.com|fonts\\.gstatic\\.com/);
  const headers = read("../public/_headers");
  assert.doesNotMatch(headers, /fonts\\.googleapis\\.com|fonts\\.gstatic\\.com/);
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
