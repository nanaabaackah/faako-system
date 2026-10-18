import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("built home contains canonical discovery metadata and estimator disclaimer", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /data-cookie-notice/);
  assert.match(html, /data-analytics-config/);
  assert.match(html, /data-cookie-settings/);
  assert.match(html, /Estimated prices are provided as a guide/);
  assert.doesNotMatch(html, /TWE_AGENT_API_TOKEN|EXCHANGE_RATE_API_KEY/);
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
