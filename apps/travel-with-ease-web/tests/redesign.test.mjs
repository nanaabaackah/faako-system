import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (name) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("shared CTA uses original responsive TWE photographs, one action and no copied reference assets", () => {
  const component = source("components/ClosingCta.astro");
  assert.match(component, /approved-preview-media.json/);
  assert.match(component, /srcset=/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /aria-hidden="true"/);
  assert.equal((component.match(/<ContentLink\b/g) || []).length, 1);
  assert.doesNotMatch(
    component,
    /<figcaption|framerusercontent|flyward.com|Mockups/,
  );
  assert.match(
    source("styles/components/closing-cta.css"),
    /border-radius: 99px/,
  );
});

test("both website modes use the same hero, CTA, enquiry and footprint components", () => {
  for (const filename of ["PublishedHome", "DemoWebsite"]) {
    const component = source(`components/${filename}.astro`);
    for (const name of [
      "CinematicHero",
      "ClosingCta",
      "CinematicEnquiry",
      "TravelFootprint",
    ])
      assert.match(component, new RegExp(`<${name}\\b`));
    assert.ok(
      component.indexOf("<ClosingCta") < component.indexOf("<CinematicEnquiry"),
    );
  }
  assert.match(
    source("components/PublishedHome.astro"),
    /heading=\{content.heading\}/,
  );
  assert.match(
    source("components/PublishedHome.astro"),
    /image=\{content.image\}/,
  );
});

test("cinematic layout retains a no-JS and reduced-motion fallback without fixed scroll interception", () => {
  const hero = source("styles/components/cinematic-hero.css");
  const enquiry = source("styles/components/cinematic-enquiry.css");
  const footer = source("styles/components/public-footer.css");
  assert.match(hero, /100svh/);
  assert.match(hero, /scripting: none/);
  assert.match(enquiry, /prefers-reduced-motion: reduce/);
  assert.match(footer, /animation-timeline: view\(\)/);
  assert.match(footer, /prefers-reduced-motion: no-preference/);
  assert.doesNotMatch(
    hero + enquiry + footer,
    /position: fixed|scroll-snap|touch-action: none/,
  );
  assert.match(source("components/PublicFooter.astro"), /TRAVEL WITH EASE/);
  assert.match(
    source("styles/editorial.css"),
    /\.cream-footprint\s*\{\s*background: var\(--brand-cream\)/,
  );
});
