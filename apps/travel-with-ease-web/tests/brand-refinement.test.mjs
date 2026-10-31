import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("requested fonts are self-hosted licensed WOFF2 assets with a case-preserving signature", () => {
  for (const font of ["bonheur-royale-latin-400", "montserrat-latin-800"])
    assert.equal(readFileSync(new URL(`../public/fonts/${font}.woff2`, import.meta.url)).subarray(0, 4).toString(), "wOF2");
  for (const licence of ["Bonheur-Royale-OFL", "Montserrat-OFL"])
    assert.match(read(`../public/fonts/${licence}.txt`), /SIL OPEN FONT LICENSE/);
  const typography = read("../src/styles/typography.css");
  assert.match(typography, /font-weight: 800/);
  assert.match(typography, /font-display: swap/);
  assert.doesNotMatch(typography, /https:\/\/fonts\./);
  assert.match(read("../src/components/CinematicHero.astro"), /hero-signature.*A Little More You/);
});

test("full-card links preserve native activation, motion fallback and pre-hydration intent", () => {
  const demo = read("../src/components/DemoWebsite.astro");
  assert.match(demo, /class="journey-card__link"/);
  assert.match(demo, /href="#demo-enquiry-form"/);
  assert.match(demo, /demoEnquiryDestination/);
  const css = read("../src/styles/components/demo-website.css");
  assert.match(css, /journey-card__link::after/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(demo, /DemoEmailPreview/);
});

test("privacy preferences use native modal semantics, Escape support and distinct demo storage", () => {
  const notice = read("../src/components/CookieNotice.astro");
  assert.match(notice, /<dialog/);
  assert.match(notice, /aria-labelledby="cookie-preferences-title"/);
  assert.match(notice, /notice.showModal\(\)/);
  assert.match(notice, /if \(!savedChoice\(\)\) show\(\)/);
  assert.doesNotMatch(notice, /<aside/);
  assert.match(notice, /Close without saving/);
  assert.match(notice, /twe-demo-cookie-consent-v1/);
  assert.doesNotMatch(read("../src/components/PublicFooter.astro"), /<TravelFootprint/);
});
