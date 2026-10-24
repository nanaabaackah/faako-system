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
  assert.match(html, /src="\/brand\/primary.png"/);
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

test("unapproved foundation builds fail closed for indexing", async () => {
  const [html, robots] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/robots.txt", import.meta.url), "utf8"),
  ]);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.equal(robots, "User-agent: *\nDisallow: /\n");
  await assert.rejects(readFile(new URL("../dist/sitemap-index.xml", import.meta.url), "utf8"));
});
