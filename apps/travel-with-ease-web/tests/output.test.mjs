import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("approved local home contains discovery, shared footer and working intake UI", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /data-cookie-notice/);
  assert.match(html, /data-analytics-config/);
  assert.match(html, /data-cookie-settings/);
  assert.doesNotMatch(html, /Design preview|Online enquiry forms are not available yet/);
  assert.match(html, /cinematic-hero__image/);
  assert.match(html, /Pelicans lifting from the water of a lake in Kenya/);
  assert.match(html, /public-enquiry-form/);
  assert.match(html, /Send enquiry/);
  assert.match(html, /TRAVEL WITH EASE/);
  assert.match(html, /href="#plan"/);
  assert.match(html, /srcset="\/media\/kenya-/);
  assert.doesNotMatch(html, /drive\.google\.com/);
  assert.match(html, /ui-app-bottom-bar--footer/);
  assert.match(html, /href="\/favicon-48.png"/);
  assert.match(html, /src="\/brand\/Primary gold\.png"/);
  const logo = await readFile(new URL("../dist/brand/Primary gold.png", import.meta.url));
  const scrollSymbol = await readFile(new URL("../dist/brand/dark mode symbol.png", import.meta.url));
  assert.ok(logo.byteLength > 0, "Approved gold logo is present in the built output");
  assert.ok(scrollSymbol.byteLength > 0, "Approved dark-mode symbol is present in the built output");
  assert.match(html, /src="\/brand\/dark mode symbol\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.equal((html.match(/property="og:image"/g) || []).length, 1);
  assert.match(html, /https:\/\/faako.nanaabaackah.com/);
  assert.doesNotMatch(html, /Secure client portal|offline itinerary|class="globe"|Estimator/);
  assert.doesNotMatch(html, /TWE_AGENT_API_TOKEN|EXCHANGE_RATE_API_KEY/);
});

test("public routes use approved copy and keep unapproved policies unavailable", async () => {
  for (const slug of ["contact", "journal", "travel-footprint", "privacy", "terms", "faqs"]) {
    const html = await readFile(new URL(`../dist/${slug}/index.html`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /Placeholder for review/);
    assert.doesNotMatch(html, /Content unavailable/);
    if (slug === "terms") assert.match(html, /Booking and planning terms/);
    if (slug === "contact") assert.match(html, /public-enquiry-form/);
    assert.match(html, /noindex, nofollow/);
  }
});

test("arrows are explicit and only the page footprint remains, without demo totals", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  for (const [, attributes, body] of anchors) {
    if (/twe-content-link/.test(attributes)) assert.equal((body.match(/link-arrow/g) || []).length, 1);
    else assert.doesNotMatch(body, /link-arrow/);
  }
  assert.equal((html.match(/class="footprint-map"/g) || []).length, 1);
  assert.doesNotMatch(html.match(/<footer[\s\S]*?<\/footer>/)?.[0] || "", /footprint-map/);
  assert.match(html, /Countries explored/);
  assert.match(html, /25\+ visits/);
  assert.match(html, /Explore all 21 countries/);
  assert.doesNotMatch(html, /Illustrative demo totals|12 demo trips|4 demo trips/);
  assert.doesNotMatch(html, /arrowTemplate|querySelectorAll\("a:not/);
});

test("unapproved foundation builds fail closed for indexing", async () => {
  const [html, robots] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/robots.txt", import.meta.url), "utf8"),
  ]);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.equal(robots, "User-agent: *\nDisallow: /\n");
  await assert.rejects(readFile(new URL("../dist/sitemap-index.xml", import.meta.url), "utf8"));
});

test("published package itinerary stays visible in static HTML and gallery keeps image links", async () => {
  const html = await readFile(new URL("../dist/packages/zanzibar/index.html", import.meta.url), "utf8");
  assert.match(html, /id="package-itinerary"/);
  assert.match(html, /Arrive on the north coast/);
  assert.match(html, /Meet your airport transfer/);
  assert.match(html, /twe-package-itinerary/);
  assert.match(html, /twe-package-gallery__fallback/);
  assert.match(html, /View larger image/);
  assert.match(html, /\/media\/zanzibar-/);
});
