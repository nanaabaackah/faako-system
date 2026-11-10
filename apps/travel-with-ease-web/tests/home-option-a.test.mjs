import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const home = read("../src/components/PublishedHome.astro");
const services = read("../src/components/HomeServices.astro");
const process = read("../src/components/JourneyProcess.astro");
const tips = read("../src/components/TravelTips.astro");
const css = read("../src/styles/components/home-option-a.css");

test("Option A changes four editorial homepage sections only", () => {
  assert.match(home, /journey-introduction--option-a/);
  assert.match(services, /home-services--option-a/);
  assert.match(process, /"journey-process--option-a": !page/);
  assert.match(tips, /"travel-tips--option-a": homepage/);
  assert.match(home, /import "\.\.\/styles\/components\/home-option-a\.css";/);

  const activeCSS = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(activeCSS, /\.cream-footprint|\.footprint-totals|\.travel-footprint|\.site-header|\.cinematic-hero|\.featured-journeys|\.closing-cta|\.twe-public-footer/);
  assert.doesNotMatch(css, /\.eyebrow|text-transform:\s*uppercase/);
});

test("protected hero, packages, footprint and closing CTA are preserved", () => {
  assert.match(home, /<CinematicHero heading=\{content\.heading\} body=\{content\.body\} image=\{content\.image\} placement=\{content\.imagePlacements\?\.hero\} \/>/);
  assert.match(home, /\{packages\?\.packages\?\.length > 0 && <FeaturedJourneys items=\{packages\.packages\} \/>\}/);
  assert.match(home, /<section id="our-world" class="cream-footprint">[\s\S]*?<TravelFootprint heading=\{footprint\?\.heading\} description=\{footprint\?\.body\}>/);
  assert.match(home, /footprint\.entries\.map/);
  assert.match(home, /<ClosingCta enquiryAvailable=\{Boolean\(contact\)\} \/>/);
  assert.ok(home.indexOf("<TravelFootprint") < home.indexOf("<TravelTips"), "Footprint stays before tips");
  assert.equal((home.match(/<TravelFootprint/g) || []).length, 1);
});

test("About uses the approved story content and available media, without new claims", () => {
  assert.match(home, /<h2>\{about\.heading\}<\/h2>/);
  assert.match(home, /<p>\{about\.body\}<\/p>/);
  assert.match(home, /<EditorialPhoto[\s\S]*?image=\{about\.image\}/);
  assert.match(home, /\{about\.image && \(/);
  assert.match(home, /<ContentLink href="\/about">Meet Travel With Ease<\/ContentLink>/);
});

test("services keep published labels, prices, currency formatting and direct links", () => {
  assert.match(services, /entries\.map\(\(entry, index\) =>/);
  assert.match(services, /serviceSlug\(entry\.heading\)/);
  assert.match(services, /<MoneyText text=\{price\} \/>/);
  assert.match(services, /<MoneyText text=\{summary\} \/>/);
  assert.match(services, /<CurrencyAttribution \/>/);
  assert.match(services, /aria-hidden="true">\{String\(index \+ 1\)\.padStart\(2, "0"\)\}/);
  assert.match(css, /\.home-services--option-a \.home-services__list[\s\S]*?grid-template-columns: repeat\(4/);
});

test("process keeps all approved steps and detailed page layout separate", () => {
  assert.match(process, /content\.entries\.map\(\(step, index\) =>/);
  assert.match(process, /page \? step\.text : summaries\[index\] \|\| step\.text/);
  assert.match(process, /"planning-process": page/);
  assert.match(css, /\.journey-process--option-a \.journey-process__steps > ol/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("travel tips use approved articles and original non-homepage behavior", () => {
  assert.match(tips, /const items = homepage \? ordered\.slice\(0, 3\) : ordered;/);
  assert.match(tips, /"travel-tips--option-a": homepage/);
  assert.match(tips, /href=\{`\/travel-tips\/\$\{tip\.slug\}`\}/);
  assert.match(tips, /\{tip\.excerpt\}/);
  assert.match(css, /\.travel-tips--option-a \.travel-tips__grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /font-family: var\(--font-journal\) !important/);
});

test("responsive cards and editorial layouts retain single-column mobile reflow", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.journey-introduction--option-a \.journey-introduction__inner/);
  assert.match(css, /\.home-services--option-a \.home-services__list/);
  assert.match(css, /\.travel-tips--option-a \.travel-tips__grid/);
});
