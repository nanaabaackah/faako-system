import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("homepage follows the agreed enquiry-focused editorial journey", () => {
  const home = source("components/PublishedHome.astro");
  const chapters = [
    "<CinematicHero",
    '<section id="about"',
    "<HomeServices",
    "<FeaturedJourneys",
    "<JourneyProcess",
    '<section id="our-world"',
    "<TravelTips",
    "<ClosingCta",
  ];
  let previous = -1;
  for (const chapter of chapters) {
    const position = home.indexOf(chapter);
    assert.ok(position > previous, `Homepage chapter missing or out of order: ${chapter}`);
    previous = position;
  }
  assert.match(home, /publishedPage\("packages"\)/);
  assert.match(home, /<HomeServices[^>]*entries=\{services\.entries\}/);
});

test("homepage hero opens package discovery without losing the enquiry action", () => {
  const hero = source("components/CinematicHero.astro");
  assert.match(hero, /href="#plan"/);
  assert.match(hero, /href="\/packages"/);
  assert.match(hero, /href="#about">Discover more/);
});

test("featured packages are selected from published content with server-derived prices", () => {
  const featured = source("components/FeaturedJourneys.astro");
  assert.match(featured, /\["zanzibar", "nairobi"\]/);
  assert.match(featured, /packageStartingPrice\(item\)/);
  assert.match(featured, /\/packages\/\$\{item\.slug\}/);
  assert.match(featured, /per person sharing/);
});

test("navigation prioritises packages and services, keeping a single planning CTA", () => {
  const layout = source("layouts/BaseLayout.astro");
  const navStart = layout.indexOf("const navigation = [");
  assert.ok(navStart > 0);
  const nav = layout.slice(navStart, layout.indexOf("];", navStart));
  const sections = ["/packages", "/services", "/how-it-works", "/journal", "/about"];
  let previous = -1;
  for (const path of sections) {
    const position = nav.indexOf(`"${path}"`);
    assert.ok(position > previous, `Incorrect navigation order: ${path}`);
    previous = position;
  }
  assert.match(layout, /const planningHref = Astro\.props\.planningHref \|\| "#plan"/);
  assert.match(layout, /href=\{planningHref\}/);
  assert.match(layout, /Plan My Trip/);
});

test("homepage stepper uses a single package route without blending planning rules", () => {
  const process = source("components/JourneyProcess.astro");
  assert.match(process, /const homepageSteps = content\.processFlows\?\.package\?\.steps/);
  assert.match(process, /Planning a trip with us\? See the separate process/);
  assert.match(process, /href="\/how-it-works#trip-planning"/);
  assert.doesNotMatch(process, /Package deposit terms do not automatically apply|approximate total budget/);
});
