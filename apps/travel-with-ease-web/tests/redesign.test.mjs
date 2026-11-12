import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (name) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("the brand links home without a redundant Home menu entry", () => {
  const layout = source("layouts/BaseLayout.astro");
  assert.match(layout, /aria-label="Travel With Ease home"/);
  assert.doesNotMatch(layout, /\["\/", "Home"\]/);
});

test("shared CTA preserves the selected three mockups, one action and no copied reference assets", () => {
  const component = source("components/ClosingCta.astro");
  assert.match(component, /astro:assets/);
  assert.match(component, /widths=\{\[320, 640, 960\]\}/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /aria-hidden="true"/);
  assert.equal((component.match(/<ContentLink\b/g) || []).length, 1);
  assert.doesNotMatch(component, /<figcaption|framerusercontent|flyward.com/);
  for (const index of [1, 2, 5])
    assert.match(component, new RegExp(`TWE_mockup${index}\\.png`));
  assert.match(
    component,
    /image: laptop, name: "laptop"[\s\S]*image: phone, name: "phone"/,
  );
  assert.match(
    source("styles/components/closing-cta.css"),
    /border-radius: var\(--twe-radius-button\)/,
  );
});

test("one continuous image covers the enquiry and footer, with gutters only at the page end", () => {
  const component = source("components/CinematicEnquiry.astro");
  assert.equal((component.match(/<PlacedImage\b/g) || []).length, 1);
  assert.equal((source("components/PlacedImage.astro").match(/<img\b/g)||[]).length,1);
  assert.match(component, /class="closing-scene__image"/);
  assert.match(
    component,
    /<\/section>\s*<PublicFooter cinematic/,
  );
  assert.match(
    source("layouts/BaseLayout.astro"),
    /!Astro\.slots\.has\("closing"\) && \(\s*<CinematicEnquiry/,
  );
  assert.doesNotMatch(source("layouts/BaseLayout.astro"), /<PublicFooter/);
  assert.match(source("styles/components/cinematic-enquiry.css"),
    /@media \(max-width: 760px\)[\s\S]*object-fit: cover/);
  assert.match(source("components/PlacedImage.astro"), /media="\(max-width:760px\)"/);
  assert.match(component,/zanzibar-beach-club-b60ec1e6297a-1920\.webp/);
  const motion = source("components/EditorialMotion.astro");
  assert.match(motion, /scrollHeight - innerHeight - scrollY/);
  assert.match(motion, /distance \/ 180/);
  assert.match(motion, /reduce.matches\s*\? 0/);
  assert.match(motion, /passive: true/);
  assert.match(
    source("styles/components/public-footer.css"),
    /var\(--footer-progress, 0\)/,
  );
});

test("public homepage uses the approved hero, CTA, enquiry and footprint components", () => {
  for (const filename of ["PublishedHome"]) {
    const component = source(`components/${filename}.astro`);
    for (const name of ["CinematicHero", "ClosingCta", "TravelFootprint"])
      assert.match(component, new RegExp(`<${name}\\b`));
  }
  assert.match(
    source("components/PublishedHome.astro"),
    /heading=\{content.heading\}/,
  );
  assert.match(source("pages/index.astro"), /slot="closing"/);
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
  // The card layout is now entirely static: there is no sticky or animated
  // enquiry heading requiring a reduced-motion override.
  assert.doesNotMatch(enquiry, /animation\s*:|transition\s*:|position:\s*sticky/);
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
