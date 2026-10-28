import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("review home contains discovery, shared footer and honest placeholder boundaries", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /data-cookie-notice/);
  assert.match(html, /data-analytics-config/);
  assert.match(html, /data-cookie-settings/);
  assert.match(html, /Design preview/);
  assert.match(html, /Photograph supplied by Travel With Ease/);
  assert.match(html, /Blue and white boats moored beside a lake/);
  assert.match(html, /No offers are available to book/);
  assert.match(html, /srcset="\/media\/kenya-/);
  assert.doesNotMatch(html, /drive\.google\.com/);
  assert.match(html, /ui-app-bottom-bar--footer/);
  assert.match(html, /href="\/favicon-48.png"/);
  assert.match(html, /src="\/brand\/Primary gold\.png"/);
  const logo = await readFile(new URL("../dist/brand/Primary gold.png", import.meta.url));
  assert.ok(logo.byteLength > 0, "Approved logo is present in the built output");
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.equal((html.match(/property="og:image"/g) || []).length, 1);
  assert.match(html, /https:\/\/faako.nanaabaackah.com/);
  assert.doesNotMatch(html, /Secure client portal|offline itinerary|class="globe"|Estimator/);
  assert.doesNotMatch(html, /TWE_AGENT_API_TOKEN|EXCHANGE_RATE_API_KEY/);
});

test("review routes exist and do not present policies or offers as approved", async () => {
  for (const slug of ["contact", "journal", "travel-footprint", "privacy", "terms", "faqs"]) {
    const html = await readFile(new URL(`../dist/${slug}/index.html`, import.meta.url), "utf8");
    assert.match(html, /Placeholder for review/);
    assert.match(html, /noindex, nofollow/);
  }
});

test("arrows are explicit and footer includes a neutral footprint without demo totals", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  for (const [, attributes, body] of anchors) {
    if (/twe-content-link/.test(attributes)) assert.equal((body.match(/link-arrow/g) || []).length, 1);
    else assert.doesNotMatch(body, /link-arrow/);
  }
  assert.equal((html.match(/class="footprint-map"/g) || []).length, 2);
  assert.match(html, /Verified travel activity is not available yet/);
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
