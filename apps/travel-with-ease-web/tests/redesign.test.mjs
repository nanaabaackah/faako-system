import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (name) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("shared CTA preserves the five supplied mockups, one action and no copied reference assets", () => {
  const component = source("components/ClosingCta.astro");
  assert.match(component, /astro:assets/);
  assert.match(component, /widths=\{\[160, 320, 640, 960\]\}/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /aria-hidden="true"/);
  assert.equal((component.match(/<ContentLink\b/g) || []).length, 1);
  assert.doesNotMatch(component, /<figcaption|framerusercontent|flyward.com/);
  for (let index = 1; index <= 5; index++)
    assert.match(component, new RegExp(`TWE_mockup${index}\\.png`));
  assert.match(
    component,
    /image: laptop, name: "laptop"[\s\S]*image: phone, name: "phone"/,
  );
  assert.match(
    source("styles/components/closing-cta.css"),
    /border-radius: 99px/,
  );
});

test("one continuous image covers the enquiry and footer, with gutters only at the page end", () => {
  const component = source("components/CinematicEnquiry.astro");
  assert.equal((component.match(/<img\b/g) || []).length, 1);
  assert.match(component, /class="closing-scene__image"/);
  assert.match(
    component,
    /<\/section>\s*<PublicFooter demo=\{demo\} cinematic/,
  );
  assert.match(
    source("layouts/BaseLayout.astro"),
    /!cinematic && <PublicFooter/,
  );
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

test("both website modes use the same hero, CTA, enquiry and footprint components", () => {
  for (const filename of ["PublishedHome", "DemoWebsite"]) {
    const component = source(`components/${filename}.astro`);
    for (const name of ["CinematicHero", "ClosingCta", "TravelFootprint"])
      assert.match(component, new RegExp(`<${name}\\b`));
  }
  assert.match(
    source("components/PublishedHome.astro"),
    /heading=\{content.heading\}/,
  );
  assert.match(source("pages/index.astro"), /slot="closing"/);
  assert.match(source("pages/demo.astro"), /<DemoClosing\s+slot="closing"/);
  assert.match(
    source("components/DemoClosing.astro"),
    /<CinematicEnquiry demo>/,
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
